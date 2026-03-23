/**
 * Email Intelligence Scanner
 * Scans IMAP inbox, classifies client-related emails, posts to Sprint Tracker API.
 * Run via GitHub Actions 4x daily.
 */

const { ImapFlow } = require('imapflow');

// ── Config from environment ──
const IMAP_CONFIG = {
  host: process.env.IMAP_HOST,
  port: 993,
  secure: true,
  auth: {
    user: process.env.IMAP_USER,
    pass: process.env.IMAP_PASS
  },
  logger: false
};
const WORKER_URL = process.env.WORKER_URL;
const SCANNER_TOKEN = process.env.EMAIL_SCANNER_TOKEN;

// Look back 8 hours (overlapping with 6-hour cron to avoid gaps)
const LOOKBACK_HOURS = 8;

// ── Sender classification rules ──
const TYPE_RULES = [
  { type: 'formspree_lead',  test: (from) => from.includes('formspree.io') },
  { type: 'chatbot_lead',    test: (from) => from.includes('smglogin.com') },
  { type: 'jotform_lead',    test: (from) => from.includes('jotform.com') || from.includes('jotformemail.com') },
  { type: 'pixel_data',      test: (from) => from.includes('robertlbutt3@gmail.com') }
];

// ── Client name list for matching ──
// Each entry is checked against subject + sender + body snippet (case-insensitive)
const CLIENT_PATTERNS = [
  { canonical: 'Austin Drilling',           patterns: ['austin drilling'] },
  { canonical: "Sheppard's Glass",          patterns: ["sheppard's glass", 'sheppards glass', 'sheppard glass'] },
  { canonical: 'Floor Pro',                 patterns: ['floor pro', 'floorpro', 'floor pro clean'] },
  { canonical: 'The Guttermen',             patterns: ['guttermen', 'gutter men'] },
  { canonical: 'Smith-Built Metals',        patterns: ['smith-built metals', 'smith built metals', 'smithbuilt'] },
  { canonical: 'Smith-Built Buildings',     patterns: ['smith-built buildings', 'smith built buildings'] },
  { canonical: 'Brabham Fence',             patterns: ['brabham fence', 'brabham'] },
  { canonical: 'Carolina Stone Craftsman',  patterns: ['carolina stone'] },
  { canonical: 'Centa Medical',             patterns: ['centa medical'] },
  { canonical: 'Icehouse Amphitheater',     patterns: ['icehouse amphitheater', 'icehouse'] },
  { canonical: 'Midlands Landscape',        patterns: ["midland's landscape", 'midlands landscape', 'midland landscape'] },
  { canonical: 'Mt. Horeb',                 patterns: ['mt. horeb', 'mount horeb', 'mthoreb'] },
  { canonical: "Nature's Best",             patterns: ["nature's best", 'natures best'] },
  { canonical: 'Preferred Home Inspections',patterns: ['preferred home'] },
  { canonical: 'Red Shirt Guys',            patterns: ['red shirt'] },
  { canonical: 'Rhino Linings',             patterns: ['rhino linings'] },
  { canonical: 'Stormy Plumbing',           patterns: ['stormy plumbing'] },
  { canonical: 'Stripewide',                patterns: ['stripewide'] },
  { canonical: 'Superior Plumbing',         patterns: ['superior plumbing'] },
  { canonical: "Whetzel's Auto",            patterns: ["whetzel's auto", 'whetzels auto', 'whetzel auto'] },
  { canonical: 'Atlantic AWD',              patterns: ['awdsc', 'atlantic water'] },
  { canonical: 'Luxe + Wander',             patterns: ['luxe + wander', 'luxe and wander', 'luxewander'] },
  { canonical: 'Blue Marlin',               patterns: ['blue marlin'] },
  { canonical: 'XpressCredit',              patterns: ['xpresscredit', 'xpress credit'] },
  { canonical: 'Carreiro Builders',         patterns: ['carreiro'] },
  { canonical: 'Atlantic Forklift',         patterns: ['atlantic forklift'] },
];

function matchClientName(text) {
  if (!text) return null;
  var lower = text.toLowerCase();
  for (var i = 0; i < CLIENT_PATTERNS.length; i++) {
    var entry = CLIENT_PATTERNS[i];
    for (var j = 0; j < entry.patterns.length; j++) {
      if (lower.includes(entry.patterns[j])) return entry.canonical;
    }
  }
  return null;
}

function classifyEmail(fromAddr, subject, snippet) {
  var fromLower = (fromAddr || '').toLowerCase();
  for (var i = 0; i < TYPE_RULES.length; i++) {
    if (TYPE_RULES[i].test(fromLower)) return TYPE_RULES[i].type;
  }
  // Check for client name in combined text
  var combined = [fromAddr, subject, snippet].join(' ');
  if (matchClientName(combined)) return 'client_mention';
  return null; // not interesting
}

async function main() {
  var since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000);
  // IMAP SINCE is date-granular; we fetch since midnight and filter by exact time in JS
  var sinceDate = new Date(since.toISOString().split('T')[0] + 'T00:00:00Z');

  var client = new ImapFlow(IMAP_CONFIG);
  var logsToPost = [];

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    var uids = await client.search({ since: sinceDate });
    if (!uids || uids.length === 0) {
      console.log('No messages in search window');
      await client.logout();
      return;
    }

    console.log('Found ' + uids.length + ' messages since ' + sinceDate.toISOString().split('T')[0] + ', filtering to last ' + LOOKBACK_HOURS + 'h...');

    for await (var msg of client.fetch(uids, { envelope: true, bodyText: true, uid: true })) {
      var envelope = msg.envelope || {};
      var receivedAt = envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString();

      // Filter by exact timestamp
      if (new Date(receivedAt) < since) continue;

      var messageId = envelope.messageId || ('uid-' + msg.uid + '-' + Date.now());
      var fromAddr = '';
      if (envelope.from && envelope.from[0]) {
        fromAddr = envelope.from[0].address || envelope.from[0].name || '';
      }
      var subject = envelope.subject || '';
      var snippet = msg.bodyText
        ? msg.bodyText.replace(/\s+/g, ' ').trim().substring(0, 300)
        : null;

      var emailType = classifyEmail(fromAddr, subject, snippet);
      if (!emailType) continue;

      var clientName = matchClientName([fromAddr, subject, snippet].join(' '));

      logsToPost.push({
        message_id: messageId,
        email_type: emailType,
        client_name: clientName,
        subject: subject.substring(0, 500),
        sender: fromAddr.substring(0, 255),
        received_at: receivedAt,
        snippet: snippet
      });
    }

    await client.logout();
  } catch (err) {
    console.error('IMAP error:', err.message);
    try { await client.logout(); } catch (e) {}
    process.exit(1);
  }

  console.log('Classified ' + logsToPost.length + ' relevant emails');

  if (logsToPost.length === 0) {
    console.log('Nothing to post');
    return;
  }

  // POST batch to Worker
  try {
    var response = await fetch(WORKER_URL + '/api/email-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SCANNER_TOKEN
      },
      body: JSON.stringify({ logs: logsToPost })
    });

    if (!response.ok) {
      var text = await response.text();
      throw new Error('Worker responded ' + response.status + ': ' + text);
    }

    var result = await response.json();
    var dupes = logsToPost.length - result.inserted;
    console.log('Worker accepted ' + result.inserted + ' new entries' + (dupes > 0 ? ' (' + dupes + ' duplicates skipped)' : ''));
  } catch (err) {
    console.error('POST to worker failed:', err.message);
    process.exit(1);
  }
}

main().catch(function(err) {
  console.error(err);
  process.exit(1);
});
