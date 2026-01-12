import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { WebClient } from '@slack/web-api';
import 'dotenv/config';

const CHANGELOG_URL = 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';
const CACHE_FILE = '.cache/last-changelog.md';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

const slack = SLACK_BOT_TOKEN ? new WebClient(SLACK_BOT_TOKEN) : null;

async function fetchChangelog() {
  const response = await fetch(CHANGELOG_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch changelog: ${response.status}`);
  }
  return response.text();
}

async function loadCachedChangelog() {
  try {
    return await readFile(CACHE_FILE, 'utf-8');
  } catch {
    return null;
  }
}

async function saveChangelog(content) {
  if (!existsSync('.cache')) {
    await mkdir('.cache', { recursive: true });
  }
  await writeFile(CACHE_FILE, content);
}

function parseChangelogEntries(content) {
  // Split by version headers (## [x.x.x] or ## x.x.x)
  const versionRegex = /^## \[?(\d+\.\d+\.\d+)\]?/gm;
  const matches = [];
  let match;

  while ((match = versionRegex.exec(content)) !== null) {
    matches.push({ version: match[1], index: match.index });
  }

  return matches.map((m, i) => ({
    version: m.version,
    content: content.slice(m.index, matches[i + 1]?.index ?? content.length).trim()
  }));
}

function findNewEntries(currentContent, cachedContent) {
  if (!cachedContent) {
    // First run - return only the latest entry to avoid spamming
    const entries = parseChangelogEntries(currentContent);
    return entries.slice(0, 1);
  }

  const currentEntries = parseChangelogEntries(currentContent);
  const cachedEntries = parseChangelogEntries(cachedContent);
  const cachedVersions = new Set(cachedEntries.map(e => e.version));

  return currentEntries.filter(entry => !cachedVersions.has(entry.version));
}

function formatSlackBlocks(entry) {
  // Remove the version header line (## x.x.x) since we show it in the header block
  let lines = entry.content.split('\n').filter(line => !line.match(/^## /));

  // Parse changelog items and group by category
  const categories = {
    added: { label: 'Added', items: [] },
    fixed: { label: 'Fixed', items: [] },
    changed: { label: 'Changed', items: [] },
    improved: { label: 'Improved', items: [] },
    removed: { label: 'Removed', items: [] },
    other: { label: 'Updates', items: [] }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) continue;

    const item = trimmed.slice(1).trim();
    const lower = item.toLowerCase();

    if (lower.startsWith('added') || lower.startsWith('add ') || lower.startsWith('new ') || lower.startsWith('introducing')) {
      categories.added.items.push(item);
    } else if (lower.startsWith('fixed') || lower.startsWith('fix ')) {
      categories.fixed.items.push(item);
    } else if (lower.startsWith('changed') || lower.startsWith('change ')) {
      categories.changed.items.push(item);
    } else if (lower.startsWith('improved') || lower.startsWith('improve ')) {
      categories.improved.items.push(item);
    } else if (lower.startsWith('removed') || lower.startsWith('remove ')) {
      categories.removed.items.push(item);
    } else {
      categories.other.items.push(item);
    }
  }

  // Build blocks
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:cc: Claude Code v${entry.version} :cc:`,
        emoji: true
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'A new version of Claude Code is now available.'
      }
    },
    { type: 'divider' }
  ];

  // Add each non-empty category
  for (const cat of Object.values(categories)) {
    if (cat.items.length === 0) continue;

    // Format items - convert markdown links and bold
    const formattedItems = cat.items.map(item => {
      let formatted = item
        .replace(/\*\*(.+?)\*\*/g, '*$1*')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
        .replace(/`([^`]+)`/g, '`$1`');
      return `  •  ${formatted}`;
    });

    let sectionText = `*${cat.label}*\n${formattedItems.join('\n')}`;

    if (sectionText.length > 2900) {
      sectionText = sectionText.slice(0, 2850) + '\n_...and more_';
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: sectionText
      }
    });
  }

  // Footer
  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Full changelog <https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md|here>'
        }
      ]
    }
  );

  return blocks;
}

async function postToSlack(entry) {
  const blocks = formatSlackBlocks(entry);

  if (!slack || !SLACK_CHANNEL_ID) {
    console.log('SLACK_BOT_TOKEN or SLACK_CHANNEL_ID not set - printing message instead:');
    console.log(JSON.stringify({ blocks }, null, 2));
    throw new Error('Cannot post to Slack: SLACK_BOT_TOKEN or SLACK_CHANNEL_ID not configured');
  }

  const result = await slack.chat.postMessage({
    channel: SLACK_CHANNEL_ID,
    text: `Claude Code v${entry.version} Released`,
    blocks
  });

  if (!result.ok) {
    throw new Error(`Failed to post to Slack: ${result.error}`);
  }

  console.log(`Posted to Slack successfully (ts: ${result.ts})`);
}

async function main() {
  console.log('Fetching changelog...');
  const currentContent = await fetchChangelog();

  console.log('Loading cached changelog...');
  const cachedContent = await loadCachedChangelog();

  console.log('Finding new entries...');
  const newEntries = findNewEntries(currentContent, cachedContent);

  if (newEntries.length === 0) {
    console.log('No new changelog entries found');
  } else {
    console.log(`Found ${newEntries.length} new entries: ${newEntries.map(e => e.version).join(', ')}`);

    // Post entries in chronological order (oldest first)
    for (const entry of newEntries.reverse()) {
      await postToSlack(entry);
    }
  }

  console.log('Saving changelog to cache...');
  await saveChangelog(currentContent);

  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
