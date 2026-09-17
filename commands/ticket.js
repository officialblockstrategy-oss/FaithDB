const {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const TICKET_TYPES = {
  creator: { label: 'Trusted Creator', emoji: '🎫', description: 'Apply for the Trusted Creator role.', questions: ['YouTube or creator channel', 'How long have you made content?', 'How would your content benefit this community?', 'Relevant links or examples'] },
  partnership: { label: 'Partnership', emoji: '🎫', description: 'Discuss a partnership with the server.', questions: ['Your name and organization', 'What partnership are you proposing?', 'Relevant links or contact details', 'Anything else we should know'] },
  report: { label: 'Member Report', emoji: '🎫', description: 'Privately report a member or incident.', questions: ['Member being reported', 'What happened?', 'When and where did it happen?', 'Message links or other evidence'] },
  bug: { label: 'Bug Report', emoji: '🎫', description: 'Report a bot or server bug.', questions: ['What went wrong?', 'Steps to reproduce it', 'What did you expect to happen?', 'Screenshots, links, or platform'] },
  appeal: { label: 'Ban Appeal', emoji: '🎫', description: 'Appeal a server ban.', questions: ['Your former username', 'Why should the ban be reconsidered?', 'What happened from your perspective?', 'Anything else you want staff to consider'] },
  staff: { label: 'Staff Application', emoji: '🎫', description: 'Apply for a moderator or administrator role.', questions: ['Which staff role are you applying for?', 'Your relevant experience', 'Why would you be a good fit?', 'Your usual availability'] },
  other: { label: 'Other', emoji: '🎫', description: 'Open a ticket for another reason.', questions: ['What can staff help with?', 'Please provide the relevant details', 'Links or evidence, if applicable', 'Anything else we should know'] },
};

const DEFAULT_PANEL = {
  title: 'Faithful Building Support',
  description: 'Choose the option that best describes what you need. A private ticket will be created for you and staff will be notified.',
  color: '#5865F2',
  footer: 'Please do not open duplicate tickets.',
};

function normalizeConfig(config = {}) {
  const panel = { ...DEFAULT_PANEL, ...(config.panel || {}) };
  const content = {};
  for (const [type, definition] of Object.entries(TICKET_TYPES)) {
    const saved = config.content?.[type] || {};
    content[type] = {
      opening: typeof saved.opening === 'string' && saved.opening.trim() ? saved.opening : `Thanks for contacting staff about **${definition.label}**. Staff will be with you shortly. Please answer the questions below while you wait.`,
      questions: Array.isArray(saved.questions) && saved.questions.length ? saved.questions.slice(0, 4).map(String) : definition.questions,
    };
  }
  return {
    categoryId: config.categoryId || null,
    logsChannelId: config.logsChannelId || null,
    staffRoleId: config.staffRoleId || null,
    permissionRoles: Array.isArray(config.permissionRoles) ? [...new Set(config.permissionRoles)] : [],
    panel,
    content,
  };
}

function getConfig(configs, guildId) {
  const config = normalizeConfig(configs.get(guildId));
  configs.set(guildId, config);
  return config;
}

function hasTicketPermission(interaction, config) {
  return interaction.inGuild() && config.permissionRoles.some((roleId) => interaction.member?.roles?.cache?.has(roleId));
}

function parseColor(color) {
  const value = String(color || '').replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(value) ? parseInt(value, 16) : 0x5865f2;
}

function buildPanelEmbed(config) {
  const embed = new EmbedBuilder().setTitle(config.panel.title).setDescription(config.panel.description).setColor(parseColor(config.panel.color));
  for (const definition of Object.values(TICKET_TYPES)) embed.addFields({ name: definition.label, value: definition.description, inline: false });
  if (config.panel.footer) embed.setFooter({ text: config.panel.footer });
  return embed;
}

function buildPanelRows(messageId) {
  const buttons = Object.entries(TICKET_TYPES).map(([type, definition]) => new ButtonBuilder().setCustomId(`ticket-open:${messageId}:${type}`).setEmoji(definition.emoji).setStyle(ButtonStyle.Secondary));
  return [new ActionRowBuilder().addComponents(buttons.slice(0, 4)), new ActionRowBuilder().addComponents(buttons.slice(4))];
}

function buildTicketControls(channelId) {
  return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket-close:${channelId}`).setLabel('Close ticket').setStyle(ButtonStyle.Danger))];
}

function findOpenTicket(guild, tickets, userId) {
  return [...tickets.values()].find((ticket) => ticket.guildId === guild.id && ticket.ownerId === userId && ticket.status === 'open');
}

function buildIntakeModal(type, config) {
  const questions = config.content[type].questions.slice(0, 4);
  const modal = new ModalBuilder().setCustomId(`ticket-intake:${type}`).setTitle(`${TICKET_TYPES[type].label} ticket`);
  for (let index = 0; index < questions.length; index += 1) {
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(`answer_${index}`).setLabel(questions[index].slice(0, 45)).setStyle(TextInputStyle.Paragraph).setRequired(index === 0).setMaxLength(1000)));
  }
  return modal;
}

function buildEditModal(config) {
  return new ModalBuilder().setCustomId('ticket-panel-edit').setTitle('Edit ticket panel').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('panel_title').setLabel('Panel title').setStyle(TextInputStyle.Short).setRequired(true).setValue(config.panel.title)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('panel_description').setLabel('Panel description').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(config.panel.description)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('panel_color').setLabel('Embed color, for example #5865F2').setStyle(TextInputStyle.Short).setRequired(true).setValue(config.panel.color)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('panel_footer').setLabel('Panel footer').setStyle(TextInputStyle.Short).setRequired(false).setValue(config.panel.footer || '')),
  );
}

function buildContentEditModal(type, config) {
  const content = config.content[type];
  const modal = new ModalBuilder().setCustomId(`ticket-content-edit:${type}`).setTitle(`Edit ${TICKET_TYPES[type].label}`);
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('opening').setLabel('Opening message').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(content.opening.slice(0, 4000))));
  for (let index = 0; index < 4; index += 1) {
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(`question_${index}`).setLabel(`Question ${index + 1}`).setStyle(TextInputStyle.Short).setRequired(index === 0).setValue(content.questions[index] || '')));
  }
  return modal;
}

async function createTicket(interaction, context, type, answers) {
  const config = getConfig(context.ticketConfigs, interaction.guildId);
  if (!config.categoryId || !config.staffRoleId) {
    await interaction.reply({ content: 'Tickets are not configured yet. Staff must configure the category and staff role first.', flags: 64 });
    return;
  }
  const existing = findOpenTicket(interaction.guild, context.tickets, interaction.user.id);
  if (existing) {
    await interaction.reply({ content: `You already have an open ticket: <#${existing.channelId}>`, flags: 64 });
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
  const answerText = answers.map((answer, index) => `**${config.content[type].questions[index]}**\n${answer || '_No answer provided._'}`).join('\n\n');
  await channel.send({ content: `<@${interaction.user.id}> <@&${config.staffRoleId}>`, embeds: [new EmbedBuilder().setColor(parseColor(config.panel.color)).setTitle(TICKET_TYPES[type].label).setDescription(`${config.content[type].opening}\n\n${answerText}`)], components: buildTicketControls(channel.id) });
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

module.exports = {
  data: {
    name: 'ticket', description: 'Manage support tickets', default_member_permissions: PermissionFlagsBits.ManageGuild.toString(), dm_permission: false,
    options: [
      { name: 'create', description: 'Create a ticket panel', type: ApplicationCommandOptionType.SubcommandGroup, options: [{ name: 'panel', description: 'Post the ticket panel', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'channel', description: 'Channel where the panel should be posted', type: ApplicationCommandOptionType.Channel, required: true }] }] },
      { name: 'panel', description: 'Edit the ticket panel in this channel', type: ApplicationCommandOptionType.SubcommandGroup, options: [{ name: 'edit', description: 'Open the panel editor', type: ApplicationCommandOptionType.Subcommand }] },
      { name: 'content', description: 'Edit ticket opening text and questions', type: ApplicationCommandOptionType.SubcommandGroup, options: [{ name: 'edit', description: 'Edit one ticket type', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'type', description: 'Ticket type to edit', type: ApplicationCommandOptionType.String, required: true, choices: Object.entries(TICKET_TYPES).map(([value, definition]) => ({ name: definition.label, value })) }] }] },
      { name: 'grant', description: 'Grant ticket permissions to a role', type: ApplicationCommandOptionType.SubcommandGroup, options: [{ name: 'perms', description: 'Allow a role to manage tickets', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'role', description: 'Staff role', type: ApplicationCommandOptionType.Role, required: true }] }] },
      { name: 'config', description: 'Configure ticket destinations', type: ApplicationCommandOptionType.SubcommandGroup, options: [
        { name: 'category', description: 'Set the ticket category', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'category', description: 'Ticket category', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildCategory], required: true }] },
        { name: 'logs', description: 'Set the transcript logs channel', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'channel', description: 'Transcript channel', type: ApplicationCommandOptionType.Channel, required: true }] },
        { name: 'staff', description: 'Set the staff mention role', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'role', description: 'Staff role', type: ApplicationCommandOptionType.Role, required: true }] },
      ] },
    ],
  },

  async execute(interaction, client, context) {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: 'You need Manage Server permission to configure tickets.', flags: 64 }); return; }
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();
    const config = getConfig(context.ticketConfigs, interaction.guildId);
    if (group === 'config') {
      if (subcommand === 'category') config.categoryId = interaction.options.getChannel('category', true).id;
      if (subcommand === 'logs') config.logsChannelId = interaction.options.getChannel('channel', true).id;
      if (subcommand === 'staff') config.staffRoleId = interaction.options.getRole('role', true).id;
      context.ticketConfigs.set(interaction.guildId, config); context.saveTicketConfigs(); await interaction.reply({ content: 'Ticket configuration updated.', flags: 64 }); return;
    }
    if (group === 'grant' && subcommand === 'perms') {
      const role = interaction.options.getRole('role', true); if (!config.permissionRoles.includes(role.id)) config.permissionRoles.push(role.id);
      context.ticketConfigs.set(interaction.guildId, config); context.saveTicketConfigs(); await interaction.reply({ content: `Granted ticket permissions to ${role}.`, flags: 64 }); return;
    }
    if (group === 'create' && subcommand === 'panel') {
      const target = interaction.options.getChannel('channel', true);
      if (!target.isTextBased?.()) { await interaction.reply({ content: 'Choose a text channel.', flags: 64 }); return; }
      const sent = await target.send({ embeds: [buildPanelEmbed(config)], components: buildPanelRows('pending') }); await sent.edit({ components: buildPanelRows(sent.id) });
      context.ticketPanels.set(sent.id, { guildId: interaction.guildId, channelId: target.id }); context.saveTicketPanels(); await interaction.reply({ content: `Ticket panel posted in ${target}.`, flags: 64 }); return;
    }
    if (group === 'content' && subcommand === 'edit') {
      const type = interaction.options.getString('type', true);
      await interaction.showModal(buildContentEditModal(type, config));
      return;
    }
    if (group === 'panel' && subcommand === 'edit') {
      const panel = [...context.ticketPanels.entries()].reverse().find(([, value]) => value.guildId === interaction.guildId && value.channelId === interaction.channelId);
      if (!panel) { await interaction.reply({ content: 'No ticket panel is registered in this channel.', flags: 64 }); return; }
      await interaction.showModal(buildEditModal(config));
    }
  },

  async handleButton(interaction, context) {
    if (interaction.customId.startsWith('ticket-open:')) { const type = interaction.customId.split(':')[2]; if (TICKET_TYPES[type]) await interaction.showModal(buildIntakeModal(type, getConfig(context.ticketConfigs, interaction.guildId))); return; }
    if (interaction.customId.startsWith('ticket-close:')) {
      if (!hasTicketPermission(interaction, getConfig(context.ticketConfigs, interaction.guildId))) { await interaction.reply({ content: 'You do not have ticket permissions.', flags: 64 }); return; }
      await interaction.reply({ content: 'You are about to close this ticket. Save its transcript before deleting the channel?', components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket-confirm:save').setLabel('Save transcript').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('ticket-confirm:delete').setLabel('Close without saving').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('ticket-confirm:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary))], flags: 64 }); return;
    }
    if (interaction.customId.startsWith('ticket-confirm:')) { if (interaction.customId.endsWith('cancel')) { await interaction.update({ content: 'Ticket closure cancelled.', components: [] }); return; } await closeTicket(interaction, context, interaction.customId.endsWith('save')); }
  },

  async handleModalSubmit(interaction, context) {
    if (interaction.customId === 'ticket-panel-edit') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: 'You need Manage Server permission.', flags: 64 }); return; }
      const config = getConfig(context.ticketConfigs, interaction.guildId); config.panel.title = interaction.fields.getTextInputValue('panel_title').trim(); config.panel.description = interaction.fields.getTextInputValue('panel_description').trim(); config.panel.color = interaction.fields.getTextInputValue('panel_color').trim(); config.panel.footer = interaction.fields.getTextInputValue('panel_footer').trim();
      const panel = [...context.ticketPanels.entries()].reverse().find(([, value]) => value.guildId === interaction.guildId && value.channelId === interaction.channelId); if (panel) { const message = await interaction.channel.messages.fetch(panel[0]).catch(() => null); if (message) await message.edit({ embeds: [buildPanelEmbed(config)], components: buildPanelRows(panel[0]) }); }
      context.ticketConfigs.set(interaction.guildId, config); context.saveTicketConfigs(); await interaction.reply({ content: 'Ticket panel updated.', flags: 64 }); return;
    }
    if (interaction.customId.startsWith('ticket-content-edit:')) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: 'You need Manage Server permission.', flags: 64 }); return; }
      const type = interaction.customId.split(':')[1];
      const config = getConfig(context.ticketConfigs, interaction.guildId);
      config.content[type] = {
        opening: interaction.fields.getTextInputValue('opening').trim(),
        questions: [0, 1, 2, 3].map((index) => interaction.fields.getTextInputValue(`question_${index}`).trim()).filter(Boolean),
      };
      context.ticketConfigs.set(interaction.guildId, config); context.saveTicketConfigs();
      await interaction.reply({ content: `${TICKET_TYPES[type].label} ticket content updated.`, flags: 64 }); return;
    }
    if (interaction.customId.startsWith('ticket-intake:')) { const type = interaction.customId.split(':')[1]; const config = getConfig(context.ticketConfigs, interaction.guildId); const answers = config.content[type].questions.slice(0, 4).map((_, index) => interaction.fields.getTextInputValue(`answer_${index}`)); await createTicket(interaction, context, type, answers); }
  },
};