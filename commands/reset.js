const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'reset',
    description: 'Reset all saved bot data',
    options: [
      {
        name: 'all',
        description: 'Clear all saved greetings, follow-ups, verification, and reaction-role data',
        type: ApplicationCommandOptionType.Subcommand,
      },
    ],
  },

  async execute(interaction, client, { greetings, saveGreetings, followups, saveFollowups, verify, saveVerify, reactionRoles, saveReactionRoles }) {
    if (!interaction.inGuild() || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    if (sub !== 'all') {
      await interaction.reply({ content: 'Unknown reset command.', ephemeral: true });
      return;
    }

    greetings.clear();
    followups.clear();
    verify.clear();
    reactionRoles.clear();
    saveGreetings();
    saveFollowups();
    saveVerify();
    saveReactionRoles();

    await interaction.reply({ content: 'All saved disk data has been cleared.', ephemeral: true });
  },
};
