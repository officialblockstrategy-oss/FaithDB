const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'followup',
    description: 'List or remove follow-up DM templates',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    dm_permission: false,
    options: [
      {
        name: 'list',
        description: 'List all follow-up messages',
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: 'delete',
        description: 'Delete a follow-up by number',
        type: ApplicationCommandOptionType.Subcommand,
        options: [{ name: 'number', description: 'Follow-up number', type: ApplicationCommandOptionType.Integer, required: true }],
      },
    ],
  },

  async execute(interaction, client, { followups, saveFollowups }) {
    // Requires Manage Server permission to inspect or remove follow-up DMs.
    if (!interaction.inGuild() || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const list = followups.get(interaction.guildId) || [];

    if (sub === 'list') {
      if (!list.length) {
        await interaction.reply({ content: 'No follow-ups yet.', ephemeral: true });
        return;
      }
      await interaction.reply({ content: `Follow-ups:\n${list.map((t, i) => `${i + 1}. ${t}`).join('\n')}`, ephemeral: true });
      return;
    }

    if (sub === 'delete') {
      const num = interaction.options.getInteger('number', true);
      if (num < 1 || num > list.length) {
        await interaction.reply({ content: 'That follow-up does not exist.', ephemeral: true });
        return;
      }
      list.splice(num - 1, 1);
      followups.set(interaction.guildId, list);
      saveFollowups();
      await interaction.reply({ content: 'Follow-up removed.', ephemeral: true });
      return;
    }
  },
};
