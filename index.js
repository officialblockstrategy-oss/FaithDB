// Main bot startup file. This loads environment configuration, initializes the Discord client,
// loads saved data from disk, registers commands, and wires event handlers.
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { Client, Collection, GatewayIntentBits, REST, Routes, Partials } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel],
});
client.commands = new Collection();

const dataDir = path.join(__dirname, 'data');
const { ensureFolder, loadJson, saveJson } = require('./utils/storage');

ensureFolder(dataDir);

const stickies = new Map();
const stickiesFile = path.join(dataDir, 'stickies.json');
const panels = new Map();
const panelsFile = path.join(dataDir, 'panels.json');
const greetings = new Map();
const greetingsFile = path.join(dataDir, 'greetings.json');
const followups = new Map();
const followupsFile = path.join(dataDir, 'followups.json');
const verify = new Map();
const verifyFile = path.join(dataDir, 'verify.json');

// Load a JSON file into a Map, validating each entry and optionally transforming it.
function loadMap(filePath, validate, transform = (value) => value) {
  const data = loadJson(filePath, {});
  const map = new Map();
  for (const [key, value] of Object.entries(data)) {
    try {
      if (validate(value, key)) {
        map.set(key, transform(value, key));
      }
    } catch (error) {
      console.warn(`Skipping invalid data at ${key} in ${filePath}:`, error);
    }
  }
  return map;
}

function saveMap(filePath, map) {
  try {
    saveJson(filePath, Object.fromEntries(map));
  } catch (error) {
    console.error(`Failed to save ${filePath}:`, error);
  }
}

function loadStickies() {
  const loaded = loadMap(stickiesFile, (sticky) => sticky && typeof sticky.content === 'string');
  for (const [channelId, sticky] of loaded) stickies.set(channelId, sticky);
  console.log(`Loaded ${stickies.size} sticky(s) from disk.`);
}

function saveStickies() {
  saveMap(stickiesFile, stickies);
}

function loadPanels() {
  const loaded = loadMap(panelsFile, (config) => config && config.messageId && config.channelId && Array.isArray(config.roles));
  for (const [messageId, config] of loaded) panels.set(messageId, config);
  console.log(`Loaded ${panels.size} reaction role panel(s) from disk.`);
}

function savePanels() {
  saveMap(panelsFile, panels);
}

function loadGreetings() {
  const loaded = loadMap(greetingsFile, (cfg) => Array.isArray(cfg) || (cfg && Array.isArray(cfg.msgs)));
  for (const [guildId, cfg] of loaded) {
    if (Array.isArray(cfg)) {
      greetings.set(guildId, { msgs: cfg, channelId: null });
    } else {
      greetings.set(guildId, { msgs: cfg.msgs || [], channelId: cfg.channelId || null });
    }
  }
  console.log(`Loaded ${greetings.size} greeting profile(s) from disk.`);
}

function saveGreetings() {
  const data = Object.fromEntries(
    [...greetings.entries()].map(([guildId, cfg]) => [
      guildId,
      { msgs: Array.isArray(cfg?.msgs) ? cfg.msgs : [], channelId: cfg?.channelId || null },
    ])
  );
  saveJson(greetingsFile, data);
}

function loadFollowups() {
  const loaded = loadMap(followupsFile, (list) => Array.isArray(list));
  for (const [guildId, list] of loaded) followups.set(guildId, list);
  console.log(`Loaded ${followups.size} follow-up profile(s) from disk.`);
}

function saveFollowups() {
  saveMap(followupsFile, followups);
}

function loadVerify() {
  const loaded = loadMap(verifyFile, (cfg) => cfg && typeof cfg === 'object');
  for (const [guildId, cfg] of loaded) {
    const validVerify = cfg.channelId && cfg.roleId && typeof cfg.word === 'string';
    const validClean = Array.isArray(cfg.cleanChannels);
    if (validVerify || validClean) {
      verify.set(guildId, { cleanChannels: [], ...cfg });
    }
  }
  console.log(`Loaded ${verify.size} verification setup(s) from disk.`);
}

function saveVerify() {
  saveMap(verifyFile, verify);
}

// Load command modules from the commands directory and collect command definitions.
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
  commands.push(command.data);
}

loadStickies();
loadPanels();
loadGreetings();
loadFollowups();
loadVerify();

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('Slash commands registered.');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
})();

// Register event handlers from the events directory, passing shared data and save functions.
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  const context = { stickies, saveStickies, panels, savePanels, greetings, saveGreetings, followups, saveFollowups, verify, saveVerify };
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client, context));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client, context));
  }
}

client.once('clientReady', () => console.log(`Logged in as ${client.user.tag}`));

client.login(process.env.BOT_TOKEN);
