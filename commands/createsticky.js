const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
  data: {
    name: 'createsticky',
    description: 'Create a sticky message for this channel',
    options: [
      {
        name: 'message',
        description: 'Message to stick',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  async execute(interaction, client, { stickies, saveStickies }) {
    const channel = interaction.channel;
    const text = interaction.options.getString('message', true);
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
  },
};
