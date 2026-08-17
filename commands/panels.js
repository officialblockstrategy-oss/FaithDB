const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');
const panel = require('./panel.js');

module.exports = {
  data: {
    name: 'panels',
    description: 'Manage saved reaction role panels',
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    dm_permission: false,
    options: [
      {
        name: 'finalize',
        description: 'Rebuild panel messages in channel order to remove edited badges and stack them cleanly',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'channel',
            description: 'Channel containing the panels to rebuild (defaults to the current channel)',
            type: ApplicationCommandOptionType.Channel,
            required: false,
          },
        ],
      },
    ],
  },

  async execute(interaction, client, context) {
    if (!interaction.inGuild() || !interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: 'You need Manage Roles permission to use this command.', flags: 64 });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'finalize') {
      await finalizePanels(interaction, context.panels, context.savePanels);
      return;
    }

    await interaction.reply({ content: 'Unknown command.', flags: 64 });
  },
};

async function finalizePanels(interaction, panels, savePanels) {
  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

  if (!targetChannel?.isTextBased?.()) {
    await interaction.reply({ content: 'Please choose a text channel.', flags: 64 });
    return;
  }

  const channelPanels = [...panels.entries()]
    .filter(([, config]) => config && config.channelId === targetChannel.id)
    .sort(([leftId], [rightId]) => {
      const left = BigInt(leftId);
      const right = BigInt(rightId);
      if (left === right) return 0;
      return left < right ? -1 : 1;
    });

  if (!channelPanels.length) {
    await interaction.reply({ content: 'No saved reaction role panels were found in that channel.', flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const createdMessages = [];
  const replacements = [];

  try {
    for (const [messageId, config] of channelPanels) {
      const menu = panel.buildSelectMenu(messageId, config.roles);
      const sent = await targetChannel.send({
        embeds: [
          panel.buildEmbed(
            config.title,
            config.description,
            config.color,
            config.authorName,
            config.authorIcon,
            config.thumbnail,
            config.image,
            config.footerText,
            config.field1Name,
            config.field1Value,
            config.field2Name,
            config.field2Value,
          ),
        ],
        components: menu ? [menu] : [],
      });

      createdMessages.push(sent);
      replacements.push({
        oldMessageId: messageId,
        newConfig: {
          ...config,
          messageId: sent.id,
          channelId: targetChannel.id,
        },
      });
    }
  } catch (error) {
    for (const message of createdMessages) {
      await message.delete().catch(() => {});
    }

    console.error('Failed to finalize reaction role panels:', error);
    await interaction.editReply('Failed to finalize the panels. No saved panel data was changed.');
    return;
  }

  for (const { oldMessageId, newConfig } of replacements) {
    panels.delete(oldMessageId);
    panels.set(newConfig.messageId, newConfig);
  }
  savePanels();

  let deletedCount = 0;
  for (const [messageId] of channelPanels) {
    try {
      const oldMessage = await targetChannel.messages.fetch(messageId);
      await oldMessage.delete().catch(() => {});
      deletedCount += 1;
    } catch (error) {
      if (error.code !== 10008 && error.status !== 404) {
        console.warn(`Could not delete old reaction role panel ${messageId}:`, error);
      }
    }
  }

  const skippedDeletes = channelPanels.length - deletedCount;
  const deleteNote = skippedDeletes > 0 ? ` ${skippedDeletes} old panel message${skippedDeletes === 1 ? ' was' : 's were'} already missing or could not be deleted.` : '';
  await interaction.editReply(`Finalized ${replacements.length} panel${replacements.length === 1 ? '' : 's'} in ${targetChannel}. They were reposted in sequence with their saved roles and content.${deleteNote}`);
}