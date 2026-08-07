const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'reset',
    description: 'Reset all saved bot data',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    dm_permission: false,
    options: [
      {
        name: 'all',
        description: 'Clear all saved greetings, follow-ups, verification, and reaction-role data',
        type: ApplicationCommandOptionType.Subcommand,
      },
    ],
  },

  async execute(interaction, client, { greetings, saveGreetings, followups, saveFollowups, verify, saveVerify, panels, savePanels }) {
    // Clears all persisted server data and attempts to delete stored panels from Discord.
    if (!interaction.inGuild() || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    if (sub !== 'all') {
      await interaction.reply({ content: 'Unknown reset command.', ephemeral: true });
      return;
    }

    const deletedPanels = [];
    for (const [messageId, config] of panels) {
      try {
        const channel = await client.channels.fetch(config.channelId);
        if (channel && channel.isTextBased?.()) {
          const message = await channel.messages.fetch(messageId);
          await message.delete().catch(() => {});
          deletedPanels.push(messageId);
        }
      } catch {
        // Ignore failures while trying to remove panels that are already gone or unreachable.
      }
    }

    greetings.clear();
    followups.clear();
    verify.clear();
    panels.clear();
    saveGreetings();
    saveFollowups();
    saveVerify();
    savePanels();

    const reply = deletedPanels.length
      ? `Cleared all saved disk data and deleted ${deletedPanels.length} panel${deletedPanels.length === 1 ? '' : 's'}.`
      : 'All saved disk data has been cleared.';

    await interaction.reply({ content: reply, ephemeral: true });
  },
};
