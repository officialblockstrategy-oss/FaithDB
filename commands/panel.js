// This module manages reaction role panels and is the main implementation behind the `/panel` command.
// It stores panel configuration, creates and edits panel embeds, and refreshes the select menus.
const {
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');

// Helper to extract a Discord message ID from a raw ID or message link.
function parseMessageId(input) {
  const match = input.match(/(\d{17,19})$/);
  return match ? match[1] : null;
}

// Convert escaped `\n` sequences into real newlines for embeds.
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
        ],
      },
      {
        name: 'edit',
        description: 'Edit an existing panel (at least one field required)',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'message_id',
            description: 'Message ID or link of the panel to edit',
            type: ApplicationCommandOptionType.String,
            required: true,
          },
          {
            name: 'title',
            description: 'New embed title',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'description',
            description: 'New embed description',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'color',
            description: 'New embed color as hex (e.g. #5865F2)',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'author_name',
            description: 'New author text',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'author_icon_url',
            description: 'New author icon URL',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'thumbnail_url',
            description: 'New thumbnail URL',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'image_url',
            description: 'New image URL',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'footer',
            description: 'New footer text',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'field1_name',
            description: 'New first field name',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'field1_value',
            description: 'New first field value',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'field2_name',
            description: 'New second field name',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
          {
            name: 'field2_value',
            description: 'New second field value',
            type: ApplicationCommandOptionType.String,
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

  async execute(interaction, client, { panels, savePanels }) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: 'You need Manage Roles permission to use this command.', ephemeral: true });
      return;
    }

    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleCreate(interaction, panels, savePanels);
        break;
      case 'edit':
        await handleEdit(interaction, panels, savePanels);
        break;
      case 'delete':
        await handleDelete(interaction, panels, savePanels);
        break;
      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  },
};

module.exports.handleAddRole = handleAddRole;
module.exports.handleRemoveRole = handleRemoveRole;
module.exports.parseMessageId = parseMessageId;

// Build the select menu component used by stored reaction role panels.
function buildSelectMenu(messageId, roles) {
  if (!Array.isArray(roles) || roles.length === 0) return null;

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`panel-${messageId}`)
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

// Build a static embed from stored panel configuration values.
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

// Create a new reaction role panel message and persist its configuration.
async function handleCreate(interaction, panels, savePanels) {
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
  
  const roleOptions = [];
  const embed = buildEmbed(title, description, color, authorName, authorIcon, thumbnail, image, footerText, field1Name, field1Value, field2Name, field2Value);
  const sendOptions = {};
  const hasEmbed = title || description || color || authorName || thumbnail || image || footerText || (field1Name && field1Value) || (field2Name && field2Value);
  if (hasEmbed) sendOptions.embeds = [embed];
  if (!hasEmbed) {
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

  panels.set(sent.id, config);
  savePanels();

  await interaction.reply({ content: 'Reaction role panel created.', ephemeral: true });
}

// Add a role to an existing reaction role panel and refresh the message component.
async function handleAddRole(interaction, panels, savePanels) {
  const rawId = interaction.options.getString('message_id', true);
  const messageId = parseMessageId(rawId);
  const role = interaction.options.getRole('role', true);
  const label = interaction.options.getString('label') || role.name;

  if (!messageId) {
    await interaction.reply({ content: 'Please provide a valid message ID or link.', ephemeral: true });
    return;
  }

  const config = panels.get(messageId);
  if (!config) {
    await interaction.reply({ content: 'No reaction role panel found for that message.', ephemeral: true });
    return;
  }

  if (config.roles.some((entry) => entry.roleId === role.id)) {
    await interaction.reply({ content: 'That role is already included in this panel.', ephemeral: true });
    return;
  }

  config.roles.push({ roleId: role.id, label, description: `Grant ${label}` });
  const refreshed = await refreshPanelMessage(interaction, config, panels, savePanels);
  if (!refreshed) {
    await interaction.reply({ content: 'The panel message no longer exists and was removed from storage.', ephemeral: true });
    return;
  }

  savePanels();
  await interaction.reply({ content: `Added ${role.name} to the reaction role panel.`, ephemeral: true });
}

// Remove a role from an existing reaction role panel and delete the panel if there are no roles left.
async function handleRemoveRole(interaction, panels, savePanels) {
  const rawId = interaction.options.getString('message_id', true);
  const messageId = parseMessageId(rawId);
  const role = interaction.options.getRole('role', true);

  if (!messageId) {
    await interaction.reply({ content: 'Please provide a valid message ID or link.', ephemeral: true });
    return;
  }

  const config = panels.get(messageId);
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
    panels.delete(messageId);
    savePanels();
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

  const refreshed = await refreshPanelMessage(interaction, config, panels, savePanels);
  if (!refreshed) {
    await interaction.reply({ content: `Removed ${role.name}, but the panel message no longer exists and was cleaned up.`, ephemeral: true });
    return;
  }

  savePanels();
  await interaction.reply({ content: `Removed ${role.name} from the panel.`, ephemeral: true });
}

// Edit the embed content of an existing reaction role panel and update the displayed message.
async function handleEdit(interaction, panels, savePanels) {
  const rawId = interaction.options.getString('message_id', true);
  const messageId = parseMessageId(rawId);

  if (!messageId) {
    await interaction.reply({ content: 'Please provide a valid message ID or link.', ephemeral: true });
    return;
  }

  const config = panels.get(messageId);
  if (!config) {
    await interaction.reply({ content: 'No reaction role panel found for that message.', ephemeral: true });
    return;
  }

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

  const hasChanges = title !== null || description !== null || color !== null || authorName !== null || authorIcon !== null || thumbnail !== null || image !== null || footerText !== null || field1Name !== null || field1Value !== null || field2Name !== null || field2Value !== null;

  if (!hasChanges) {
    await interaction.reply({ content: 'You must specify at least one field to edit.', ephemeral: true });
    return;
  }

  if (title !== null) config.title = title;
  if (description !== null) config.description = description;
  if (color !== null) config.color = color;
  if (authorName !== null) config.authorName = authorName;
  if (authorIcon !== null) config.authorIcon = authorIcon;
  if (thumbnail !== null) config.thumbnail = thumbnail;
  if (image !== null) config.image = image;
  if (footerText !== null) config.footerText = footerText;
  if (field1Name !== null) config.field1Name = field1Name;
  if (field1Value !== null) config.field1Value = field1Value;
  if (field2Name !== null) config.field2Name = field2Name;
  if (field2Value !== null) config.field2Value = field2Value;

  const refreshed = await refreshPanelMessage(interaction, config, panels, savePanels);
  if (!refreshed) {
    await interaction.reply({ content: 'The panel message no longer exists and was removed from storage.', ephemeral: true });
    return;
  }

  savePanels();
  await interaction.reply({ content: 'Panel updated.', ephemeral: true });
}

// Delete a panel record and remove the stored panel message from Discord.
async function handleDelete(interaction, panels, savePanels) {
  const rawId = interaction.options.getString('message_id', true);
  const messageId = parseMessageId(rawId);

  if (!messageId) {
    await interaction.reply({ content: 'Please provide a valid message ID or link.', ephemeral: true });
    return;
  }

  const config = panels.get(messageId);
  if (!config) {
    await interaction.reply({ content: 'No reaction role panel found for that message.', ephemeral: true });
    return;
  }

  panels.delete(messageId);
  savePanels();

  try {
    const channel = await interaction.client.channels.fetch(config.channelId);
    const message = await channel.messages.fetch(messageId);
    await message.delete().catch(() => {});
  } catch (error) {
    console.warn('Could not delete reaction role message:', error);
  }

  await interaction.reply({ content: 'Reaction role panel deleted.', ephemeral: true });
}

// Refresh the display for a stored panel after configuration changes.
async function refreshPanelMessage(interaction, config, panels, savePanels) {
  try {
    const channel = await interaction.client.channels.fetch(config.channelId);
    const message = await channel.messages.fetch(config.messageId);
    const menu = buildSelectMenu(config.messageId, config.roles);
    await message.edit({
      embeds: [buildEmbed(config.title, config.description, config.color, config.authorName, config.authorIcon, config.thumbnail, config.image, config.footerText, config.field1Name, config.field1Value, config.field2Name, config.field2Value)],
      components: menu ? [menu] : [],
    });
    return true;
  } catch (error) {
    // If message doesn't exist, clean up the orphaned config.
    if (error.code === 10008 || error.status === 404) {
      if (panels?.delete) panels.delete(config.messageId);
      if (typeof savePanels === 'function') savePanels();
      console.log(`Cleaned up orphaned reaction role panel: ${config.messageId}`);
      return false;
    }

    console.error('Failed to refresh reaction role message:', error);
    return true;
  }
}
