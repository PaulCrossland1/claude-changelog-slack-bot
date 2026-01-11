# Claude Code Changelog Slack Bot

Monitors the [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) and posts new releases to Slack.

## How it works

- GitHub Actions runs every hour
- Fetches the latest CHANGELOG.md from the Claude Code repo
- Compares with the cached previous version
- Posts any new version entries to Slack via the Slack Web API
- Caches the changelog for the next run

## Setup

### 1. Create a Slack App

1. Go to https://api.slack.com/apps
2. Click **Create New App** > **From scratch**
3. Name it "Claude Code Changelog" (or similar)
4. Select your workspace

### 2. Configure Bot Permissions

1. Go to **OAuth & Permissions** in the sidebar
2. Under **Scopes** > **Bot Token Scopes**, add:
   - `chat:write` - to post messages
   - `chat:write.public` - to post to channels without joining (optional)
3. Click **Install to Workspace** at the top
4. Authorize the app
5. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### 3. Get the Channel ID

1. In Slack, right-click the target channel
2. Click **View channel details**
3. Scroll to the bottom - the Channel ID looks like `C1234567890`

### 4. Add GitHub Secrets

1. Go to your GitHub repo > **Settings** > **Secrets and variables** > **Actions**
2. Add these secrets:
   - `SLACK_BOT_TOKEN`: Your Bot User OAuth Token
   - `SLACK_CHANNEL_ID`: The channel ID to post to

### 5. Enable GitHub Actions

1. Go to the **Actions** tab in your repo
2. Click **I understand my workflows, go ahead and enable them**
3. The workflow will now run automatically every hour

### 6. Invite the Bot (if needed)

If you didn't add `chat:write.public` scope, invite the bot to your channel:
```
/invite @Claude Code Changelog
```

### 7. Test it

1. Go to **Actions** > **Check Claude Code Changelog**
2. Click **Run workflow** > **Run workflow**
3. Check your Slack channel for a message

## Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# Then run:
npm run check
```

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

## Message format

Messages include:
- Version number in header
- Full changelog content (converted to Slack formatting)
- Link to the full changelog on GitHub

## License

MIT
