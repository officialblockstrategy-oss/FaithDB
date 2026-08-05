# Faith Discord Bot

A Discord bot that supports server verification, welcome greetings, follow-up DMs, sticky messages, and reaction role panels.

## Features

- Verification channel setup with a custom word and role assignment
- Follow-up DM templates sent after verification
- Auto-clean channels where non-bot messages are deleted
- Join greetings with configurable messages and channel
- Sticky messages that re-post on new channel activity
- Reaction role panels using select menus
- Persistent storage in `data/*.json`

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

## Command Summary

### `/verify`
- `setup` — Set verification channel, word, and role
- `followup` — Add a follow-up DM template
- `clean` — Enable auto-clean for a channel
- `unclean` — Disable auto-clean for a channel

### `/greeting`
- `add` — Add a welcome message template
- `channel` — Set a channel for welcome messages
- `list` — List saved greetings
- `remove all` — Remove all greetings
- `remove number` — Remove greeting(s) by index

### `/followup`
- `list` — List saved follow-up messages
- `delete` — Delete a follow-up by number

### `/panel`
- `create` — Create a new reaction role panel message
- `edit` — Edit an existing panel embed
- `delete` — Delete a reaction role panel

### `/rr`
- `add role` — Add a role to an existing panel
- `remove role` — Remove a role from an existing panel

### `/sticky`
- `create text` — Create a sticky text message in the current channel
- `create embed` — Create a sticky embed message
- `delete` — Delete the sticky for the current channel

### `/reset`
- `all` — Clear all saved data and delete stored reaction role panels

## Template placeholders (`utils/tpl.js`)

`tpl.js` is used to render greeting and follow-up messages. These placeholders are supported in stored templates:

- `<$user>` → display name
- `<@user>` / `<@!user>` → mention of the member
- `{{user}}` / `{{username}}` → username
- `{{name}}` / `{{displayname}}` → display name
- `{{mention}}` → mention of the member
- `{{server}}` → server name
- `{{word}}` → verification word
- `{{channel}}` → channel mention or channel text
- `{{role}}` → role mention

Newline escape sequences like `\n` are converted into real newline characters.

## Data Storage

Persistent bot data is stored in `data/`:

- `stickies.json`
- `panels.json`
- `greetings.json`
- `followups.json`
- `verify.json`

## File structure

- `index.js` — bot startup, command registration, and event wiring
- `commands/` — slash command definitions and implementations
- `events/` — Discord event handlers
- `utils/` — storage and template rendering helpers
