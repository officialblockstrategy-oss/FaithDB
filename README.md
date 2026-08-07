# Faith Discord Bot

A Discord bot that supports server verification, welcome greetings, follow-up DMs, sticky messages, and reaction role panels.

## Features

- Verification channel setup with a custom word and role assignment
- Follow-up DM templates sent after verification
- Auto-clean channels where non-bot messages are deleted
- Join greetings with configurable messages and channel
- Sticky messages that re-post on new channel activity or can be edited in place
- Reaction role panels managed by `/panel` and extended by `/rr`
- Sticky and panel commands only appear for users with the required permissions
- Persistent JSON storage in `data/*.json`

## Setup

1. Create a `.env` file with:
   - `BOT_TOKEN`
   - `CLIENT_ID`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the bot:
   ```bash
   node index.js
   ```

## Architecture

- `index.js`: starts the bot, loads saved data, registers slash commands, and wires event handlers
- `commands/panel.js`: main reaction role panel manager for `/panel`
- `commands/rr.js`: wrapper for `/rr add role` and `/rr remove role`
- `commands/sticky.js`: sticky text/embed creation, editing, and removal
- `events/`: event handlers for interactions, messages, joins, and deletions
- `utils/storage.js`: disk persistence helpers for JSON files
- `utils/tpl.js`: template renderer for greeting and follow-up messages

## Command Summary

### `/verify`
- `setup` — Set verification channel, word, and role
- `followup` — Add a follow-up DM template sent after successful verification
- `clean` — Enable auto-clean for a channel (deletes non-bot messages)
- `unclean` — Disable auto-clean for a channel

### `/greeting`
- `add` — Add a welcome message template
- `channel` — Set the channel for join greetings
- `list` — List saved greetings
- `remove all` — Remove all greetings
- `remove number` — Remove greeting(s) by index

### `/followup`
- `list` — List saved follow-up DMs
- `delete` — Delete a follow-up by number

### `/panel`
- `create` — Create a new reaction role panel embed message; opens a modal when no options are provided for multiline title/description/footer input
- `edit` — Edit an existing panel embed message; opens a modal if no edit fields are passed
- `delete` — Delete a panel and remove its message
- `dashboard` — Show active reaction role panels in the server and panel links

### `/rr`
- `add role` — Add a role to an existing panel
- `remove role` — Remove a role from an existing panel

### `/sticky`
- `create text` — Create a sticky text message in the current channel
- `create embed` — Create a sticky embed message in the current channel
- `edit text` — Edit the existing sticky text message
- `edit embed` — Edit the existing sticky embed message
- `delete` — Delete the sticky for the current channel

### `/reset`
- `all` — Clear all saved data and delete stored panel messages

## Template placeholders (`utils/tpl.js`)

`tpl.js` renders greeting and follow-up messages using these supported placeholders:

- `<$user>` → display name
- `<@user>` / `<@!user>` → mention of the member
- `{{user}}` / `{{username}}` → username
- `{{name}}` / `{{displayname}}` → display name
- `{{mention}}` → mention of the member
- `{{server}}` → server name
- `{{word}}` → verification word
- `{{channel}}` → channel mention or channel text
- `{{role}}` → role mention

Newline escape sequences like `\n` become actual newlines.

## Data Storage

Persistent bot data is stored in `data/`:

- `stickies.json` — current sticky message state per channel
- `panels.json` — saved reaction-role panel configuration and role mapping
- `greetings.json` — saved welcome greetings per guild
- `followups.json` — saved follow-up DM templates per guild
- `verify.json` — verification channel, word, role, and clean-channel settings

## Notes

- The public command is `/panel`, while `/rr` is a secondary add/remove helper for panel role lists.
- Sticky embed edits preserve any existing embed fields and values when you omit them.
- The verification flow can send follow-up DMs and delete any member messages in configured clean channels.
