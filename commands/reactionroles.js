const {
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');

function parseMessageId(input) {
  const match = input.match(/(\d{17,19})$/);
  return match ? match[1] : null;
}

function decodeEscapes(value) {
  return typeof value === 'string' ? value.replace(/\\n/g, '\n') : value;
}

module.exports = {
  data: {
    name: 'panel',
    description: 'Manage reaction role panels',
    options: [
      {
        name: 'create',
        description: 'Create a new panel (title and description optional)',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'title',
            description: 'Embed title',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'description',
            description: 'Embed description',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'color',
            description: 'Embed color as hex (e.g. #5865F2)',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'author_name',
            description: 'Author text at the top of the embed',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'author_icon_url',
            description: 'URL for author icon',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'thumbnail_url',
            description: 'Embed thumbnail URL',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'image_url',
            description: 'Embed image URL',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'footer',
            description: 'Embed footer text',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'field1_name',
            description: 'Optional first field name',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'field1_value',
            description: 'Optional first field value',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'field2_name',
            description: 'Optional second field name',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'field2_value',
            description: 'Optional second field value',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'role1',
            description: 'Optional role to include in the menu',
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: 'role2',
            description: 'Optional extra role',
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: 'role3',
            description: 'Optional extra role',
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: 'role4',
            description: 'Optional extra role',
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
          {
            name: 'role5',
            description: 'Optional extra role',
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
        ],
      },
      {
        name: 'delete',
        description: 'Delete an existing reaction-role panel',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'message_id',
            description: 'Message ID or link of the reaction-role message',
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
    ],
  },

  async execute(interaction, client, { reactionRoles, saveReactionRoles }) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: 'You need Manage Roles permission to use this command.', ephemeral: true });
      return;
    }

    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleCreate(interaction, reactionRoles, saveReactionRoles);
        break;
      case 'delete':
        await handleDelete(interaction, reactionRoles, saveReactionRoles);
        break;
      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  },
};

module.exports.handleAddRole = handleAddRole;
module.exports.handleRemoveRole = handleRemoveRole;
module.exports.parseMessageId = parseMessageId;

function buildSelectMenu(messageId, roles) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`reactionroles-${messageId}`)
      .setPlaceholder('Choose your roles')
      .setMinValues(0)
      .setMaxValues(roles.length)
      .addOptions(
        roles.map((role) => ({
          label: role.label,
          value: role.roleId,
          description: role.description || undefined,
        }))
      )
  );
}

function buildEmbed(title, description, color, authorName, authorIcon, thumbnail, image, footerText, field1Name, field1Value, field2Name, field2Value) {
  const embed = new EmbedBuilder()
    .setTitle(decodeEscapes(title))
    .setDescription(decodeEscapes(description));

  if (color) {
    const parsed = color.replace(/^#/, '');
    if (/^[0-9A-Fa-f]{6}$/.test(parsed)) {
      embed.setColor(parseInt(parsed, 16));
    }
  }

  if (authorName) {
    embed.setAuthor({ name: decodeEscapes(authorName), iconURL: authorIcon || undefined });
  }

  if (thumbnail) {
    embed.setThumbnail(decodeEscapes(thumbnail));
  }

  if (image) {
    embed.setImage(decodeEscapes(image));
  }

  if (footerText) {
    embed.setFooter({ text: decodeEscapes(footerText) });
  }

  if (field1Name && field1Value) {
    embed.addFields({ name: decodeEscapes(field1Name), value: decodeEscapes(field1Value), inline: false });
  }

  if (field2Name && field2Value) {
    embed.addFields({ name: decodeEscapes(field2Name), value: decodeEscapes(field2Value), inline: false });
  }

  return embed;
}

async function handleCreate(interaction, reactionRoles, saveReactionRoles) {
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  const color = interaction.options.getString('color');
  const authorName = interaction.options.getString('author_name');
  const authorIcon = interaction.options.getString('author_icon_url');
  const thumbnail = interaction.options.getString('thumbnail_url');
  const image = interaction.options.getString('image_url');
  const footerText = interaction.options.getString('footer');
  const field1Name = interaction.options.getString('field1_name');
  const field1Value = interaction.options.getString('field1_value');
  const field2Name = interaction.options.getString('field2_name');
  const field2Value = interaction.options.getString('field2_value');
  
  const roleIds = [];
  for (let i = 1; i <= 5; i += 1) {
    const role = interaction.options.getRole(`role${i}`);
    if (role) roleIds.push(role);
  }

  const roleOptions = roleIds.map((role) => ({
    roleId: role.id,
    label: role.name,
    description: `Grant ${role.name}`,
  }));

  const embed = buildEmbed(title, description, color, authorName, authorIcon, thumbnail, image, footerText, field1Name, field1Value, field2Name, field2Value);
  const sendOptions = {};
  const hasEmbed = title || description || color || authorName || thumbnail || image || footerText || (field1Name && field1Value) || (field2Name && field2Value);
  if (hasEmbed) sendOptions.embeds = [embed];
  if (roleOptions.length > 0) {
    const menu = buildSelectMenu('temp', roleOptions);
    if (menu) sendOptions.components = [menu];
  }
  if (!sendOptions.embeds && !sendOptions.content) {
    sendOptions.content = 'Reaction role panel created. Add roles with /rr add role <message_id>.';
  }

  const sent = await interaction.channel.send(sendOptions);
  if (roleOptions.length > 0) {
    const components = [buildSelectMenu(sent.id, roleOptions)];
    await sent.edit({ components });
  }

  const config = {
    messageId: sent.id,
    channelId: interaction.channel.id,
    title,
    description,
    color,
    authorName,
    authorIcon,
    thumbnail,
    image,
    footerText,
    field1Name,
    field1Value,
    field2Name,
    field2Value,
    roles: roleOptions,
  };

  reactionRoles.set(sent.id, config);
  saveReactionRoles();

  await interaction.reply({ content: 'Reaction role panel created.', ephemeral: true });
}

async function handleAddRole(interaction, reactionRoles, saveReactionRoles) {
  const rawId = interaction.options.getString('message_id', true);
  const messageId = parseMessageId(rawId);
  const role = interaction.options.getRole('role', true);
  const label = interaction.options.getString('label') || role.name;

  if (!messageId) {
    await interaction.reply({ content: 'Please provide a valid message ID or link.', ephemeral: true });
    return;
  }

  const config = reactionRoles.get(messageId);
  if (!config) {
    await interaction.reply({ content: 'No reaction role panel found for that message.', ephemeral: true });
    return;
  }

  if (config.roles.some((entry) => entry.roleId === role.id)) {
    await interaction.reply({ content: 'That role is already included in this panel.', ephemeral: true });
    return;
  }

  config.roles.push({ roleId: role.id, label, description: `Grant ${label}` });
  await refreshReactionRoleMessage(interaction, config, reactionRoles, saveReactionRoles);

  reactionRoles.set(messageId, config);
  saveReactionRoles();

  await interaction.reply({ content: `Added ${role.name} to the reaction role panel.`, ephemeral: true });
}

async function handleRemoveRole(interaction, reactionRoles, saveReactionRoles) {
  const rawId = interaction.options.getString('message_id', true);
  const messageId = parseMessageId(rawId);
  const role = interaction.options.getRole('role', true);

  if (!messageId) {
    await interaction.reply({ content: 'Please provide a valid message ID or link.', ephemeral: true });
    return;
  }

  const config = reactionRoles.get(messageId);
  if (!config) {
    await interaction.reply({ content: 'No reaction role panel found for that message.', ephemeral: true });
    return;
  }

  const index = config.roles.findIndex((entry) => entry.roleId === role.id);
  if (index === -1) {
    await interaction.reply({ content: 'That role is not part of this panel.', ephemeral: true });
    return;
  }

  config.roles.splice(index, 1);
  if (config.roles.length === 0) {
    reactionRoles.delete(messageId);
    saveReactionRoles();
    try {
      const channel = await interaction.client.channels.fetch(config.channelId);
      const message = await channel.messages.fetch(messageId);
      await message.delete().catch(() => {});
    } catch (error) {
      console.warn('Could not delete reaction role message after removing the last role:', error);
    }
    await interaction.reply({ content: 'Removed the last role and deleted the panel.', ephemeral: true });
    return;
  }

  await refreshReactionRoleMessage(interaction, config, reactionRoles, saveReactionRoles, reactionRoles, saveReactionRoles);
  reactionRoles.set(messageId, config);
  saveReactionRoles();

  await interaction.reply({ content: `Removed ${role.name} from the panel.`, ephemeral: true });
}

async function handleDelete(interaction, reactionRoles, saveReactionRoles) {
  const rawId = interaction.options.getString('message_id', true);
  const messageId = parseMessageId(rawId);

  if (!messageId) {
    await interaction.reply({ content: 'Please provide a valid message ID or link.', ephemeral: true });
    return;
  }

  const config = reactionRoles.get(messageId);
  if (!config) {
    await interaction.reply({ content: 'No reaction role panel found for that message.', ephemeral: true });
    return;
  }

  reactionRoles.delete(messageId);
  saveReactionRoles();

  try {
    const channel = await interaction.client.channels.fetch(config.channelId);
    const message = await channel.messages.fetch(messageId);
    await message.delete().catch(() => {});
  } catch (error) {
    console.warn('Could not delete reaction role message:', error);
  }

  await interaction.reply({ content: 'Reaction role panel deleted.', ephemeral: true });
}

async function refreshReactionRoleMessage(interaction, config, reactionRoles, saveReactionRoles) {
  try {
    const channel = await interaction.client.channels.fetch(config.channelId);
    const message = await channel.messages.fetch(config.messageId);
    await message.edit({
      embeds: [buildEmbed(config.title, config.description, config.color, config.authorName, config.authorIcon, config.thumbnail, config.image, config.footerText, config.field1Name, config.field1Value, config.field2Name, config.field2Value)],
      components: [buildSelectMenu(config.messageId, config.roles)],
    });
  } catch (error) {
    // If message doesn't exist, clean up the orphaned config
    if (error.code === 10008 || error.status === 404) {
      if (reactionRoles?.delete) reactionRoles.delete(config.messageId);
      if (typeof saveReactionRoles === 'function') saveReactionRoles();
      console.log(`Cleaned up orphaned reaction role panel: ${config.messageId}`);
    } else {
      console.error('Failed to refresh reaction role message:', error);
    }
  }
}
