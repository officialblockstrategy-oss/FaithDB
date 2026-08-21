// Main bot startup file. This loads environment configuration, initializes the Discord client,
// loads saved data from disk, registers commands, and wires event handlers.
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const {
  ApplicationCommandPermissionType,
  Client,
  Collection,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  Partials,
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel],
});
client.commands = new Collection();

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const { ensureFolder, loadJson, saveJson, loadMap, saveMap } = require('./utils/storage');

ensureFolder(dataDir);
console.log(`Using data directory: ${dataDir}`);

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
const bumpDetection = new Map();
const bumpDetectionFile = path.join(dataDir, 'bump-detect.json');
const kudos = new Map();
const kudosFile = path.join(dataDir, 'kudos.json');
const quests = new Map();
const questsFile = path.join(dataDir, 'quests.json');
const commandAccess = new Map();
const commandAccessFile = path.join(dataDir, 'command-access.json');
const commandVisibilityConfig = {
  panel: { accessKey: 'panel' },
  panels: { accessKey: 'panel' },
  rr: { accessKey: 'panel' },
  sticky: { accessKey: 'sticky' },
};
let registeredCommandIds = new Map();

function loadStickies() {
  const loaded = loadMap(
    stickiesFile,
    (sticky) =>
      sticky &&
      typeof sticky.messageId === 'string' &&
      (
        typeof sticky.content === 'string' ||
        (sticky.embed === true && sticky.embedData && typeof sticky.embedData === 'object')
      )
  );
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

const { startVeriPurgeLoop } = require('./services/verificationPurge');

function loadBumpDetection() {
  const loaded = loadMap(bumpDetectionFile, (cfg) => cfg && typeof cfg === 'object');
  for (const [guildId, cfg] of loaded) {
    if (cfg && typeof cfg === 'object') {
      bumpDetection.set(guildId, {
        enabled: Boolean(cfg.enabled !== false),
        channelId: cfg.channelId || null,
        userId: cfg.userId || null,
        commandName: typeof cfg.commandName === 'string' ? cfg.commandName.toLowerCase() : null,
        successText: typeof cfg.successText === 'string' ? cfg.successText.toLowerCase() : '',
        reward: Number(cfg.reward) || 12,
        emoji: typeof cfg.emoji === 'string' && cfg.emoji.trim() ? cfg.emoji.trim() : '✅',
        updatedAt: Number(cfg.updatedAt) || Date.now(),
      });
    }
  }
  console.log(`Loaded ${bumpDetection.size} bump detection setup(s) from disk.`);
}

function saveBumpDetection() {
  saveMap(bumpDetectionFile, bumpDetection);
}

function loadKudos() {
  const raw = loadJson(kudosFile, {});
  for (const [guildId, entries] of Object.entries(raw || {})) {
    const guildMap = new Map();
    if (entries && typeof entries === 'object') {
      for (const [userId, entry] of Object.entries(entries)) {
        if (entry && typeof entry === 'object') {
          guildMap.set(userId, {
            total: Number(entry.total) || 0,
            history: Array.isArray(entry.history) ? entry.history : [],
            manual: entry.manual || {},
            gratitude: entry.gratitude || {},
            bump: entry.bump || {},
            activity: entry.activity || {},
          });
        }
      }
    }
    if (guildMap.size) {
      kudos.set(guildId, guildMap);
    }
  }
  const totalProfiles = [...kudos.values()].reduce((sum, map) => sum + map.size, 0);
  console.log(`Loaded ${totalProfiles} kudos profile(s) from disk.`);
}

function saveKudos() {
  const data = Object.fromEntries(
    [...kudos.entries()].map(([guildId, guildMap]) => [guildId, Object.fromEntries(guildMap)])
  );
  saveJson(kudosFile, data);
}

function loadQuests() {
  const raw = loadJson(questsFile, {});
  for (const [guildId, state] of Object.entries(raw || {})) {
    const catalog = new Map();
    const memberProgress = new Map();

    const guildCatalog = state && typeof state === 'object' && state.catalog && typeof state.catalog === 'object' ? state.catalog : {};
    for (const [questId, quest] of Object.entries(guildCatalog)) {
      if (quest && typeof quest === 'object') {
        catalog.set(questId, {
          id: quest.id || questId,
          title: typeof quest.title === 'string' ? quest.title : questId,
          description: typeof quest.description === 'string' ? quest.description : '',
          enabled: quest.enabled !== false,
          createdAt: Number(quest.createdAt) || Date.now(),
          ...quest,
        });
      }
    }

    const guildProgress = state && typeof state === 'object' && state.memberProgress && typeof state.memberProgress === 'object' ? state.memberProgress : {};
    for (const [userId, recordSet] of Object.entries(guildProgress)) {
      if (recordSet && typeof recordSet === 'object') {
        const userEntries = new Map();
        for (const [questId, record] of Object.entries(recordSet)) {
          if (record && typeof record === 'object') {
            userEntries.set(questId, {
              questId: record.questId || questId,
              completed: Boolean(record.completed),
              progress: Number(record.progress) || 0,
              completedAt: Number(record.completedAt) || null,
              updatedAt: Number(record.updatedAt) || Date.now(),
              ...record,
            });
          }
        }
        if (userEntries.size) {
          memberProgress.set(userId, userEntries);
        }
      }
    }

    if (catalog.size || memberProgress.size) {
      quests.set(guildId, { catalog, memberProgress });
    }
  }

  const totalQuestDefinitions = [...quests.values()].reduce((sum, guildState) => sum + guildState.catalog.size, 0);
  const totalQuestProgress = [...quests.values()].reduce((sum, guildState) => sum + [...guildState.memberProgress.values()].reduce((count, entries) => count + entries.size, 0), 0);
  console.log(`Loaded ${totalQuestDefinitions} quest definition(s) and ${totalQuestProgress} quest progress record(s) from disk.`);
}

function saveQuests() {
  const data = Object.fromEntries(
    [...quests.entries()].map(([guildId, guildState]) => [
      guildId,
      {
        catalog: Object.fromEntries(guildState.catalog || new Map()),
        memberProgress: Object.fromEntries(
          [...(guildState.memberProgress || new Map()).entries()].map(([userId, recordSet]) => [
            userId,
            Object.fromEntries(recordSet),
          ])
        ),
      },
    ])
  );
  saveJson(questsFile, data);
}

function loadCommandAccess() {
  const loaded = loadMap(commandAccessFile, (cfg) => cfg && typeof cfg === 'object');
  for (const [guildId, cfg] of loaded) {
    const panelUsers = Array.isArray(cfg?.panel?.users) ? cfg.panel.users.filter((id) => typeof id === 'string') : [];
    const panelRoles = Array.isArray(cfg?.panel?.roles) ? cfg.panel.roles.filter((id) => typeof id === 'string') : [];
    const stickyUsers = Array.isArray(cfg?.sticky?.users) ? cfg.sticky.users.filter((id) => typeof id === 'string') : [];
    const stickyRoles = Array.isArray(cfg?.sticky?.roles) ? cfg.sticky.roles.filter((id) => typeof id === 'string') : [];

    commandAccess.set(guildId, {
      panel: { users: [...new Set(panelUsers)], roles: [...new Set(panelRoles)] },
      sticky: { users: [...new Set(stickyUsers)], roles: [...new Set(stickyRoles)] },
    });
  }
  console.log(`Loaded ${commandAccess.size} command access profile(s) from disk.`);
}

function saveCommandAccess() {
  saveMap(commandAccessFile, commandAccess);
}

function normalizeCommandAccessBlock(accessProfile, accessKey) {
  const block = accessProfile?.[accessKey];

  return {
    users: Array.isArray(block?.users) ? [...new Set(block.users.filter((id) => typeof id === 'string'))] : [],
    roles: Array.isArray(block?.roles) ? [...new Set(block.roles.filter((id) => typeof id === 'string'))] : [],
  };
}

function buildCommandVisibilityPermissions(accessBlock) {
  return [
    ...accessBlock.roles.map((id) => ({
      id,
      type: ApplicationCommandPermissionType.Role,
      permission: true,
    })),
    ...accessBlock.users.map((id) => ({
      id,
      type: ApplicationCommandPermissionType.User,
      permission: true,
    })),
  ];
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
loadBumpDetection();
loadKudos();
loadQuests();
loadCommandAccess();

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

async function syncCommandVisibilityForGuild(guildId) {
  if (!guildId || !registeredCommandIds.size) {
    return;
  }

  const accessProfile = commandAccess.get(guildId) || {};
  const body = [];

  for (const [commandName, config] of Object.entries(commandVisibilityConfig)) {
    const commandId = registeredCommandIds.get(commandName);
    if (!commandId) {
      continue;
    }

    body.push({
      id: commandId,
      permissions: buildCommandVisibilityPermissions(
        normalizeCommandAccessBlock(accessProfile, config.accessKey)
      ),
    });
  }

  if (!body.length) {
    return;
  }

  await rest.put(Routes.guildApplicationCommandsPermissions(process.env.CLIENT_ID, guildId), { body });
}

(async () => {
  try {
    const registeredCommands = await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    registeredCommandIds = new Map(
      Array.isArray(registeredCommands)
        ? registeredCommands
            .filter((command) => command && typeof command.name === 'string' && typeof command.id === 'string')
            .map((command) => [command.name, command.id])
        : []
    );

    for (const guildId of commandAccess.keys()) {
      try {
        await syncCommandVisibilityForGuild(guildId);
      } catch (error) {
        console.error(`Failed to sync command visibility for guild ${guildId}:`, error);
      }
    }

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
  const context = {
    stickies,
    saveStickies,
    panels,
    savePanels,
    greetings,
    saveGreetings,
    followups,
    saveFollowups,
    verify,
    saveVerify,
    bumpDetection,
    saveBumpDetection,
    kudos,
    saveKudos,
    quests,
    saveQuests,
    commandAccess,
    saveCommandAccess,
    syncCommandVisibilityForGuild,
  };
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client, context));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client, context));
  }
}

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  startVeriPurgeLoop(client, verify, saveVerify);
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  startVeriPurgeLoop(client, verify, saveVerify);
});

client.login(process.env.BOT_TOKEN);
