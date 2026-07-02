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
        description: 'Remove a greeting by number',
        type: ApplicationCommandOptionType.Subcommand,
        options: [{ name: 'number', description: 'Greeting number', type: ApplicationCommandOptionType.Integer, required: true }],
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

    if (sub === 'remove') {
      const num = interaction.options.getInteger('number', true);
      if (num < 1 || num > cfg.msgs.length) {
        await interaction.reply({ content: 'That greeting does not exist.', ephemeral: true });
        return;
      }
      cfg.msgs.splice(num - 1, 1);
      greetings.set(interaction.guildId, cfg);
      saveGreetings();
      await interaction.reply({ content: 'Greeting removed.', ephemeral: true });
      return;
    }
  },
};
