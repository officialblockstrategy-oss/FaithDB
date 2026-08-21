const { ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { getGuildKudos, getProfileMetrics } = require('../services/kudosService');

function formatKudosDisplay(value) {
  return Math.round(Number(value || 0));
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
    const record = getGuildKudos(guildMap, target.id);
    const metrics = getProfileMetrics(guildMap, target.id);
    const allEntries = [...guildMap.entries()]
      .map(([userId, data]) => ({ userId, total: Number(data?.total || 0) }))
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total);

    const rankIndex = allEntries.findIndex((entry) => entry.userId === target.id);
    const rankText = rankIndex >= 0 ? `#${rankIndex + 1}` : 'Unranked';
    const name = interaction.guild.members.cache.get(target.id)?.displayName || target.username;

    const embed = new EmbedBuilder()
      .setTitle(`${name}'s Profile`)
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

    await interaction.reply({
      embeds: [embed],
      components: [buildProfileNavigation(interaction.guildId, target.id)],
      flags: 64,
    });
  },
};
