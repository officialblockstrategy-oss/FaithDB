const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: {
    name: 'greeting',
    description: 'Manage welcome greetings',
    options: [
      {
        name: 'add',
        description: 'Add a welcome greeting',
        type: ApplicationCommandOptionType.Subcommand,
        options: [{ name: 'text', description: 'Greeting text', type: ApplicationCommandOptionType.String, required: true }],
      },
      {
        name: 'channel',
        description: 'Set the channel for join greetings',
        type: ApplicationCommandOptionType.Subcommand,
        options: [{ name: 'channel', description: 'Channel for welcome messages', type: ApplicationCommandOptionType.Channel, required: true }],
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
    if (!interaction.inGuild() || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const cfg = greetings.get(interaction.guildId) || { msgs: [], channelId: null };

    if (sub === 'add') {
      cfg.msgs.push(interaction.options.getString('text', true));
      greetings.set(interaction.guildId, cfg);
      saveGreetings();
      await interaction.reply({ content: `Added greeting #${cfg.msgs.length}.`, ephemeral: true });
      return;
    }

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel', true);
      cfg.channelId = channel.id;
      greetings.set(interaction.guildId, cfg);
      saveGreetings();
      await interaction.reply({ content: `Join greetings will go to ${channel.toString()}.`, ephemeral: true });
      return;
    }

    if (sub === 'list') {
      if (!cfg.msgs.length) {
        await interaction.reply({ content: 'No greetings yet.', ephemeral: true });
        return;
      }
      await interaction.reply({ content: `Greetings:\n${cfg.msgs.map((t, i) => `${i + 1}. ${t}`).join('\n')}`, ephemeral: true });
      return;
    }

    const group = interaction.options.getSubcommandGroup(false);
    if (group === 'remove') {
      if (sub === 'all') {
        if (!cfg.msgs.length) {
          await interaction.reply({ content: 'No greetings to remove.', ephemeral: true });
          return;
        }
        cfg.msgs = [];
        greetings.set(interaction.guildId, cfg);
        saveGreetings();
        await interaction.reply({ content: 'All greetings removed.', ephemeral: true });
        return;
      }

      if (sub === 'number') {
        const raw = interaction.options.getString('numbers', true);
        const numbers = raw
          .split(',')
          .map((value) => parseInt(value.trim(), 10))
          .filter((value) => Number.isInteger(value));

        if (!numbers.length) {
          await interaction.reply({ content: 'Please provide one or more valid greeting numbers.', ephemeral: true });
          return;
        }

        const uniqueNumbers = [...new Set(numbers)].sort((a, b) => a - b);
        const invalidNumbers = uniqueNumbers.filter((num) => num < 1 || num > cfg.msgs.length);
        const validNumbers = uniqueNumbers.filter((num) => num >= 1 && num <= cfg.msgs.length);

        if (!validNumbers.length) {
          await interaction.reply({ content: 'None of the provided greeting numbers are valid.', ephemeral: true });
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

        await interaction.reply({ content: reply, ephemeral: true });
        return;
      }
    }
  },
};
