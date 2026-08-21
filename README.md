# Faith Discord Bot

A lean Discord bot focused on simple community utilities: verification, greeting flow, sticky messages, reaction-role panels, and a lightweight community kudos system.

## Current Scope

This bot is intentionally minimal and opinionated. The current active runtime is built around:

- verification and welcome flow
- sticky messages
- reaction-role panels
- member kudos tracking and profiles
- configurable bump detection and claim rewards

The goal is to keep the feature set small, predictable, and easy to maintain.

## Features

- Verification setup with a custom word and role assignment
- Follow-up DM templates after successful verification
- Auto-clean channels to remove non-bot member messages
- Welcome greetings with configurable text and channel
- Sticky messages that refresh automatically in a channel
- Reaction role panels for role selection
- Kudos rewards for:
  - active server engagement / chat time
  - server bumps
  - manual kudos awards
- Member profile command showing total kudos, rank, yapping time, bumps, and thank-you counts
- Leaderboard ranking for top kudos totals in the server
- Persistent JSON storage for all bot state

## Setup

1. Copy `.env.example` to `.env` and fill in your own values:
   - `BOT_TOKEN`
   - `CLIENT_ID`
   - `DATA_DIR` (optional, recommended in production; example: `/var/lib/faithdb-data`)
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the bot:
   ```bash
   node index.js
   ```

## Architecture

- `index.js`: loads the bot state, registers commands, and wires the events
- `commands/`: slash command modules for the active bot features
- `events/`: message, interaction, join, and delete handlers
- `services/kudosService.js`: reward logic, ranking math, and anti-farming checks
- `utils/storage.js`: JSON disk helpers
- `utils/tpl.js`: template rendering for verification follow-ups and greeting text

## Active Commands

### `/verify`
- `setup` — set verification channel, word, and role
- `followup` — add a follow-up DM template
- `clean` — enable auto-clean for a channel
- `unclean` — disable auto-clean for a channel

### `/greeting`
- `add` — add a greeting template
- `channel` — set the channel for greetings
- `list` — list all greeting templates
- `remove all` — remove all greetings
- `remove number` — remove greeting entries by number

### `/followup`
- `list` — list saved follow-up messages
- `delete` — delete a saved follow-up by number

### `/panel`
- `create` — create a new reaction-role panel
- `edit` — edit an existing panel
- `delete` — delete a panel
- `dashboard` — show active panels in this server
- `grant access` — grant or revoke panel access for a user or role (leave user/role empty to list current panel grants)

### `/rr`
- `add role` — add a role to an existing panel
- `remove role` — remove a role from a panel

### `/bump-detect-setup`
- configure the bump channel, posting user/bot, reward, and claim emoji
- clear the configured detection for a server with the `clear` flag

### `/bump-preview`
- send a quick preview of the bump claim button in a chosen channel

### `/sticky`
- `create text` — create a sticky text message in the current channel
- `create embed` — create a sticky embed in the current channel
- `edit text` — edit the sticky text
- `edit embed` — edit the sticky embed
- `delete` — delete the sticky in the current channel
- `grant access` — grant or revoke sticky access for a user or role (leave user/role empty to list current sticky grants)

### `/veri-purge`
- `enable <days>` — kick unverified users after they remain unverified for that many days
- `warn <hours-left> <text>` — send a DM warning when the purge is close
- `disable` — disable the purge for the server

### `/thank`
- `user` — who to thank
- `for` — reason for the thanks
- posts a temporary public confirmation panel that auto-deletes after 30 seconds
- includes a button so only the thanked member can view a private kudos confirmation
- member-accessible with a cooldown so it is not spammed

### `/leaderboard`
- show the top kudos totals in the server
- includes the calling member’s rank and total beneath the top 10

### `/profile`
- view total kudos
- view server rank
- view yapping time in the server
- view kudos received from others
- view bump count
- view thank-you count

### `/reset`
- `all` — clear saved bot data and delete stored panel messages

## Kudos System

The kudos system is intentionally conservative and low-abuse.

Rewards are based on:

- active engagement time in conversation
- server bumps
- limited manual member awards
- optional configured bump-claim rewards via the bump detection flow

The current logic includes anti-farming protections such as:

- limiting how often manual kudos can be given
- requiring spaced-out bump award windows
- only counting meaningful activity and reply events

## Data Storage

Persistent bot state sits under `data/`:

If `DATA_DIR` is set, the bot uses that folder instead of the local `data/` path. This is recommended for deployments where the repo directory is frequently reset.

This directory is intentionally local runtime state and is not committed to Git.

- `stickies.json` — sticky message state per channel
- `panels.json` — reaction-role panel configuration
- `greetings.json` — saved greeting templates per guild
- `followups.json` — saved follow-ups per guild
- `verify.json` — verification settings and clean-channel config
- `kudos.json` — member kudos totals and related metrics
- `command-access.json` — per-guild user/role allowlists for panel/sticky access
