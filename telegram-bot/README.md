# Telegram Auto-Post Bot

A Telegram bot that allows you to forward messages in bulk and automatically posts them to your channel at scheduled intervals.

## Features

- ✅ Forward messages in bulk (50-100 messages)
- ✅ Automatically posts 3 messages every 30 minutes
- ✅ Queue management with pause/resume controls
- ✅ Persistent queue storage in Supabase
- ✅ Supports photos, videos, animations, albums, and text
- ✅ Deduplication to avoid posting the same content twice
- ✅ AI-powered caption rewriting (optional)

## Setup

### 1. Install Dependencies

```bash
cd telegram-bot
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `telegram-bot` directory:

```env
# Telegram Bot Configuration
BOT_TOKEN=your_bot_token_here
API_ID=your_api_id
API_HASH=your_api_hash
TELEGRAM_SESSION=your_session_string
TARGET_CHANNEL=@your_channel_username

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key

# Optional: Source groups/channels to watch
SOURCE_GROUPS=["group1", "group2"]
SOURCE_CHANNELS=["channel1", "channel2"]

# Optional: Posting interval (default: 0ms)
POST_INTERVAL=1s

# Optional: AI Configuration
AI_ENABLED=false
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
AI_SYSTEM_PROMPT=Rewrite the caption to be catchy, short, and safe for Telegram.

# Optional: Footer configuration
FOOTER_ENABLED=true
FOOTER_HANDLE=@your_handle

# Optional: Logging
LOG_SUCCESS=true
```

### 3. Set Up Database

Run the migration to create the queue table in your Supabase database:

```bash
# In your Supabase SQL editor, run:
telegram-bot/migrations/create_post_queue.sql
```

Or use the Supabase CLI:

```bash
supabase db execute -f telegram-bot/migrations/create_post_queue.sql
```

### 4. Generate Telegram Session

If you don't have a session string yet:

```bash
cd telegram-bot
node services/generateSession.js
```

### 5. Run the Bot

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Usage

### Basic Commands

- `/start` - Start the bot and see instructions
- `/queue` - Check queue status (pending, posted, failed counts)
- `/pause` - Pause automatic posting
- `/resume` - Resume automatic posting

### How to Use

1. **Forward Messages in Bulk**
   - Open a chat with your bot
   - Forward 50-100 messages from any source
   - The bot will add them to the queue

2. **Automatic Posting**
   - The bot automatically posts 3 messages every 30 minutes
   - Check queue status anytime with `/queue`
   - Pause/resume as needed with `/pause` and `/resume`

3. **Monitor Progress**
   - Use `/queue` to see:
     - How many messages are pending
     - How many have been posted
     - How many failed (if any)
     - Current scheduler status (running/paused)

## Configuration

### Customize Posting Schedule

Edit `telegram-bot/services/queueScheduler.js`:

```javascript
constructor() {
  this.postsPerInterval = 3; // Change number of posts per cycle
  this.intervalMs = 30 * 60 * 1000; // Change interval (30 minutes)
}
```

### Supported Message Types

- Text messages
- Photos (single or albums)
- Videos
- Animations/GIFs
- Media groups (albums)

## Architecture

```
telegram-bot/
├── config.js           # Configuration and environment variables
├── main.js             # Main bot entry point
├── services/
│   ├── queueScheduler.js   # Queue management and scheduling
│   ├── repostMessage.js    # Message posting logic
│   ├── fetchMessages.js    # MTProto message fetching
│   ├── dedupe.js           # Deduplication service
│   ├── ai.js               # AI caption rewriting
│   └── ...
├── utils/
│   ├── logger.js       # Logging utilities
│   ├── hash.js         # Content hashing
│   └── ...
└── migrations/
    └── create_post_queue.sql  # Database schema
```

## Troubleshooting

### Bot not posting messages

1. Check queue status: `/queue`
2. Ensure scheduler is running (not paused): `/resume`
3. Check logs for errors
4. Verify Supabase connection

### Messages failing to post

1. Check `/queue` for failed count
2. Review database `error_message` column
3. Verify TARGET_CHANNEL is correct
4. Ensure bot has admin rights in the channel

### Database connection issues

1. Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
2. Ensure migration was run successfully
3. Check Supabase dashboard for errors

## License

MIT
