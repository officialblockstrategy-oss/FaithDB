const { ApplicationCommandOptionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getQuestSummary } = require('../services/questsService');

const PAGE_SIZE = 5;

function buildQuestRow(guildId, userId, mode, page, totalPages) {
  const leftTargetPage = Math.max(0, page - 1);
  const rightTargetPage = Math.min(totalPages - 1, page + 1);

  const leftButton = new ButtonBuilder()
    .setCustomId(`quests-nav-left:${guildId}:${userId}:${mode}:${leftTargetPage}`)
    .setEmoji('⬅️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 0);

  const toggleButton = new ButtonBuilder()
    .setCustomId(`quests-toggle:${guildId}:${userId}:${mode}:${page}`)
    .setEmoji('🔄')
    .setStyle(ButtonStyle.Primary);

  const rightButton = new ButtonBuilder()
    .setCustomId(`quests-nav-right:${guildId}:${userId}:${mode}:${rightTargetPage}`)
    .setEmoji('➡️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1 || totalPages <= 1);

  return new ActionRowBuilder().addComponents(leftButton, toggleButton, rightButton);
}

function buildQuestPageLabel(mode) {
  return mode === 'finished' ? 'Finished Quests' : 'Unfinished Quests';
}

function buildQuestEmbed(memberName, mode, page, entries) {
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const pageEntries = entries.slice(start, start + PAGE_SIZE);

  const body = pageEntries.length
    ? pageEntries
        .map((quest, index) => {
          const number = start + index + 1;
          const status = mode === 'finished' ? 'Complete' : `${Math.min(quest.progress || 0, quest.goal || 1)}/${quest.goal || 1}`;
          return `${number}. ${quest.title} (${status})`;
        })
        .join('\n')
    : 'No quests in this panel yet.';

  return new EmbedBuilder()
    .setTitle(`${memberName}'s ${buildQuestPageLabel(mode)}`)
    .setColor(0xEB583B)
    .setDescription([
      '```text',
      `Page ${safePage + 1}/${totalPages}`,
      '',
      body,
      '```',
    ].join('\n'));
}

module.exports = {
  data: {
    name: 'quests',
    description: 'View your finished and unfinished quests',
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

  async execute(interaction, client, { quests }) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command must be used in a server.', flags: 64 });
      return;
    }

    const target = interaction.options.getUser('user') || interaction.user;
    const guildState = quests.get(interaction.guildId) || { catalog: new Map(), memberProgress: new Map() };
    const summary = getQuestSummary(guildState, target.id);
    const member = interaction.guild.members.cache.get(target.id) || null;
    const name = member?.displayName || target.username;
    const finishedEntries = [...summary.completed].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    const unfinishedEntries = [...summary.incomplete].sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    const mode = 'finished';
    const page = 0;
    const entries = mode === 'finished' ? finishedEntries : unfinishedEntries;
    const embed = buildQuestEmbed(name, mode, page, entries);
    const row = buildQuestRow(interaction.guildId, target.id, mode, page, Math.max(1, Math.ceil(entries.length / PAGE_SIZE)));

    await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
  },
};

module.exports.buildQuestEmbed = buildQuestEmbed;
module.exports.buildQuestRow = buildQuestRow;
module.exports.PAGE_SIZE = PAGE_SIZE;
