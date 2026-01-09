import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const CHANGELOG_URL = 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';
const CACHE_FILE = '.cache/last-changelog.md';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

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
  const entries = [];
  let match;
  const matches = [];

  while ((match = versionRegex.exec(content)) !== null) {
    matches.push({ version: match[1], index: match.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = matches[i + 1]?.index || content.length;
    entries.push({
      version: matches[i].version,
      content: content.slice(start, end).trim()
    });
  }

  return entries;
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

function formatSlackMessage(entry) {
  // Convert markdown to Slack mrkdwn format
  let text = entry.content;

  // Convert ### headers to bold
  text = text.replace(/^### (.+)$/gm, '*$1*');

  // Convert **bold** to *bold*
  text = text.replace(/\*\*(.+?)\*\*/g, '*$1*');

  // Convert [links](url) to <url|links>
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

  // Convert inline code
  text = text.replace(/`([^`]+)`/g, '`$1`');

  // Truncate if too long (Slack has limits)
  if (text.length > 2900) {
    text = text.slice(0, 2900) + '\n\n_(truncated - see full changelog on GitHub)_';
  }

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚀 Claude Code v${entry.version} Released`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: text
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '<https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md|View full changelog on GitHub>'
          }
        ]
      }
    ]
  };
}

async function postToSlack(message) {
  if (!SLACK_WEBHOOK_URL) {
    console.log('SLACK_WEBHOOK_URL not set - printing message instead:');
    console.log(JSON.stringify(message, null, 2));
    return;
  }

  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to post to Slack: ${response.status} - ${text}`);
  }

  console.log('Posted to Slack successfully');
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
      const message = formatSlackMessage(entry);
      await postToSlack(message);
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
