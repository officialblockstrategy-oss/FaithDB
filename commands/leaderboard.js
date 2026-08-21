const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

function formatKudosDisplay(value) {
  return Math.round(Number(value || 0));
}

async function resolveLeaderboardName(interaction, userId) {
  let member = interaction.guild.members.cache.get(userId) || null;
  if (!member) {
    member = await interaction.guild.members.fetch(userId).catch(() => null);
  }

  if (member) {
    return member.displayName || member.user?.username || userId;
  }

  const user = await interaction.client.users.fetch(userId).catch(() => null);
  if (user) {
    return user.globalName || user.username || userId;
  }

  return `Unknown User (${userId})`;
}

module.exports = {
  data: {
    name: 'leaderboard',
    description: 'Show the top kudos totals in this server',
    dm_permission: false,
    options: [
      {
        name: 'limit',
        description: 'How many members to show',
        type: ApplicationCommandOptionType.Integer,
        required: false,
      },
    ],
  },

  async execute(interaction, client, { kudos }) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command must be used in a server.', flags: 64 });
      return;
    }

    const guildMap = kudos.get(interaction.guildId) || new Map();
    const limit = 10;

    const allEntries = [...guildMap.entries()]
      .map(([userId, data]) => ({
        userId,
        total: Number(data?.total || 0),
      }))
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total);

    const entries = allEntries.slice(0, limit);

    if (!entries.length) {
      await interaction.reply({ content: 'No kudos have been awarded in this server yet.', flags: 64 });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Server Leaderboard')
      .setColor(0xEB583B);

    const leaderboardRows = [];

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const name = await resolveLeaderboardName(interaction, entry.userId);
      leaderboardRows.push(`${index + 1}. ${name} — ${formatKudosDisplay(entry.total)}`);
    }

    const userRankIndex = allEntries.findIndex((entry) => entry.userId === interaction.user.id);
    const userTotal = guildMap.get(interaction.user.id)?.total || 0;
    const userRankText = userRankIndex >= 0 ? `#${userRankIndex + 1}` : 'N/A';
    const currentUserName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;

    embed.setDescription(
      leaderboardRows.join('\n') +
      '\n\n---\n' +
      `User: ${currentUserName} \nRank: ${userRankText}  \nKudos: ${formatKudosDisplay(userTotal)}`
    );

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
