const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'bump-detect-setup',
    description: 'Set the bump channel, bot/user, and reward for the claim flow',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    dm_permission: false,
    options: [
      {
        name: 'channel',
        description: 'Channel where the bump success message appears',
        type: ApplicationCommandOptionType.Channel,
        required: false,
      },
      {
        name: 'user',
        description: 'Bot or user that posts the bump success message',
        type: ApplicationCommandOptionType.User,
        required: false,
      },
      {
        name: 'reward',
        description: 'Kudos reward to give for a valid bump',
        type: ApplicationCommandOptionType.Integer,
        required: false,
      },
      {
        name: 'emoji',
        description: 'Emoji to react with after the kudos is claimed',
        type: ApplicationCommandOptionType.String,
        required: false,
      },
      {
        name: 'clear',
        description: 'Delete the bump detection settings for this server',
        type: ApplicationCommandOptionType.Boolean,
        required: false,
      },
    ],
  },

  async execute(interaction, client, { bumpDetection, saveBumpDetection }) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command must be used in a server.', flags: 64 });
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission to configure bump detection.', flags: 64 });
      return;
    }

    const clearFlag = interaction.options.getBoolean('clear');
    if (clearFlag) {
      bumpDetection.delete(interaction.guildId);
      saveBumpDetection();
      await interaction.reply({ content: 'Bump detection settings were cleared for this server.', flags: 64 });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    const user = interaction.options.getUser('user');
    const rewardValue = interaction.options.getInteger('reward');
    const emojiValue = interaction.options.getString('emoji');

    const current = bumpDetection.get(interaction.guildId) || {
      enabled: true,
      channelId: null,
      userId: null,
      commandName: null,
      successText: '',
      reward: 12,
      emoji: '✅',
      updatedAt: Date.now(),
    };

    if (channel) current.channelId = channel.id;
    if (user) current.userId = user.id;
    if (Number.isInteger(rewardValue) && rewardValue > 0) current.reward = rewardValue;
    if (typeof emojiValue === 'string' && emojiValue.trim()) {
      current.emoji = emojiValue.trim();
    }

    current.enabled = true;
    current.updatedAt = Date.now();
    bumpDetection.set(interaction.guildId, current);
    saveBumpDetection();

    const summary = [
      `Channel: ${current.channelId ? `<#${current.channelId}>` : 'not set'}`,
      `User: ${current.userId ? `<@${current.userId}>` : 'not set'}`,
      `Reward: ${current.reward}`,
      `Emoji: ${current.emoji || '✅'}`,
    ].join('\n');

    const hasAnyValue = Boolean(channel || user || Number.isInteger(rewardValue) || typeof emojiValue === 'string');
    if (!hasAnyValue) {
      await interaction.reply({
        content: `Bump detection is already configured for this server.\n${summary}\n\nUse any of the options you know, and leave the rest alone.`,
        flags: 64,
      });
      return;
    }

    await interaction.reply({ content: `Bump detection updated for this server:\n${summary}`, flags: 64 });
  },
};
