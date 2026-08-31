const {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

function createGreetingId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeGreetingEntry(entry) {
  if (typeof entry === 'string') {
    return { id: createGreetingId(), text: entry, embed: false };
  }

  if (!entry || typeof entry !== 'object') {
    return null;
  }

  if (typeof entry.text !== 'string') {
    return null;
  }

  return {
    id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : createGreetingId(),
    text: entry.text,
    embed: Boolean(entry.embed),
  };
}

function normalizeGreetingConfig(cfg) {
  const rawMsgs = Array.isArray(cfg?.msgs) ? cfg.msgs : [];
  return {
    msgs: rawMsgs.map(normalizeGreetingEntry).filter(Boolean),
    channelId: cfg?.channelId || null,
    deleteAfterSeconds: Number.isInteger(cfg?.deleteAfterSeconds) && cfg.deleteAfterSeconds > 0
      ? cfg.deleteAfterSeconds
      : null,
  };
}

function buildGreetingEditModal(index, entry) {
  return new ModalBuilder()
    .setCustomId(`greeting-edit:${entry.id}`)
    .setTitle(`Edit Greeting #${index + 1}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('greeting_text')
          .setLabel('Greeting message')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(entry.text || '')
      )
    );
}

module.exports = {
  data: {
    name: 'greeting',
    description: 'Manage welcome greetings',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    dm_permission: false,
    options: [
      {
        name: 'add',
        description: 'Add a welcome greeting',
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: [
          {
            name: 'text',
            description: 'Add a plain text greeting',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'message',
                description: 'Greeting text',
                type: ApplicationCommandOptionType.String,
                required: true,
              },
            ],
          },
          {
            name: 'embed',
            description: 'Add an embed greeting',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'message',
                description: 'Greeting text',
                type: ApplicationCommandOptionType.String,
                required: true,
              },
            ],
          },
        ],
      },
      {
        name: 'channel',
        description: 'Set the channel for join greetings',
        type: ApplicationCommandOptionType.Subcommand,
        options: [{ name: 'channel', description: 'Channel for welcome messages', type: ApplicationCommandOptionType.Channel, required: true }],
      },
      {
        name: 'autodelete',
        description: 'Set auto-delete timeout for greeting messages',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'seconds',
            description: 'Delete delay in seconds (0 disables auto-delete)',
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 0,
            max_value: 604800,
          },
        ],
      },
      {
        name: 'edit',
        description: 'Edit one greeting by number',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'number',
            description: 'Greeting number from /greeting list',
            type: ApplicationCommandOptionType.Integer,
            required: true,
            min_value: 1,
          },
          {
            name: 'format',
            description: 'Optionally switch this greeting between text and embed format',
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
              { name: 'text', value: 'text' },
              { name: 'embed', value: 'embed' },
            ],
          },
        ],
      },
      {
        name: 'list',
        description: 'List all greetings',
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: 'remove',
        description: 'Remove greetings',
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: [
          {
            name: 'number',
            description: 'Remove one or more greetings by number',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'numbers',
                description: 'Greeting numbers separated by commas',
                type: ApplicationCommandOptionType.String,
                required: true,
              },
            ],
          },
          {
            name: 'all',
            description: 'Remove all greetings',
            type: ApplicationCommandOptionType.Subcommand,
          },
        ],
      },
    ],
  },

  async execute(interaction, client, { greetings, saveGreetings }) {
    // Greeting management for storing and listing welcome messages.
    if (!interaction.inGuild() || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission.', flags: 64 });
      return;
    }

    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const cfg = normalizeGreetingConfig(greetings.get(interaction.guildId) || { msgs: [], channelId: null, deleteAfterSeconds: null });

    if (group === 'add' && (sub === 'text' || sub === 'embed')) {
      cfg.msgs.push({
        id: createGreetingId(),
        text: interaction.options.getString('message', true),
        embed: sub === 'embed',
      });
      greetings.set(interaction.guildId, cfg);
      saveGreetings();
      await interaction.reply({ content: `Added ${sub} greeting #${cfg.msgs.length}.`, flags: 64 });
      return;
    }

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel', true);
      cfg.channelId = channel.id;
      greetings.set(interaction.guildId, cfg);
      saveGreetings();
      await interaction.reply({ content: `Join greetings will go to ${channel.toString()}.`, flags: 64 });
      return;
    }

    if (sub === 'autodelete') {
      const seconds = interaction.options.getInteger('seconds', true);
      cfg.deleteAfterSeconds = seconds > 0 ? seconds : null;
      greetings.set(interaction.guildId, cfg);
      saveGreetings();
      await interaction.reply({
        content: cfg.deleteAfterSeconds
          ? `Greeting auto-delete set to ${cfg.deleteAfterSeconds} second${cfg.deleteAfterSeconds === 1 ? '' : 's'}.`
          : 'Greeting auto-delete disabled.',
        flags: 64,
      });
      return;
    }

    if (sub === 'edit') {
      const number = interaction.options.getInteger('number', true);
      const index = number - 1;
      if (index < 0 || index >= cfg.msgs.length) {
        await interaction.reply({ content: 'That greeting number does not exist.', flags: 64 });
        return;
      }

      const format = interaction.options.getString('format');
      if (format === 'text' || format === 'embed') {
        cfg.msgs[index].embed = format === 'embed';
        greetings.set(interaction.guildId, cfg);
        saveGreetings();
      }

      await interaction.showModal(buildGreetingEditModal(index, cfg.msgs[index]));
      return;
    }

    if (sub === 'list') {
      if (!cfg.msgs.length) {
        await interaction.reply({ content: 'No greetings yet.', flags: 64 });
        return;
      }

      const autoDeleteSummary = cfg.deleteAfterSeconds
        ? `Auto-delete: ${cfg.deleteAfterSeconds}s`
        : 'Auto-delete: disabled';
      const channelSummary = cfg.channelId ? `Channel: <#${cfg.channelId}>` : 'Channel: not set';
      const list = cfg.msgs
        .map((entry, i) => `${i + 1}. [${entry.embed ? 'embed' : 'text'}] ${entry.text}`)
        .join('\n');
      await interaction.reply({ content: `${channelSummary}\n${autoDeleteSummary}\n\nGreetings:\n${list}`, flags: 64 });
      return;
    }

    if (group === 'remove') {
      if (sub === 'all') {
        if (!cfg.msgs.length) {
          await interaction.reply({ content: 'No greetings to remove.', flags: 64 });
          return;
        }
        cfg.msgs = [];
        greetings.set(interaction.guildId, cfg);
        saveGreetings();
        await interaction.reply({ content: 'All greetings removed.', flags: 64 });
        return;
      }

      if (sub === 'number') {
        const raw = interaction.options.getString('numbers', true);
        // Parse comma-separated greeting indexes and remove duplicates.
        const numbers = raw
          .split(',')
          .map((value) => parseInt(value.trim(), 10))
          .filter((value) => Number.isInteger(value));

        if (!numbers.length) {
          await interaction.reply({ content: 'Please provide one or more valid greeting numbers.', flags: 64 });
          return;
        }

        const uniqueNumbers = [...new Set(numbers)].sort((a, b) => a - b);
        const invalidNumbers = uniqueNumbers.filter((num) => num < 1 || num > cfg.msgs.length);
        const validNumbers = uniqueNumbers.filter((num) => num >= 1 && num <= cfg.msgs.length);

        if (!validNumbers.length) {
          await interaction.reply({ content: 'None of the provided greeting numbers are valid.', flags: 64 });
          return;
        }

        for (const num of validNumbers.slice().sort((a, b) => b - a)) {
          cfg.msgs.splice(num - 1, 1);
        }
        greetings.set(interaction.guildId, cfg);
        saveGreetings();

        let reply = `Removed greeting number${validNumbers.length > 1 ? 's' : ''} ${validNumbers.join(', ')}.`;
        if (invalidNumbers.length) {
          reply += ` Invalid numbers ignored: ${invalidNumbers.join(', ')}.`;
        }

        await interaction.reply({ content: reply, flags: 64 });
        return;
      }
    }
  },
};

module.exports.handleModalSubmit = async function handleModalSubmit(interaction, greetings, saveGreetings) {
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'You need Manage Server permission.', flags: 64 });
    return;
  }

  const [, greetingId] = interaction.customId.split(':');
  if (!greetingId) {
    await interaction.reply({ content: 'Invalid greeting edit request.', flags: 64 });
    return;
  }

  const cfg = normalizeGreetingConfig(greetings.get(interaction.guildId) || { msgs: [], channelId: null, deleteAfterSeconds: null });
  const index = cfg.msgs.findIndex((entry) => entry.id === greetingId);
  if (index === -1) {
    await interaction.reply({ content: 'That greeting no longer exists.', flags: 64 });
    return;
  }

  const nextText = interaction.fields.getTextInputValue('greeting_text').trim();
  if (!nextText) {
    await interaction.reply({ content: 'Greeting text cannot be empty.', flags: 64 });
    return;
  }

  cfg.msgs[index].text = nextText;
  greetings.set(interaction.guildId, cfg);
  saveGreetings();
  await interaction.reply({ content: `Updated greeting #${index + 1}.`, flags: 64 });
};
