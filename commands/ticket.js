const {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  EmbedBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SectionBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextDisplayBuilder,
} = require('discord.js');

const TICKET_TYPES = {
  example_1: { label: 'Placeholder Header', emoji: '🎫', description: 'Description example text', questions: ['Example question'] },
  example_2: { label: 'Placeholder Header', emoji: '🎫', description: 'Description example text', questions: ['Example question'] },
  example_3: { label: 'Placeholder Header', emoji: '🎫', description: 'Description example text', questions: ['Example question'] },
  example_4: { label: 'Placeholder Header', emoji: '🎫', description: 'Description example text', questions: ['Example question'] },
  example_5: { label: 'Placeholder Header', emoji: '🎫', description: 'Description example text', questions: ['Example question'] },
  example_6: { label: 'Placeholder Header', emoji: '🎫', description: 'Description example text', questions: ['Example question'] },
  example_7: { label: 'Placeholder Header', emoji: '🎫', description: 'Description example text', questions: ['Example question'] },
  example_8: { label: 'Placeholder Header', emoji: '🎫', description: 'Description example text', questions: ['Example question'] },
  example_9: { label: 'Placeholder Header', emoji: '🎫', description: 'Description example text', questions: ['Example question'] },
  example_10: { label: 'Placeholder Header', emoji: '🎫', description: 'Description example text', questions: ['Example question'] },
};

const DEFAULT_PANEL = {
  imageUrl: 'https://placehold.co/1200x240/png?text=example.image.url',
  optionCount: 1,
  color: '#5865F2',
};

function normalizeProfile(config = {}) {
  const panel = { ...DEFAULT_PANEL, ...(config.panel || {}) };
  if (typeof panel.imageUrl !== 'string' || !/^https?:\/\//i.test(panel.imageUrl)) {
    panel.imageUrl = DEFAULT_PANEL.imageUrl;
  }
  if (config.panel && !Object.prototype.hasOwnProperty.call(config.panel, 'imageUrl')) {
    panel.optionCount = 1;
  }
  const content = {};
  for (const [type, definition] of Object.entries(TICKET_TYPES)) {
    const saved = config.content?.[type] || {};
    content[type] = {
      label: typeof saved.label === 'string' && saved.label.trim() ? saved.label : definition.label,
      description: typeof saved.description === 'string' && saved.description.trim() ? saved.description : definition.description,
      emoji: typeof saved.emoji === 'string' && saved.emoji.trim() ? saved.emoji : definition.emoji,
      opening: typeof saved.opening === 'string' && saved.opening.trim() ? saved.opening : 'Example opening message',
      questions: Array.isArray(saved.questions) && saved.questions.length ? saved.questions.slice(0, 8).map(String) : definition.questions,
    };
  }
  return { panel, content };
}

function normalizeGuildConfig(config = {}) {
  const legacyProfile = normalizeProfile(config);
  const rawProfiles = config.profiles && typeof config.profiles === 'object' ? config.profiles : {};
  const hasProfiles = Object.keys(rawProfiles).length > 0;
  if (!hasProfiles) legacyProfile.panel.optionCount = 1;
  const profiles = hasProfiles
    ? Object.fromEntries(Object.entries(rawProfiles).map(([name, profile]) => [name, normalizeProfile(profile)]))
    : { default: legacyProfile };
  return {
    categoryId: config.categoryId || null,
    logsChannelId: config.logsChannelId || null,
    staffRoleId: config.staffRoleId || null,
    permissionRoles: Array.isArray(config.permissionRoles) ? [...new Set(config.permissionRoles)] : [],
    profiles,
  };
}

function getGuildConfig(configs, guildId) {
  const config = normalizeGuildConfig(configs.get(guildId));
  configs.set(guildId, config);
  return config;
}

function getConfig(configs, guildId, profileName = 'default') {
  const guildConfig = getGuildConfig(configs, guildId);
  const safeName = String(profileName || 'default').trim().toLowerCase() || 'default';
  if (!guildConfig.profiles[safeName]) guildConfig.profiles[safeName] = normalizeProfile({});
  const profile = guildConfig.profiles[safeName];
  profile.panel.optionCount = Math.min(8, Math.max(1, Number(profile.panel.optionCount) || 1));
  return { ...guildConfig, ...profile, profileName: safeName };
}

function saveConfig(context, guildId, config, profileName = 'default') {
  const guildConfig = getGuildConfig(context.ticketConfigs, guildId);
  const safeName = String(profileName || 'default').trim().toLowerCase() || 'default';
  guildConfig.categoryId = config.categoryId;
  guildConfig.logsChannelId = config.logsChannelId;
  guildConfig.staffRoleId = config.staffRoleId;
  guildConfig.permissionRoles = config.permissionRoles;
  guildConfig.profiles[safeName] = { panel: config.panel, content: config.content };
  context.ticketConfigs.set(guildId, guildConfig);
  context.saveTicketConfigs();
}

function hasTicketPermission(interaction, config) {
  return interaction.inGuild() && config.permissionRoles.some((roleId) => interaction.member?.roles?.cache?.has(roleId));
}

function parseColor(color) {
  const value = String(color || '').replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(value) ? parseInt(value, 16) : 0x5865f2;
}

function buildPanelComponents(config, profileName) {
  const entries = Object.entries(TICKET_TYPES).slice(0, config.panel.optionCount);
  const containers = [];
  const blocks = entries.map((entry) => [entry]);

  for (const [blockIndex, blockEntries] of blocks.entries()) {
    const container = new ContainerBuilder();
    if (blockIndex === 0) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(config.panel.imageUrl)
        )
      );
    }

    for (const [index, [type]] of blockEntries.entries()) {
      const content = config.content[type];
      const button = new ButtonBuilder()
        .setCustomId(`ticket-open:${profileName}:${type}`)
        .setEmoji(content.emoji)
        .setStyle(ButtonStyle.Secondary);
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${content.label}**\n${content.description}`))
          .setButtonAccessory(button)
      );
    }
    containers.push(container);
  }

  return containers;
}

function buildTicketControls(channelId) {
  return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket-close:${channelId}`).setLabel('Close ticket').setStyle(ButtonStyle.Danger))];
}

function findOpenTicket(guild, tickets, userId) {
  return [...tickets.values()].find((ticket) => ticket.guildId === guild.id && ticket.ownerId === userId && ticket.status === 'open');
}

function buildIntakeModal(type, config, profileName) {
  const questions = config.content[type].questions.slice(0, 4);
  const modal = new ModalBuilder().setCustomId(`ticket-intake:${profileName}:${type}`).setTitle(`${config.content[type].label} ticket`);
  for (let index = 0; index < questions.length; index += 1) {
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(`answer_${index}`).setLabel(questions[index].slice(0, 45)).setStyle(TextInputStyle.Paragraph).setRequired(index === 0).setMaxLength(1000)));
  }
  return modal;
}

function buildEditModal(config, profileName) {
  const imageUrl = typeof config.panel.imageUrl === 'string' ? config.panel.imageUrl.slice(0, 4000) : DEFAULT_PANEL.imageUrl;
  const optionCount = String(Number(config.panel.optionCount) || 1);
  return new ModalBuilder().setCustomId(`ticket-panel-edit:${profileName}`).setTitle('Edit ticket panel').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('panel_image_url').setLabel('Header image URL').setStyle(TextInputStyle.Short).setRequired(true).setValue(imageUrl)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('panel_option_count').setLabel('Number of ticket options (1-8)').setStyle(TextInputStyle.Short).setRequired(true).setValue(optionCount)),
  );
}

function buildContentEditModal(type, config, profileName) {
  const content = config.content[type];
  const modal = new ModalBuilder().setCustomId(`ticket-content-edit:${profileName}:${type}`).setTitle(`Edit ${TICKET_TYPES[type].label}`);
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Option header').setStyle(TextInputStyle.Short).setRequired(true).setValue(content.label)));
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Option description').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(content.description)));
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel('Button emoji').setStyle(TextInputStyle.Short).setRequired(true).setValue(content.emoji)));
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('opening').setLabel('Opening message').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(content.opening.slice(0, 4000))));
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('questions').setLabel('Questions, one per line (up to 8)').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(content.questions.join('\n').slice(0, 4000))));
  return modal;
}

async function createTicket(interaction, context, type, answers, profileName = 'default') {
  const config = getConfig(context.ticketConfigs, interaction.guildId, profileName);
  if (!config.categoryId || !config.staffRoleId) {
    await interaction.reply({ content: 'Tickets are not configured yet. Staff must configure the category and staff role first.', flags: 64 });
    return;
  }
  const existing = findOpenTicket(interaction.guild, context.tickets, interaction.user.id);
  if (existing) {
    await interaction.reply({ content: `You already have an open ticket: <#${existing.channelId}>. Please finish that conversation before opening another ticket.`, flags: 64 });
    return;
  }
  const category = await interaction.guild.channels.fetch(config.categoryId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) {
    await interaction.reply({ content: 'The configured ticket category could not be found.', flags: 64 });
    return;
  }
  const channel = await interaction.guild.channels.create({
    name: `${type}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90),
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `faithdb-ticket:${interaction.user.id}:${type}`,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: config.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
    ],
  });
  context.tickets.set(channel.id, { channelId: channel.id, guildId: interaction.guildId, ownerId: interaction.user.id, type, status: 'open', createdAt: Date.now() });
  context.saveTickets();
  const answerText = config.content[type].questions.map((question, index) => `**${question}**\n${answers[index] || '_Please provide this in the conversation._'}`).join('\n\n');
  await channel.send({ content: `<@${interaction.user.id}> <@&${config.staffRoleId}>`, embeds: [new EmbedBuilder().setColor(parseColor(config.panel.color)).setTitle(config.content[type].label).setDescription(`${config.content[type].opening}\n\n${answerText}`)], components: buildTicketControls(channel.id) });
  await interaction.reply({ content: `Your ticket has been created: ${channel}`, flags: 64 });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

async function buildTranscript(channel, ticket) {
  const messages = [];
  let before;
  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => new Map());
    if (!batch.size) break;
    messages.push(...batch.values());
    if (batch.size < 100) break;
    before = batch.last().id;
  }
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const rows = messages.map((message) => `<article><b>${escapeHtml(message.author?.tag || 'Unknown')}</b> <time>${new Date(message.createdTimestamp).toISOString()}</time><p>${escapeHtml(message.content || '')}</p>${[...message.attachments.values()].map((attachment) => `<a href="${escapeHtml(attachment.url)}">${escapeHtml(attachment.name || attachment.url)}</a>`).join('<br>')}</article>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(channel.name)} transcript</title><style>body{font:15px sans-serif;max-width:900px;margin:2rem auto;background:#202225;color:#eee}article{padding:1rem;border-bottom:1px solid #444}time{color:#aaa;font-size:.8rem}p{white-space:pre-wrap}</style></head><body><h1>${escapeHtml(channel.name)}</h1><p>Type: ${escapeHtml(ticket.type)}<br>Owner: ${escapeHtml(ticket.ownerId)}<br>Created: ${new Date(ticket.createdAt).toISOString()}</p>${rows}</body></html>`;
}

async function closeTicket(interaction, context, saveTranscript) {
  const ticket = context.tickets.get(interaction.channelId);
  const config = getConfig(context.ticketConfigs, interaction.guildId);
  if (!ticket || ticket.status !== 'open') { await interaction.reply({ content: 'This is not an open ticket.', flags: 64 }); return; }
  if (!hasTicketPermission(interaction, config)) { await interaction.reply({ content: 'You do not have ticket permissions.', flags: 64 }); return; }
  await interaction.deferReply({ flags: 64 });
  if (saveTranscript) {
    const html = await buildTranscript(interaction.channel, ticket);
    const logs = config.logsChannelId ? await interaction.guild.channels.fetch(config.logsChannelId).catch(() => null) : null;
    if (logs?.isTextBased?.()) await logs.send({ content: `Transcript for ${interaction.channel} (${TICKET_TYPES[ticket.type]?.label || ticket.type})`, files: [new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `transcript-${interaction.channel.name}.html` })] });
  }
  context.tickets.delete(ticket.channelId);
  context.saveTickets();
  await interaction.editReply({ content: `${saveTranscript ? 'Transcript saved. ' : ''}Deleting ticket channel.` });
  await interaction.channel.delete('Ticket closed by staff');
}

async function deleteAllTicketData(interaction, context) {
  const guildId = interaction.guildId;
  let deletedPanels = 0;
  let deletedTickets = 0;

  for (const [messageId, panel] of [...context.ticketPanels.entries()]) {
    if (panel.guildId !== guildId) continue;
    const channel = await interaction.client.channels.fetch(panel.channelId).catch(() => null);
    const message = channel?.messages ? await channel.messages.fetch(messageId).catch(() => null) : null;
    if (message) await message.delete().catch(() => {});
    context.ticketPanels.delete(messageId);
    deletedPanels += 1;
  }

  for (const [channelId, ticket] of [...context.tickets.entries()]) {
    if (ticket.guildId !== guildId) continue;
    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (channel) await channel.delete('All ticket data reset by staff').catch(() => {});
    context.tickets.delete(channelId);
    deletedTickets += 1;
  }

  context.ticketConfigs.delete(guildId);
  context.saveTicketPanels();
  context.saveTickets();
  context.saveTicketConfigs();

  await interaction.reply({
    content: `Ticket reset complete. Removed ${deletedPanels} panel record${deletedPanels === 1 ? '' : 's'} and ${deletedTickets} open ticket channel${deletedTickets === 1 ? '' : 's'}. Saved ticket profiles and configuration were cleared. Transcript log messages were left untouched.`,
    flags: 64,
  });
}

module.exports = {
  data: {
    name: 'ticket', description: 'Manage support tickets', default_member_permissions: PermissionFlagsBits.ManageGuild.toString(), dm_permission: false,
    options: [
      { name: 'create', description: 'Create a ticket panel', type: ApplicationCommandOptionType.SubcommandGroup, options: [{ name: 'panel', description: 'Post the ticket panel in this channel', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'profile', description: 'Persistent profile name', type: ApplicationCommandOptionType.String, required: false }] }] },
      { name: 'edit', description: 'Edit ticket panel settings or row content', type: ApplicationCommandOptionType.SubcommandGroup, options: [
        { name: 'panel', description: 'Edit the persistent panel profile', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'profile', description: 'Persistent profile name', type: ApplicationCommandOptionType.String, required: false }] },
        { name: 'number', description: 'Edit one ticket option by row number', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'number', description: 'Option row number, from top to bottom', type: ApplicationCommandOptionType.Integer, required: true, min_value: 1, max_value: 8 }, { name: 'profile', description: 'Persistent profile name', type: ApplicationCommandOptionType.String, required: false }] },
      ] },
      { name: 'grant', description: 'Grant ticket permissions to a role', type: ApplicationCommandOptionType.SubcommandGroup, options: [{ name: 'perms', description: 'Allow a role to manage tickets', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'role', description: 'Staff role', type: ApplicationCommandOptionType.Role, required: true }] }] },
      { name: 'config', description: 'Configure ticket destinations', type: ApplicationCommandOptionType.SubcommandGroup, options: [
        { name: 'category', description: 'Set the ticket category', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'category', description: 'Ticket category', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildCategory], required: true }] },
        { name: 'logs', description: 'Set the transcript logs channel', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'channel', description: 'Transcript channel', type: ApplicationCommandOptionType.Channel, required: true }] },
        { name: 'staff', description: 'Set the staff mention role', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'role', description: 'Staff role', type: ApplicationCommandOptionType.Role, required: true }] },
      ] },
      { name: 'delete', description: 'Delete ticket data', type: ApplicationCommandOptionType.SubcommandGroup, options: [{ name: 'all', description: 'Delete this server\'s ticket panels, open tickets, and saved ticket data', type: ApplicationCommandOptionType.Subcommand }] },
    ],
  },

  async execute(interaction, client, context) {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: 'You need Manage Server permission to configure tickets.', flags: 64 }); return; }
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();
    const profileName = interaction.options.getString('profile') || 'default';
    const config = getConfig(context.ticketConfigs, interaction.guildId, profileName);
    if (group === 'config') {
      if (subcommand === 'category') config.categoryId = interaction.options.getChannel('category', true).id;
      if (subcommand === 'logs') config.logsChannelId = interaction.options.getChannel('channel', true).id;
      if (subcommand === 'staff') config.staffRoleId = interaction.options.getRole('role', true).id;
      saveConfig(context, interaction.guildId, config, profileName); await interaction.reply({ content: 'Ticket configuration updated.', flags: 64 }); return;
    }
    if (group === 'grant' && subcommand === 'perms') {
      const role = interaction.options.getRole('role', true); if (!config.permissionRoles.includes(role.id)) config.permissionRoles.push(role.id);
      saveConfig(context, interaction.guildId, config, profileName); await interaction.reply({ content: `Granted ticket permissions to ${role}.`, flags: 64 }); return;
    }
    if (group === 'delete' && subcommand === 'all') {
      await deleteAllTicketData(interaction, context);
      return;
    }
    if (group === 'create' && subcommand === 'panel') {
      const target = interaction.channel;
      const requestedProfile = interaction.options.getString('profile') || 'default';
      const panelConfig = getConfig(context.ticketConfigs, interaction.guildId, requestedProfile);
      const panelProfile = panelConfig.profileName;
      if (!target.isTextBased?.()) { await interaction.reply({ content: 'Choose a text channel.', flags: 64 }); return; }
      saveConfig(context, interaction.guildId, panelConfig, panelProfile);
      let sent;
      try {
        sent = await target.send({ flags: MessageFlags.IsComponentsV2, components: buildPanelComponents(panelConfig, panelProfile) });
      } catch (error) {
        console.error(`Failed to create ${panelProfile} ticket panel:`, error);
        await interaction.reply({ content: `I could not create the ${panelProfile} ticket panel: ${error.message || 'Discord rejected the panel components.'}`, flags: 64 });
        return;
      }
      context.ticketPanels.set(sent.id, { guildId: interaction.guildId, channelId: target.id, profileName: panelProfile });
      context.saveTicketPanels();
      await interaction.reply({ content: `Ticket panel posted in ${target} using the ${panelProfile} profile.`, flags: 64 }); return;
    }
    if (group === 'edit' && subcommand === 'number') {
      const number = interaction.options.getInteger('number', true);
      const type = Object.keys(TICKET_TYPES)[number - 1];
      if (!type || number > config.panel.optionCount) { await interaction.reply({ content: `That row is not currently enabled. Choose a number from 1 to ${config.panel.optionCount}.`, flags: 64 }); return; }
      await interaction.showModal(buildContentEditModal(type, config, profileName));
      return;
    }
    if (group === 'edit' && subcommand === 'panel') {
      await interaction.showModal(buildEditModal(config, profileName));
    }
  },

  async handleButton(interaction, context) {
    if (interaction.customId.startsWith('ticket-open:')) {
      const [, panelKey, type] = interaction.customId.split(':');
      const profileName = context.ticketPanels.get(panelKey)?.profileName || panelKey || 'default';
      if (TICKET_TYPES[type]) await interaction.showModal(buildIntakeModal(type, getConfig(context.ticketConfigs, interaction.guildId, profileName), profileName));
      return;
    }
    if (interaction.customId.startsWith('ticket-close:')) {
      if (!hasTicketPermission(interaction, getConfig(context.ticketConfigs, interaction.guildId))) { await interaction.reply({ content: 'You do not have ticket permissions.', flags: 64 }); return; }
      await interaction.reply({ content: 'You are about to close this ticket. Save its transcript before deleting the channel?', components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket-confirm:save').setLabel('Save transcript').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('ticket-confirm:delete').setLabel('Close without saving').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('ticket-confirm:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary))], flags: 64 }); return;
    }
    if (interaction.customId.startsWith('ticket-confirm:')) { if (interaction.customId.endsWith('cancel')) { await interaction.update({ content: 'Ticket closure cancelled.', components: [] }); return; } await closeTicket(interaction, context, interaction.customId.endsWith('save')); }
  },

  async handleModalSubmit(interaction, context) {
    if (interaction.customId.startsWith('ticket-panel-edit:')) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: 'You need Manage Server permission.', flags: 64 }); return; }
      const profileName = interaction.customId.split(':')[1] || 'default';
      const config = getConfig(context.ticketConfigs, interaction.guildId, profileName);
      const imageUrl = interaction.fields.getTextInputValue('panel_image_url').trim();
      const optionCount = Number.parseInt(interaction.fields.getTextInputValue('panel_option_count').trim(), 10);
      if (!/^https?:\/\//i.test(imageUrl)) { await interaction.reply({ content: 'The header image URL must begin with http:// or https://.', flags: 64 }); return; }
      if (!Number.isInteger(optionCount) || optionCount < 1 || optionCount > 8) { await interaction.reply({ content: 'The number of ticket options must be between 1 and 8.', flags: 64 }); return; }
      config.panel.imageUrl = imageUrl;
      config.panel.optionCount = optionCount;
      const panels = [...context.ticketPanels.entries()].filter(([, value]) => value.guildId === interaction.guildId && (value.profileName || 'default') === profileName);
      let updatedPanels = 0;
      let removedPanels = 0;
      let failedPanels = 0;
      for (const [messageId, panel] of panels) {
        const channel = await interaction.client.channels.fetch(panel.channelId).catch(() => null);
        const message = channel?.messages ? await channel.messages.fetch(messageId).catch(() => null) : null;
        if (message) {
          try {
            await message.edit({ components: buildPanelComponents(config, profileName) });
            updatedPanels += 1;
          } catch (error) {
            failedPanels += 1;
            console.error(`Failed to refresh ticket panel ${messageId}:`, error);
          }
        } else {
          context.ticketPanels.delete(messageId);
          removedPanels += 1;
        }
      }
      context.saveTicketPanels();
      saveConfig(context, interaction.guildId, config, profileName);
      await interaction.reply({ content: `Ticket panel profile "${profileName}" updated. Refreshed ${updatedPanels} panel${updatedPanels === 1 ? '' : 's'}${removedPanels ? `, removed ${removedPanels} stale record${removedPanels === 1 ? '' : 's'}` : ''}${failedPanels ? `, and ${failedPanels} panel${failedPanels === 1 ? '' : 's'} could not be refreshed` : ''}.`, flags: 64 });
      return;
    }
    if (interaction.customId.startsWith('ticket-content-edit:')) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: 'You need Manage Server permission.', flags: 64 }); return; }
      const [, profileName, type] = interaction.customId.split(':');
      const config = getConfig(context.ticketConfigs, interaction.guildId, profileName);
      config.content[type] = {
        label: interaction.fields.getTextInputValue('label').trim(),
        description: interaction.fields.getTextInputValue('description').trim(),
        emoji: interaction.fields.getTextInputValue('emoji').trim(),
        opening: interaction.fields.getTextInputValue('opening').trim(),
        questions: interaction.fields.getTextInputValue('questions').split('\n').map((question) => question.trim()).filter(Boolean).slice(0, 8),
      };
      let updatedPanels = 0;
      let removedPanels = 0;
      let failedPanels = 0;
      const panels = [...context.ticketPanels.entries()].filter(([, value]) => value.guildId === interaction.guildId && (value.profileName || 'default') === profileName);
      for (const [messageId, panel] of panels) {
        const channel = await interaction.client.channels.fetch(panel.channelId).catch(() => null);
        const message = channel?.messages ? await channel.messages.fetch(messageId).catch(() => null) : null;
        if (!message) {
          context.ticketPanels.delete(messageId);
          removedPanels += 1;
          continue;
        }
        try {
          await message.edit({ components: buildPanelComponents(config, profileName) });
          updatedPanels += 1;
        } catch (error) {
          failedPanels += 1;
          console.error(`Failed to refresh ticket panel ${messageId} after content edit:`, error);
        }
      }
      context.saveTicketPanels();
      saveConfig(context, interaction.guildId, config, profileName);
      await interaction.reply({ content: `${TICKET_TYPES[type].label} ticket content updated. Refreshed ${updatedPanels} panel${updatedPanels === 1 ? '' : 's'}${removedPanels ? `, removed ${removedPanels} stale record${removedPanels === 1 ? '' : 's'}` : ''}${failedPanels ? `, and ${failedPanels} panel${failedPanels === 1 ? '' : 's'} could not be refreshed` : ''}.`, flags: 64 }); return;
    }
    if (interaction.customId.startsWith('ticket-intake:')) { const [, profileName, type] = interaction.customId.split(':'); const config = getConfig(context.ticketConfigs, interaction.guildId, profileName || 'default'); const answers = config.content[type].questions.slice(0, 4).map((_, index) => interaction.fields.getTextInputValue(`answer_${index}`)); await createTicket(interaction, context, type, answers, profileName || 'default'); }
  },
};