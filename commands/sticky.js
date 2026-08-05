const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

function decodeEscapes(value) {
  return typeof value === 'string' ? value.replace(/\\n/g, '\n') : value;
}

module.exports = {
  data: {
    name: 'sticky',
    description: 'Manage sticky messages for this channel',
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

    if (subcommand === 'delete') {
      await handleDelete(interaction, stickies, saveStickies);
      return;
    }

    await interaction.reply({ content: 'Unknown sticky command.', ephemeral: true });
  },
};

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
  await interaction.reply({ content: 'Sticky created.', ephemeral: true });
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
  if (prev) {
    try {
      const oldMessage = await channel.messages.fetch(prev.messageId);
      await oldMessage.delete().catch(() => {});
    } catch {}
  }

  const embed = new EmbedBuilder().setTitle(title).setDescription(description);

  if (color) {
    const parsed = color.replace(/^#/, '');
    if (/^[0-9A-Fa-f]{6}$/.test(parsed)) {
      embed.setColor(parseInt(parsed, 16));
    }
  }

  if (authorName) {
    embed.setAuthor({ name: authorName, iconURL: authorIcon || undefined });
  }

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  if (image) {
    embed.setImage(image);
  }

  if (footerText) {
    embed.setFooter({ text: footerText });
  }

  if (field1Name && field1Value) {
    embed.addFields({ name: field1Name, value: field1Value, inline: false });
  }

  if (field2Name && field2Value) {
    embed.addFields({ name: field2Name, value: field2Value, inline: false });
  }

  const sent = await channel.send({ embeds: [embed] });
  stickies.set(channel.id, {
    messageId: sent.id,
    content: null,
    embed: true,
    embedData: embed.toJSON(),
  });
  saveStickies();
  await interaction.reply({ content: 'Embed sticky created.', ephemeral: true });
}

async function handleDelete(interaction, stickies, saveStickies) {
  const channel = interaction.channel;
  const prev = stickies.get(channel.id);
  if (!prev) {
    await interaction.reply({ content: 'No sticky set.', ephemeral: true });
    return;
  }

  try {
    const oldMessage = await channel.messages.fetch(prev.messageId);
    await oldMessage.delete().catch(() => {});
  } catch {}

  stickies.delete(channel.id);
  saveStickies();
  await interaction.reply({ content: 'Sticky deleted.', ephemeral: true });
}
