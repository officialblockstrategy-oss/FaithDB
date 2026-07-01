module.exports = {
  data: {
    name: 'deletesticky',
    description: 'Delete the sticky message in this channel',
  },

  async execute(interaction, client, { stickies, saveStickies }) {
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
  },
};
