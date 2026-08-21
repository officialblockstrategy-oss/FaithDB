const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

function formatKudosDisplay(value) {
  return Math.round(Number(value || 0));
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
      leaderboardRows.push(`${index + 1}. <@${entry.userId}> — ${formatKudosDisplay(entry.total)}`);
    }

    const userRankIndex = allEntries.findIndex((entry) => entry.userId === interaction.user.id);
    const userTotal = guildMap.get(interaction.user.id)?.total || 0;
    const userRankText = userRankIndex >= 0 ? `#${userRankIndex + 1}` : 'N/A';
    const currentUserMention = `<@${interaction.user.id}>`;

    embed.setDescription(
      leaderboardRows.join('\n') +
      '\n\n---\n' +
      `User: ${currentUserMention} \nRank: ${userRankText}  \nKudos: ${formatKudosDisplay(userTotal)}`
    );

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
