const { ApplicationCommandOptionType } = require('discord.js');
const { buildQuestEngine } = require('../services/questEngine');
const { addKudosEntry, getGuildKudos } = require('../services/kudosService');

module.exports = {
  data: {
    name: 'kudos',
    description: 'Award kudos to a member for something they did',
    dm_permission: false,
    options: [
      {
        name: 'to',
        description: 'Give kudos to a member',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'user',
            description: 'Member to give kudos to',
            type: ApplicationCommandOptionType.User,
            required: true,
          },
          {
            name: 'for',
            description: 'Why they earned the kudos',
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
    ],
  },

  async execute(interaction, client, { kudos, saveKudos, quests, saveQuests }) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command must be used in a server.', flags: 64 });
      return;
    }

    const sub = interaction.options.getSubcommand();
    if (sub !== 'to') {
      await interaction.reply({ content: 'Unknown kudos command.', flags: 64 });
      return;
    }

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('for', true).trim();
    const guildMap = kudos.get(interaction.guildId) || new Map();

    if (!reason || reason.length < 3) {
      await interaction.reply({ content: 'Please give a brief reason for the kudos award.', flags: 64 });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot give yourself kudos.', flags: 64 });
      return;
    }

    const current = getGuildKudos(guildMap, target.id);
    const lastManual = current.manual && current.manual.lastAt ? current.manual.lastAt : 0;
    const now = Date.now();
    if (now - lastManual < 60 * 60 * 1000) {
      await interaction.reply({ content: 'That member has already received kudos recently.', flags: 64 });
      return;
    }

    const giverCurrent = getGuildKudos(guildMap, interaction.user.id);
    const giverLast = giverCurrent.manual && giverCurrent.manual.lastAt ? giverCurrent.manual.lastAt : 0;
    if (now - giverLast < 10 * 60 * 1000) {
      await interaction.reply({ content: 'You are giving kudos too quickly. Please wait a bit.', flags: 64 });
      return;
    }

    const amount = 6;
    addKudosEntry(guildMap, target.id, amount, 'manual', `Awarded by ${interaction.user.id}: ${reason}`, now);
    const updated = getGuildKudos(guildMap, target.id);
    updated.manual = { ...(updated.manual || {}), lastAt: now, reason };
    guildMap.set(target.id, updated);

    const giverUpdated = getGuildKudos(guildMap, interaction.user.id);
    giverUpdated.manual = { ...(giverUpdated.manual || {}), lastAt: now };
    guildMap.set(interaction.user.id, giverUpdated);

    kudos.set(interaction.guildId, guildMap);
    saveKudos();

    const guildQuestState = quests.get(interaction.guildId) || { catalog: new Map(), memberProgress: new Map() };
    const questEngine = buildQuestEngine(guildQuestState);
    questEngine.recordKudos({ giverId: interaction.user.id, targetId: target.id, source: 'manual', now });
    quests.set(interaction.guildId, questEngine.state);
    saveQuests();

    await interaction.reply({ content: `${target.tag} earned ${amount} Kudos for: ${reason}`, flags: 64 });
  },
};
