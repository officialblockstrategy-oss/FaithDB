// This module manages reaction role panels and is the main implementation behind the `/panel` command.
// Each panel is stored in memory keyed by its message ID and persisted to `data/panels.json`.
// The panel message is rendered as an embed plus a select menu. `/rr` adds and removes roles
// from the panel, while `/panel edit` updates the embed content itself.
const {
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
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
    default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    dm_permission: false,
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
      {
        name: 'dashboard',
        description: 'Show active reaction role panels in this server',
        type: ApplicationCommandOptionType.Subcommand,
      },
    ],
  },

  async execute(interaction, client, { panels, savePanels }) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: 'You need Manage Roles permission to use this command.', flags: 64 });
      return;
    }

    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create': {
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

        if (
          !title &&
          !description &&
          !color &&
          !authorName &&
          !authorIcon &&
          !thumbnail &&
          !image &&
          !footerText &&
          !field1Name &&
          !field1Value &&
          !field2Name &&
          !field2Value
        ) {
          await showCreateModal(interaction);
          return;
        }

        await handleCreate(interaction, panels, savePanels);
        break;
      }
      case 'edit': {
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

        if (
          !title &&
          !description &&
          !color &&
          !authorName &&
          !authorIcon &&
          !thumbnail &&
          !image &&
          !footerText &&
          !field1Name &&
          !field1Value &&
          !field2Name &&
          !field2Value
        ) {
          await showEditModal(interaction, panels);
          return;
        }

        await handleEdit(interaction, panels, savePanels);
        break;
      }
      case 'delete':
        await handleDelete(interaction, panels, savePanels);
        break;
      case 'dashboard':
        await handleDashboard(interaction, panels);
        break;
      default:
        await interaction.reply({ content: 'Unknown command.', flags: 64 });
    }
  },
};

module.exports.handleAddRole = handleAddRole;
module.exports.handleRemoveRole = handleRemoveRole;
module.exports.handleModalSubmit = handleModalSubmit;
module.exports.parseMessageId = parseMessageId;
module.exports.buildEmbed = buildEmbed;
module.exports.buildSelectMenu = buildSelectMenu;

function buildPanelModal(customId, title, values) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panel_title')
          .setLabel('Panel title')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(values.title || ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panel_description')
          .setLabel('Panel description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setValue(values.description || ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panel_footer')
          .setLabel('Footer text (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(values.footerText || ''),
      ),
    );
}

function getModalPanelValues(interaction) {
  return {
    title: interaction.fields.getTextInputValue('panel_title').trim() || null,
    description: interaction.fields.getTextInputValue('panel_description').trim() || null,
    footerText: interaction.fields.getTextInputValue('panel_footer').trim() || null,
  };
}

async function showCreateModal(interaction) {
  const modal = buildPanelModal('panel-create', 'Create Reaction Role Panel', {
    title: '',
    description: '',
    footerText: '',
  });

  await interaction.showModal(modal);
}

async function showEditModal(interaction, panels) {
  const rawId = interaction.options.getString('message_id', true);
  const messageId = parseMessageId(rawId);
  const config = panels.get(messageId);

  if (!config) {
    await interaction.reply({ content: 'No reaction role panel found for that message.', flags: 64 });
    return;
  }

  const modal = buildPanelModal(`panel-edit:${messageId}`, 'Edit Reaction Role Panel', {
    title: config.title || '',
    description: config.description || '',
    footerText: config.footerText || '',
  });

  await interaction.showModal(modal);
}

async function createPanelFromValues(interaction, panels, savePanels, config) {
  const sendOptions = {};
  const hasEmbed =
    config.title ||
    config.description ||
    config.color ||
    config.authorName ||
    config.authorIcon ||
    config.thumbnail ||
    config.image ||
    config.footerText ||
    (config.field1Name && config.field1Value) ||
    (config.field2Name && config.field2Value);

  const embed = buildEmbed(
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
  );

  if (hasEmbed) {
    sendOptions.embeds = [embed];
  } else {
    sendOptions.content = 'Reaction role panel created. Add roles with /rr add role <message_id>.';
  }

  const sent = await interaction.channel.send(sendOptions);

  const fullConfig = {
    messageId: sent.id,
    channelId: interaction.channel.id,
    title: config.title,
    description: config.description,
    color: config.color,
    authorName: config.authorName,
    authorIcon: config.authorIcon,
    thumbnail: config.thumbnail,
    image: config.image,
    footerText: config.footerText,
    field1Name: config.field1Name,
    field1Value: config.field1Value,
    field2Name: config.field2Name,
    field2Value: config.field2Value,
    roles: config.roles || [],
  };

  panels.set(sent.id, fullConfig);
  savePanels();

  await interaction.reply({ content: 'Reaction role panel created.', flags: 64 });
}

async function handleModalSubmit(interaction, panels, savePanels) {
  const [action, messageId] = interaction.customId.split(':');

  if (action === 'panel-create') {
    const values = getModalPanelValues(interaction);
    await createPanelFromValues(interaction, panels, savePanels, { ...values, roles: [] });
    return;
  }

  if (action === 'panel-edit' && messageId) {
    const config = panels.get(messageId);
    if (!config) {
      await interaction.reply({ content: 'No reaction role panel found for that message.', flags: 64 });
      return;
    }

    const values = getModalPanelValues(interaction);
    config.title = values.title;
    config.description = values.description;
    config.footerText = values.footerText;
    const refreshed = await refreshPanelMessage(interaction, config, panels, savePanels);
    if (!refreshed) {
      await interaction.reply({ content: 'The panel message no longer exists and was removed from storage.', flags: 64 });
      return;
    }

    savePanels();
    await interaction.reply({ content: 'Panel updated.', flags: 64 });
    return;
  }

  await interaction.reply({ content: 'Unknown panel modal submission.', flags: 64 });
}

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
// This helper normalizes escaped newlines and only applies values when provided.
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
// Panels are created immediately, but roles are added separately through `/rr add role`.
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

  const embed = buildEmbed(title, description, color, authorName, authorIcon, thumbnail, image, footerText, field1Name, field1Value, field2Name, field2Value);
  const sendOptions = {};
  const hasEmbed = title || description || color || authorName || thumbnail || image || footerText || (field1Name && field1Value) || (field2Name && field2Value);
  if (hasEmbed) sendOptions.embeds = [embed];
  if (!hasEmbed) {
    sendOptions.content = 'Reaction role panel created. Add roles with /rr add role <message_id>.';
  }

  const config = {
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
    roles: [],
  };

  await createPanelFromValues(interaction, panels, savePanels, config);
}

// Add a role to an existing reaction role panel and refresh the message component.
async function handleAddRole(interaction, panels, savePanels) {
  const rawId = interaction.options.getString('message_id', true);
  const messageId = parseMessageId(rawId);
  const rolesToAdd = [
    interaction.options.getRole('role', true),
    interaction.options.getRole('role_2'),
    interaction.options.getRole('role_3'),
    interaction.options.getRole('role_4'),
    interaction.options.getRole('role_5'),
  ].filter(Boolean);
  const primaryLabel = interaction.options.getString('label');

  if (!messageId) {
    await interaction.reply({ content: 'Please provide a valid message ID or link.', flags: 64 });
    return;
  }

  const config = panels.get(messageId);
  if (!config) {
    await interaction.reply({ content: 'No reaction role panel found for that message.', flags: 64 });
    return;
  }

  const uniqueRoles = [];
  const seenRoleIds = new Set();
  for (const role of rolesToAdd) {
    if (seenRoleIds.has(role.id)) continue;
    seenRoleIds.add(role.id);
    uniqueRoles.push(role);
  }

  const alreadyIncluded = uniqueRoles.filter((role) => config.roles.some((entry) => entry.roleId === role.id));
  const newRoles = uniqueRoles.filter((role) => !config.roles.some((entry) => entry.roleId === role.id));

  if (newRoles.length === 0) {
    const duplicateNames = alreadyIncluded.map((role) => role.name).join(', ');
    await interaction.reply({ content: duplicateNames ? `${duplicateNames} ${alreadyIncluded.length === 1 ? 'is' : 'are'} already included in this panel.` : 'Those roles are already included in this panel.', flags: 64 });
    return;
  }

  for (const role of newRoles) {
    const label = role.id === uniqueRoles[0].id && primaryLabel ? primaryLabel : role.name;
    config.roles.push({ roleId: role.id, label, description: `Grant ${label}` });
  }

  const refreshed = await refreshPanelMessage(interaction, config, panels, savePanels);
  if (!refreshed) {
    await interaction.reply({ content: 'The panel message no longer exists and was removed from storage.', flags: 64 });
    return;
  }

  savePanels();
  const addedNames = newRoles.map((role) => role.name).join(', ');
  const skippedNotice = alreadyIncluded.length
    ? ` Skipped already included: ${alreadyIncluded.map((role) => role.name).join(', ')}.`
    : '';
  await interaction.reply({ content: `Added ${addedNames} to the reaction role panel.${skippedNotice}`, flags: 64 });
}

// Remove a role from an existing reaction role panel and delete the panel if there are no roles left.
async function handleRemoveRole(interaction, panels, savePanels) {
  const rawId = interaction.options.getString('message_id', true);
  const messageId = parseMessageId(rawId);
  const role = interaction.options.getRole('role', true);

  if (!messageId) {
    await interaction.reply({ content: 'Please provide a valid message ID or link.', flags: 64 });
    return;
  }

  const config = panels.get(messageId);
  if (!config) {
    await interaction.reply({ content: 'No reaction role panel found for that message.', flags: 64 });
    return;
  }

  const index = config.roles.findIndex((entry) => entry.roleId === role.id);
  if (index === -1) {
    await interaction.reply({ content: 'That role is not part of this panel.', flags: 64 });
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
    await interaction.reply({ content: 'Removed the last role and deleted the panel.', flags: 64 });
    return;
  }

  const refreshed = await refreshPanelMessage(interaction, config, panels, savePanels);
  if (!refreshed) {
    await interaction.reply({ content: `Removed ${role.name}, but the panel message no longer exists and was cleaned up.`, flags: 64 });
    return;
  }

  savePanels();
  await interaction.reply({ content: `Removed ${role.name} from the panel.`, flags: 64 });
}

// Edit the embed content of an existing reaction role panel and update the displayed message.
async function handleEdit(interaction, panels, savePanels) {
  const rawId = interaction.options.getString('message_id', true);
  const messageId = parseMessageId(rawId);

  if (!messageId) {
    await interaction.reply({ content: 'Please provide a valid message ID or link.', flags: 64 });
    return;
  }

  const config = panels.get(messageId);
  if (!config) {
    await interaction.reply({ content: 'No reaction role panel found for that message.', flags: 64 });
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
    await interaction.reply({ content: 'You must specify at least one field to edit.', flags: 64 });
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
    await interaction.reply({ content: 'The panel message no longer exists and was removed from storage.', flags: 64 });
    return;
  }

  savePanels();
  await interaction.reply({ content: 'Panel updated.', flags: 64 });
}

// Delete a panel record and remove the stored panel message from Discord.
async function handleDelete(interaction, panels, savePanels) {
  const rawId = interaction.options.getString('message_id', true);
  const messageId = parseMessageId(rawId);

  if (!messageId) {
    await interaction.reply({ content: 'Please provide a valid message ID or link.', flags: 64 });
    return;
  }

  const config = panels.get(messageId);
  if (!config) {
    await interaction.reply({ content: 'No reaction role panel found for that message.', flags: 64 });
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

  await interaction.reply({ content: 'Reaction role panel deleted.', flags: 64 });
}

async function handleDashboard(interaction, panels) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: 'This command must be used in a server.', flags: 64 });
    return;
  }

  const panelEntries = [...panels.entries()].filter(([, config]) => config && config.channelId);
  if (!panelEntries.length) {
    await interaction.reply({ content: 'No active reaction role panels in this server.', flags: 64 });
    return;
  }

  const fields = [];
  const visibleEntries = panelEntries.slice(0, 20);

  for (let index = 0; index < visibleEntries.length; index += 1) {
    const [messageId, config] = visibleEntries[index];
    const channel = guild.channels.cache.get(config.channelId);
    const channelDisplay = channel ? channel.toString() : `Unknown channel (${config.channelId})`;
    const panelTitle = config.title ? config.title : 'Untitled panel';
    const description = config.description ? `\n${config.description}` : '';
    const roleCount = Array.isArray(config.roles) ? config.roles.length : 0;
    const link = `https://discord.com/channels/${guild.id}/${config.channelId}/${messageId}`;

    fields.push({
      name: `${index + 1}. ${panelTitle}`,
      value: `Channel: ${channelDisplay}\nMessage: [Open panel](${link})\nRoles: ${roleCount}${description}`,
    });
  }

  if (panelEntries.length > visibleEntries.length) {
    fields.push({
      name: 'More panels',
      value: `Showing ${visibleEntries.length} of ${panelEntries.length} panels. Use /panel delete <message_id> to remove old panels.`,
    });
  }

  const dashboardEmbed = new EmbedBuilder()
    .setTitle('Reaction Role Panel Dashboard')
    .setDescription(`${panelEntries.length} active panel${panelEntries.length === 1 ? '' : 's'} in this server.`)
    .addFields(fields)
    .setFooter({ text: 'Use /panel edit or /panel delete to manage panels.' });

  await interaction.reply({ embeds: [dashboardEmbed], flags: 64 });
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
