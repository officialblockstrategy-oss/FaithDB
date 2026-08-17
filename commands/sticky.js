const {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

// Sticky messages are stored per channel. When a new message arrives in a channel with a sticky,
// the old sticky message is deleted and reposted so the sticky stays at the bottom of the chat.
function decodeEscapes(value) {
  return typeof value === 'string' ? value.replace(/\\n/g, '\n') : value;
}

module.exports = {
  data: {
    name: 'sticky',
    description: 'Manage sticky messages for this channel',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    dm_permission: false,
    options: [
      {
        name: 'create',
        description: 'Create a sticky message',
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: [
          {
            name: 'text',
            description: 'Create a stickied text message in this channel',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'message',
                description: 'Message to stick',
                type: ApplicationCommandOptionType.String,
                required: true,
              },
            ],
          },
          {
            name: 'embed',
            description: 'Create a fancy stickied embed in this channel',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'title',
                description: 'Embed title',
                type: ApplicationCommandOptionType.String,
                required: true,
              },
              {
                name: 'description',
                description: 'Embed description',
                type: ApplicationCommandOptionType.String,
                required: true,
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
        ],
      },
      {
        name: 'edit',
        description: 'Edit an existing sticky in this channel',
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: [
          {
            name: 'text',
            description: 'Edit the sticky text in this channel',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'message',
                description: 'New sticky text',
                type: ApplicationCommandOptionType.String,
                required: false,
              },
            ],
          },
          {
            name: 'embed',
            description: 'Edit the sticky embed in this channel',
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
        ],
      },
      {
        name: 'delete',
        description: 'Delete the stickied message in this channel',
        type: ApplicationCommandOptionType.Subcommand,
      },
    ],
  },

  async execute(interaction, client, { stickies, saveStickies }) {
    // Sticky command routes to creating text or embed stickies, or deleting the current sticky.
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (group === 'create' && subcommand === 'text') {
      await handleCreateText(interaction, stickies, saveStickies);
      return;
    }

    if (group === 'create' && subcommand === 'embed') {
      await handleCreateEmbed(interaction, stickies, saveStickies);
      return;
    }

    if (group === 'edit' && subcommand === 'text') {
      await handleEditText(interaction, stickies, saveStickies);
      return;
    }

    if (group === 'edit' && subcommand === 'embed') {
      await handleEditEmbed(interaction, stickies, saveStickies);
      return;
    }

    if (subcommand === 'delete') {
      await handleDelete(interaction, stickies, saveStickies);
      return;
    }

    await interaction.reply({ content: 'Unknown sticky command.', flags: 64 });
  },
};

module.exports.handleModalSubmit = handleModalSubmit;

function buildTextStickyModal(value = '') {
  return new ModalBuilder()
    .setCustomId('sticky-edit-text')
    .setTitle('Edit Sticky Text')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('sticky_text_message')
          .setLabel('Sticky message')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(value || '')
      )
    );
}

function buildEmbedStickyModal(values) {
  return new ModalBuilder()
    .setCustomId('sticky-edit-embed')
    .setTitle('Edit Sticky Embed')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('sticky_embed_title')
          .setLabel('Embed title')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(values.title || '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('sticky_embed_description')
          .setLabel('Embed description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setValue(values.description || '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('sticky_embed_footer')
          .setLabel('Footer text (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(values.footerText || '')
      )
    );
}

async function showEditTextModal(interaction, stickies) {
  const prev = stickies.get(interaction.channel.id);

  if (!prev || prev.embed) {
    await interaction.reply({ content: 'No text sticky set in this channel.', flags: 64 });
    return;
  }

  await interaction.showModal(buildTextStickyModal(prev.content || ''));
}

async function showEditEmbedModal(interaction, stickies) {
  const prev = stickies.get(interaction.channel.id);

  if (!prev || !prev.embed) {
    await interaction.reply({ content: 'No embed sticky set in this channel.', flags: 64 });
    return;
  }

  const embedData = prev.embedData || {};
  await interaction.showModal(buildEmbedStickyModal({
    title: embedData.title || '',
    description: embedData.description || '',
    footerText: embedData.footer?.text || '',
  }));
}

async function replaceStickyMessage(channel, prev, sendOptions) {
  if (prev) {
    try {
      const oldMessage = await channel.messages.fetch(prev.messageId);
      await oldMessage.delete().catch(() => {});
    } catch {}
  }

  return channel.send(sendOptions);
}

function buildStickyEmbed(values) {
  const embed = new EmbedBuilder()
    .setTitle(values.title || '')
    .setDescription(values.description || '');

  if (values.color) {
    const parsed = String(values.color).replace(/^#/, '');
    if (/^[0-9A-Fa-f]{6}$/.test(parsed)) {
      embed.setColor(parseInt(parsed, 16));
    }
  }

  if (values.authorName) {
    embed.setAuthor({ name: values.authorName, iconURL: values.authorIcon || undefined });
  }

  if (values.thumbnail) {
    embed.setThumbnail(values.thumbnail);
  }

  if (values.image) {
    embed.setImage(values.image);
  }

  if (values.footerText) {
    embed.setFooter({ text: values.footerText });
  }

  if (values.field1Name && values.field1Value) {
    embed.addFields({ name: values.field1Name, value: values.field1Value, inline: false });
  }

  if (values.field2Name && values.field2Value) {
    embed.addFields({ name: values.field2Name, value: values.field2Value, inline: false });
  }

  return embed;
}

async function handleModalSubmit(interaction, stickies, saveStickies) {
  if (interaction.customId === 'sticky-edit-text') {
    const prev = stickies.get(interaction.channel.id);
    if (!prev || prev.embed) {
      await interaction.reply({ content: 'No text sticky set in this channel.', flags: 64 });
      return;
    }

    const text = decodeEscapes(interaction.fields.getTextInputValue('sticky_text_message'));
    const sent = await replaceStickyMessage(interaction.channel, prev, text);
    stickies.set(interaction.channel.id, { messageId: sent.id, content: text });
    saveStickies();
    await interaction.reply({ content: 'Sticky text updated.', flags: 64 });
    return;
  }

  if (interaction.customId === 'sticky-edit-embed') {
    const prev = stickies.get(interaction.channel.id);
    if (!prev || !prev.embed) {
      await interaction.reply({ content: 'No embed sticky set in this channel.', flags: 64 });
      return;
    }

    const oldEmbedData = prev.embedData || {};
    const embed = buildStickyEmbed({
      title: decodeEscapes(interaction.fields.getTextInputValue('sticky_embed_title').trim()) || oldEmbedData.title || '',
      description: decodeEscapes(interaction.fields.getTextInputValue('sticky_embed_description').trim()) || oldEmbedData.description || '',
      color: oldEmbedData.color,
      authorName: oldEmbedData.author?.name,
      authorIcon: oldEmbedData.author?.icon_url,
      thumbnail: oldEmbedData.thumbnail?.url,
      image: oldEmbedData.image?.url,
      footerText: decodeEscapes(interaction.fields.getTextInputValue('sticky_embed_footer').trim()) || oldEmbedData.footer?.text || null,
      field1Name: oldEmbedData.fields?.[0]?.name,
      field1Value: oldEmbedData.fields?.[0]?.value,
      field2Name: oldEmbedData.fields?.[1]?.name,
      field2Value: oldEmbedData.fields?.[1]?.value,
    });

    const sent = await replaceStickyMessage(interaction.channel, prev, { embeds: [embed] });
    stickies.set(interaction.channel.id, {
      messageId: sent.id,
      content: null,
      embed: true,
      embedData: embed.toJSON(),
    });
    saveStickies();
    await interaction.reply({ content: 'Embed sticky updated.', flags: 64 });
    return;
  }

  await interaction.reply({ content: 'Unknown sticky modal submission.', flags: 64 });
}

async function handleCreateText(interaction, stickies, saveStickies) {
  const channel = interaction.channel;
  const text = decodeEscapes(interaction.options.getString('message', true));
  const prev = stickies.get(channel.id);

  if (prev) {
    try {
      const oldMessage = await channel.messages.fetch(prev.messageId);
      await oldMessage.delete().catch(() => {});
    } catch {}
  }

  const sent = await channel.send(text);
  stickies.set(channel.id, { messageId: sent.id, content: text });
  saveStickies();
  await interaction.reply({ content: 'Sticky created.', flags: 64 });
}

async function handleEditText(interaction, stickies, saveStickies) {
  const channel = interaction.channel;
  const rawText = interaction.options.getString('message');
  const prev = stickies.get(channel.id);

  if (!prev) {
    await interaction.reply({ content: 'No sticky set in this channel.', flags: 64 });
    return;
  }

  if (rawText === null) {
    await showEditTextModal(interaction, stickies);
    return;
  }

  const text = decodeEscapes(rawText);

  const sent = await replaceStickyMessage(channel, prev, text);
  stickies.set(channel.id, { messageId: sent.id, content: text });
  saveStickies();
  await interaction.reply({ content: 'Sticky text updated.', flags: 64 });
}

async function handleCreateEmbed(interaction, stickies, saveStickies) {
  const channel = interaction.channel;
  const title = decodeEscapes(interaction.options.getString('title', true));
  const description = decodeEscapes(interaction.options.getString('description', true));
  const color = interaction.options.getString('color');
  const authorName = decodeEscapes(interaction.options.getString('author_name'));
  const authorIcon = interaction.options.getString('author_icon_url');
  const thumbnail = interaction.options.getString('thumbnail_url');
  const image = interaction.options.getString('image_url');
  const footerText = decodeEscapes(interaction.options.getString('footer'));
  const field1Name = decodeEscapes(interaction.options.getString('field1_name'));
  const field1Value = decodeEscapes(interaction.options.getString('field1_value'));
  const field2Name = decodeEscapes(interaction.options.getString('field2_name'));
  const field2Value = decodeEscapes(interaction.options.getString('field2_value'));

  const prev = stickies.get(channel.id);
  const embed = buildStickyEmbed({ title, description, color, authorName, authorIcon, thumbnail, image, footerText, field1Name, field1Value, field2Name, field2Value });
  const sent = await replaceStickyMessage(channel, prev, { embeds: [embed] });
  stickies.set(channel.id, {
    messageId: sent.id,
    content: null,
    embed: true,
    embedData: embed.toJSON(),
  });
  saveStickies();
  await interaction.reply({ content: 'Embed sticky created.', flags: 64 });
}

// Edit the existing sticky embed in the current channel.
// If a field is omitted, the previous embed value is preserved.
async function handleEditEmbed(interaction, stickies, saveStickies) {
  const channel = interaction.channel;
  const prev = stickies.get(channel.id);

  if (!prev || !prev.embed) {
    await interaction.reply({ content: 'No embed sticky set in this channel.', flags: 64 });
    return;
  }

  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  const color = interaction.options.getString('color');
  const authorName = decodeEscapes(interaction.options.getString('author_name'));
  const authorIcon = interaction.options.getString('author_icon_url');
  const thumbnail = interaction.options.getString('thumbnail_url');
  const image = interaction.options.getString('image_url');
  const footerText = decodeEscapes(interaction.options.getString('footer'));
  const field1Name = decodeEscapes(interaction.options.getString('field1_name'));
  const field1Value = decodeEscapes(interaction.options.getString('field1_value'));
  const field2Name = decodeEscapes(interaction.options.getString('field2_name'));
  const field2Value = decodeEscapes(interaction.options.getString('field2_value'));

  if (
    title === null &&
    description === null &&
    color === null &&
    authorName === null &&
    authorIcon === null &&
    thumbnail === null &&
    image === null &&
    footerText === null &&
    field1Name === null &&
    field1Value === null &&
    field2Name === null &&
    field2Value === null
  ) {
    await showEditEmbedModal(interaction, stickies);
    return;
  }

  const oldEmbedData = prev.embedData || {};
  const embed = buildStickyEmbed({
    title: title ?? oldEmbedData.title ?? '',
    description: description ?? oldEmbedData.description ?? '',
    color: color ?? oldEmbedData.color,
    authorName: authorName ?? oldEmbedData.author?.name,
    authorIcon: authorIcon ?? oldEmbedData.author?.icon_url,
    thumbnail: thumbnail ?? oldEmbedData.thumbnail?.url,
    image: image ?? oldEmbedData.image?.url,
    footerText: footerText ?? oldEmbedData.footer?.text,
    field1Name: field1Name ?? oldEmbedData.fields?.[0]?.name,
    field1Value: field1Value ?? oldEmbedData.fields?.[0]?.value,
    field2Name: field2Name ?? oldEmbedData.fields?.[1]?.name,
    field2Value: field2Value ?? oldEmbedData.fields?.[1]?.value,
  });

  const sent = await replaceStickyMessage(channel, prev, { embeds: [embed] });
  stickies.set(channel.id, {
    messageId: sent.id,
    content: null,
    embed: true,
    embedData: embed.toJSON(),
  });
  saveStickies();
  await interaction.reply({ content: 'Embed sticky updated.', flags: 64 });
}

async function handleDelete(interaction, stickies, saveStickies) {
  const channel = interaction.channel;
  const prev = stickies.get(channel.id);
  if (!prev) {
    await interaction.reply({ content: 'No sticky set.', flags: 64 });
    return;
  }

  try {
    const oldMessage = await channel.messages.fetch(prev.messageId);
    await oldMessage.delete().catch(() => {});
  } catch {}

  stickies.delete(channel.id);
  saveStickies();
  await interaction.reply({ content: 'Sticky deleted.', flags: 64 });
}
