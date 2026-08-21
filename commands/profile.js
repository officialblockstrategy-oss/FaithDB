const { ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { getGuildKudos, getProfileMetrics } = require('../services/kudosService');

function formatKudosDisplay(value) {
  return Math.round(Number(value || 0));
}

function buildProfileEmbed(guildMap, targetUserId, displayName) {
  const metrics = getProfileMetrics(guildMap, targetUserId);
  const allEntries = [...guildMap.entries()]
    .map(([userId, data]) => ({ userId, total: Number(data?.total || 0) }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total);

  const rankIndex = allEntries.findIndex((entry) => entry.userId === targetUserId);
  const rankText = rankIndex >= 0 ? `#${rankIndex + 1}` : 'Unranked';

  return new EmbedBuilder()
    .setTitle(`${displayName}'s Profile`)
    .setColor(0xEB583B)
    .setDescription([
      '```text',
      `Server Rank: ${rankText}`,
      `Total Kudos: ${formatKudosDisplay(metrics.total)}`,
      `Yap Timer: ${metrics.activityText}`,
      `Thanks Given: ${metrics.thanksGiven}`,
      `Thanks Received: ${metrics.thanksReceived}`,
      '```',
    ].join('\n'));
}

function buildProfileNavigation(guildId, userId) {
  const leftButton = new ButtonBuilder()
    .setCustomId(`nav-profile:${guildId}:${userId}`)
    .setEmoji('⬅️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const rightButton = new ButtonBuilder()
    .setCustomId(`nav-streak:${guildId}:${userId}`)
    .setEmoji('➡️')
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder().addComponents(leftButton, rightButton);
}

function buildProfileNavRow(guildId, userId, current = 'profile') {
  const leftDisabled = current === 'profile';
  const rightDisabled = current === 'streak';

  const leftButton = new ButtonBuilder()
    .setCustomId(`nav-profile:${guildId}:${userId}`)
    .setEmoji('⬅️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(leftDisabled);

  const rightButton = new ButtonBuilder()
    .setCustomId(`nav-streak:${guildId}:${userId}`)
    .setEmoji('➡️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(rightDisabled);

  return new ActionRowBuilder().addComponents(leftButton, rightButton);
}

function getBumpStats(guildMap, userId) {
  const record = getGuildKudos(guildMap, userId);
  const history = Array.isArray(record?.bump?.history) ? record.bump.history : [];
  const uniqueDays = [...new Set(history.map((timestamp) => new Date(Number(timestamp)).toISOString().slice(0, 10)))];

  let streak = 0;
  const today = new Date();
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (uniqueDays.includes(iso)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  const perDayCounts = history.reduce((map, timestamp) => {
    const iso = new Date(Number(timestamp)).toISOString().slice(0, 10);
    map[iso] = (map[iso] || 0) + 1;
    return map;
  }, {});

  const bestDayCount = Object.values(perDayCounts).reduce((max, count) => Math.max(max, count), 0);

  return {
    streak,
    bestDayCount,
    totalBumps: history.length,
  };
}

function buildStreakEmbed(guildMap, userId) {
  const stats = getBumpStats(guildMap, userId);

  return new EmbedBuilder()
    .setTitle('Bump Streak')
    .setColor(0xEB583B)
    .setDescription([
      '```text',
      `Current Streak: ${stats.streak} day${stats.streak === 1 ? '' : 's'}`,
      `Best Day: ${stats.bestDayCount} bumps`,
      `Total Bumps: ${stats.totalBumps}`,
      '```',
    ].join('\n'));
}

module.exports = {
  data: {
    name: 'profile',
    description: 'View a member’s profile and activity stats',
    dm_permission: false,
    options: [
      {
        name: 'user',
        description: 'Member to inspect',
        type: ApplicationCommandOptionType.User,
        required: false,
      },
    ],
  },

  async execute(interaction, client, { kudos }) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command must be used in a server.', flags: 64 });
      return;
    }

    const target = interaction.options.getUser('user') || interaction.user;
    const guildMap = kudos.get(interaction.guildId) || new Map();
    const name = interaction.guild.members.cache.get(target.id)?.displayName || target.username;
    const embed = buildProfileEmbed(guildMap, target.id, name);

    await interaction.reply({
      embeds: [embed],
      components: [buildProfileNavigation(interaction.guildId, target.id)],
      flags: 64,
    });
  },
};

module.exports.buildProfileEmbed = buildProfileEmbed;
module.exports.buildProfileNavRow = buildProfileNavRow;
module.exports.buildStreakEmbed = buildStreakEmbed;
