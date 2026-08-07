const { ApplicationCommandOptionType, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: {
    name: 'verify',
    description: 'Manage verification',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    dm_permission: false,
    options: [
      {
        name: 'setup',
        description: 'Set the verification channel, word, and role',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'channel', description: 'Channel for the verify word', type: ApplicationCommandOptionType.Channel, required: true },
          { name: 'word', description: 'Word members type to verify', type: ApplicationCommandOptionType.String, required: true },
          { name: 'role', description: 'Role to give after verify', type: ApplicationCommandOptionType.Role, required: true },
        ],
      },
      {
        name: 'followup',
        description: 'Add a follow-up DM template',
        type: ApplicationCommandOptionType.Subcommand,
        options: [{ name: 'text', description: 'Follow-up message', type: ApplicationCommandOptionType.String, required: true }],
      },
      {
        name: 'clean',
        description: 'Auto-delete member messages in a channel',
        type: ApplicationCommandOptionType.Subcommand,
        options: [{ name: 'channel', description: 'Channel to keep clear', type: ApplicationCommandOptionType.Channel, required: true }],
      },
      {
        name: 'unclean',
        description: 'Disable auto-clean on a channel',
        type: ApplicationCommandOptionType.Subcommand,
        options: [{ name: 'channel', description: 'Channel to stop clearing', type: ApplicationCommandOptionType.Channel, required: true }],
      },
    ],
  },

  async execute(interaction, client, { verify, saveVerify, followups, saveFollowups, greetings, saveGreetings, panels, savePanels }) {
    // Verification and follow-up command handler.
    if (!interaction.inGuild() || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel', true);
      const word = interaction.options.getString('word', true);
      const role = interaction.options.getRole('role', true);

      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        await interaction.reply({ content: 'Pick a text channel.', ephemeral: true });
        return;
      }

      const old = verify.get(interaction.guildId) || {};
      verify.set(interaction.guildId, { ...old, channelId: channel.id, word, roleId: role.id, cleanChannels: old.cleanChannels || [] });
      saveVerify();
      await interaction.reply({ content: `Verification set for ${channel.toString()} with word \`${word}\`.`, ephemeral: true });
      return;
    }

    if (sub === 'followup') {
      const text = interaction.options.getString('text', true);
      const list = followups.get(interaction.guildId) || [];
      list.push(text);
      followups.set(interaction.guildId, list);
      saveFollowups();
      await interaction.reply({ content: `Added follow-up #${list.length}.`, ephemeral: true });
      return;
    }

    if (sub === 'clean') {
      const channel = interaction.options.getChannel('channel', true);
      const old = verify.get(interaction.guildId) || {};
      const cleanChannels = Array.isArray(old.cleanChannels) ? [...old.cleanChannels] : [];
      if (!cleanChannels.includes(channel.id)) cleanChannels.push(channel.id);
      verify.set(interaction.guildId, { ...old, cleanChannels });
      saveVerify();
      await interaction.reply({ content: `Auto-clean enabled for ${channel.toString()}.`, ephemeral: true });
      return;
    }

    if (sub === 'unclean') {
      const channel = interaction.options.getChannel('channel', true);
      const old = verify.get(interaction.guildId) || {};
      const cleanChannels = Array.isArray(old.cleanChannels) ? old.cleanChannels.filter((id) => id !== channel.id) : [];
      verify.set(interaction.guildId, { ...old, cleanChannels });
      saveVerify();
      await interaction.reply({ content: `Auto-clean disabled for ${channel.toString()}.`, ephemeral: true });
      return;
    }
  },
};
