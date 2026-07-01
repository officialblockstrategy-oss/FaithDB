const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.commands = new Collection();

const stickies = new Map();
const stickiesFile = path.join(__dirname, 'stickies.json');

function loadStickies() {
  if (!fs.existsSync(stickiesFile)) return;
  try {
    const raw = fs.readFileSync(stickiesFile, 'utf8');
    const data = JSON.parse(raw);
    for (const [channelId, sticky] of Object.entries(data)) {
      if (sticky && typeof sticky.content === 'string') {
        stickies.set(channelId, sticky);
      }
    }
    console.log(`Loaded ${stickies.size} sticky(s) from disk.`);
  } catch (error) {
    console.error('Failed to load stickies:', error);
  }
}

function saveStickies() {
  try {
    fs.writeFileSync(stickiesFile, JSON.stringify(Object.fromEntries(stickies), null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save stickies:', error);
  }
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
  commands.push(command.data);
}

loadStickies();

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('Slash commands registered.');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
})();

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client, { stickies, saveStickies }));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client, { stickies, saveStickies }));
  }
}

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

client.login(process.env.BOT_TOKEN);
