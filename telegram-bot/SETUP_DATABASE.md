# 🗄️ Database Setup Guide

You're getting errors because the database tables are missing. Follow these simple steps to set them up:

## Quick Setup (2 minutes)

### Step 1: Go to Supabase

1. Open your browser and go to: https://supabase.com
2. Log in to your account
3. Select your project

### Step 2: Run the SQL Migration

1. In the left sidebar, click **"SQL Editor"**
2. Click **"New Query"**
3. Copy the entire contents of the file: `telegram-bot/migrations/create_post_queue.sql`
4. Paste it into the SQL Editor
5. Click **"Run"** (or press Ctrl+Enter)

You should see: ✅ **"Success. No rows returned"**

### Step 3: Verify Tables Were Created

1. In the left sidebar, click **"Table Editor"**
2. You should now see two new tables:
   - ✅ `reposts` - For tracking posted messages (deduplication)
   - ✅ `post_queue` - For scheduled bulk posting

### Step 4: Restart Your Bot

```bash
# Stop the bot (press Ctrl+C in terminal)
# Then restart it:
npm start
```

## What These Tables Do

### `reposts` Table
- Tracks which messages have already been posted
- Prevents duplicate posts
- Stores message hashes for content deduplication

### `post_queue` Table
- Stores your bulk forwarded messages
- Manages the schedule (3 posts every 30 minutes)
- Tracks which messages are pending, posted, or failed

## Troubleshooting

### If you still see errors after running the SQL:

1. **Check your Supabase URL and Key**
   - Make sure they're correct in your `.env` file
   - Use `SUPABASE_SERVICE_ROLE_KEY` for full access

2. **Refresh Supabase Schema Cache**
   - Sometimes Supabase needs a moment to update
   - Wait 10 seconds and restart your bot

3. **Verify the SQL ran successfully**
   - Go to Supabase > Table Editor
   - Check that both `reposts` and `post_queue` tables exist
   - If not, try running the SQL again

### Need help?
The SQL file is located at: `telegram-bot/migrations/create_post_queue.sql`

Just copy and paste the entire file contents into Supabase SQL Editor and run it!

---

## That's it! 🎉

Once the tables are created, your bot will:
- ✅ Accept bulk messages (50-100 at a time)
- ✅ Automatically post 3 messages every 30 minutes
- ✅ Track all messages in the queue
- ✅ Prevent duplicate posts

Use `/queue` to check your queue status anytime!

