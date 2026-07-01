// Load environment variables from .env (BOT_TOKEN, CLIENT_ID)
require('dotenv').config();

// Import only the parts of discord.js we need
const { Client, GatewayIntentBits, REST, Routes, ApplicationCommandOptionType } = require('discord.js');

// Create the bot client with intents required for guild messages and content
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// In-memory map: channelId -> { messageId, content }
// Keeps track of the currently posted sticky for each channel while the process runs
const stickies = new Map();

// Minimal slash commands: createsticky (with a 'message' string) and deletesticky
const commands = [
  {
    name: 'createsticky',
    description: 'Create a sticky message for this channel',
    options: [ { name: 'message', description: 'Message to stick', type: ApplicationCommandOptionType.String, required: true } ]
  },
  { name: 'deletesticky', description: 'Delete the sticky message in this channel' }
];

// Register application (slash) commands globally using REST
const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
(async () => {
  try { await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands }); }
  catch (e) { console.error('Failed to register commands:', e); }
})();

// Log when the bot is ready
client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

// Handle slash command interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return; // ignore non-chat-input interactions

  const ch = interaction.channel;

  // Create or replace the sticky for this channel
  if (interaction.commandName === 'createsticky') {
    const text = interaction.options.getString('message', true);

    // If there's an existing sticky message, attempt to delete it
    const prev = stickies.get(ch.id);
    if (prev) {
      try { const m = await ch.messages.fetch(prev.messageId); await m.delete().catch(() => {}); } catch {}
    }

    // Post the new sticky and record its id and content
    const sent = await ch.send(text);
    stickies.set(ch.id, { messageId: sent.id, content: text });

    // Acknowledge to the command issuer (ephemeral)
    await interaction.reply({ content: 'Sticky created.', ephemeral: true });
    return;
  }

  // Delete the stored sticky for this channel (and the bot message if present)
  if (interaction.commandName === 'deletesticky') {
    const prev = stickies.get(ch.id);
    if (!prev) { await interaction.reply({ content: 'No sticky set.', ephemeral: true }); return; }
    try { const m = await ch.messages.fetch(prev.messageId); await m.delete().catch(() => {}); } catch {}
    stickies.delete(ch.id);
    await interaction.reply({ content: 'Sticky deleted.', ephemeral: true });
    return;
  }
});

// On any user message, refresh the sticky so it appears as the latest bot message
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // ignore bot messages

  const prev = stickies.get(message.channel.id);
  if (!prev) return; // no sticky for this channel

  // Attempt to delete the previous sticky message, then re-send it
  try { const m = await message.channel.messages.fetch(prev.messageId); await m.delete().catch(() => {}); } catch {}
  const sent = await message.channel.send(prev.content);
  stickies.set(message.channel.id, { messageId: sent.id, content: prev.content });
});

// Start the bot
client.login(process.env.BOT_TOKEN);