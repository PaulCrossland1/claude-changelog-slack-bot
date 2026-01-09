# Claude Code Changelog Slack Bot

Monitors the [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) and posts new releases to Slack.

## How it works

- GitHub Actions runs every hour
- Fetches the latest CHANGELOG.md from the Claude Code repo
- Compares with the cached previous version
- Posts any new version entries to Slack via webhook
- Caches the changelog for the next run

## Setup

### 1. Get a Slack Webhook URL

Ask your Slack admin to:

1. Go to https://api.slack.com/apps → **Create New App** → **From scratch**
2. Name it "Claude Code Changelog" (or similar)
3. Go to **Incoming Webhooks** → Toggle **On**
4. Click **Add New Webhook to Workspace**
5. Select the target channel
6. Copy the Webhook URL (starts with `https://hooks.slack.com/services/...`)

### 2. Fork/Clone this repo

```bash
# Option A: Fork on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/claude-changelog-slack-bot.git

# Option B: Create new repo from this code
```

### 3. Add the Slack webhook secret

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `SLACK_WEBHOOK_URL`
4. Value: Your Slack webhook URL
5. Click **Add secret**

### 4. Enable GitHub Actions

1. Go to the **Actions** tab in your repo
2. Click **I understand my workflows, go ahead and enable them**
3. The workflow will now run automatically every hour

### 5. Test it

1. Go to **Actions** → **Check Claude Code Changelog**
2. Click **Run workflow** → **Run workflow**
3. Check your Slack channel for a message

## Configuration

### Change check frequency

Edit `.github/workflows/check-changelog.yml` and modify the cron schedule:

```yaml
schedule:
  - cron: '0 * * * *'     # Every hour (default)
  - cron: '*/15 * * * *'  # Every 15 minutes
  - cron: '0 */6 * * *'   # Every 6 hours
  - cron: '0 9 * * *'     # Daily at 9 AM UTC
```

### Local testing

```bash
# Without Slack (prints message to console)
npm run check

# With Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx npm run check
```

## Message format

Messages include:
- Version number in header
- Full changelog content (converted to Slack formatting)
- Link to the full changelog on GitHub

## License

MIT
