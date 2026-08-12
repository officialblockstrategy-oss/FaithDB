const { ApplicationCommandOptionType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: {
    name: 'bump-preview',
    description: 'Preview the bump claim menu in a channel',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    dm_permission: false,
    options: [
      {
        name: 'channel',
        description: 'Channel to send the preview message in',
        type: ApplicationCommandOptionType.Channel,
        required: false,
      },
      {
        name: 'user',
        description: 'Member to preview the claim for',
        type: ApplicationCommandOptionType.User,
        required: false,
      },
      {
        name: 'reward',
        description: 'Kudos value shown in the preview',
        type: ApplicationCommandOptionType.Integer,
        required: false,
      },
    ],
  },

  async execute(interaction, client, { bumpDetection }) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command must be used in a server.', flags: 64 });
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission to preview the bump menu.', flags: 64 });
      return;
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reward = interaction.options.getInteger('reward') || 12;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`claim-bump:${interaction.guildId}:preview:${reward}`)
        .setLabel('Claim Kudos')
        .setStyle(ButtonStyle.Success)
    );

    const previewText = 'Thanks for bumping the server! Click the button below to claim your kudos.';

    await channel.send({ content: previewText, components: [row] });
    await interaction.reply({ content: `Preview sent in ${channel}.`, flags: 64 });
  },
};
