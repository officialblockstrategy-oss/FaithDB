const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'veri-purge',
    description: 'Enable or disable auto-kicking unverified members who still have only @everyone',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    dm_permission: false,
    options: [
      {
        name: 'enable',
        description: 'Enable the purge for members who remain unverified for a set number of days',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'days',
            description: 'How many days before an unverified member gets kicked',
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
        ],
      },
      {
        name: 'warn',
        description: 'Send a warning DM when an unverified member has less than this much time left before purge',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'hours-left',
            description: 'Minimum hours left before purge to send the warning',
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
          {
            name: 'text',
            description: 'Text to send in the DM warning',
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: 'disable',
        description: 'Disable the auto-purge for this server',
        type: ApplicationCommandOptionType.Subcommand,
      },
    ],
  },

  async execute(interaction, client, { verify, saveVerify }) {
    if (!interaction.inGuild() || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission to manage verification purges.', flags: 64 });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const current = verify.get(interaction.guildId) || {
      cleanChannels: [],
      channelId: null,
      roleId: null,
      word: '',
    };

    if (sub === 'disable') {
      verify.set(interaction.guildId, {
        ...current,
        purgeEnabled: false,
        purgeDays: Number(current.purgeDays) || 7,
      });
      saveVerify();
      await interaction.reply({ content: 'Verification purge disabled for this server.', flags: 64 });
      return;
    }

    if (sub === 'warn') {
      const hoursLeft = interaction.options.getInteger('hours-left', true);
      const warnText = interaction.options.getString('text', true);

      if (!Number.isInteger(hoursLeft) || hoursLeft < 0) {
        await interaction.reply({ content: 'Please choose a whole number of hours greater than or equal to zero.', flags: 64 });
        return;
      }

      verify.set(interaction.guildId, {
        ...current,
        purgeWarnEnabled: true,
        purgeWarnHours: hoursLeft,
        purgeWarnText: warnText,
      });
      saveVerify();

      await interaction.reply({
        content: `Purge warning configured for this server. Members within ${hoursLeft} hours of being kicked will receive a DM.`,
        flags: 64,
      });
      return;
    }

    const days = interaction.options.getInteger('days', true);
    if (!Number.isInteger(days) || days <= 0) {
      await interaction.reply({ content: 'Please choose a positive whole number of days.', flags: 64 });
      return;
    }

    if (!current.roleId) {
      await interaction.reply({
        content: 'Set up verification first with /verify setup so I know which role counts as verified.',
        flags: 64,
      });
      return;
    }

    verify.set(interaction.guildId, {
      ...current,
      purgeEnabled: true,
      purgeDays: days,
    });
    saveVerify();

    await interaction.reply({
      content: `Verification purge enabled for this server. Members with only @everyone for ${days} full days will be kicked.`,
      flags: 64,
    });
  },
};
