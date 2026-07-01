const refreshing = new Set();

module.exports = {
  name: 'messageCreate',
  async execute(message, client, { stickies, saveStickies }) {
    if (message.author.bot) return;

    const channelId = message.channel.id;
    if (refreshing.has(channelId)) return;

    const prev = stickies.get(channelId);
    if (!prev) return;

    refreshing.add(channelId);
    try {
      try {
        const oldMessage = await message.channel.messages.fetch(prev.messageId);
        await oldMessage.delete().catch(() => {});
      } catch {}

      const sent = await message.channel.send(prev.content);
      stickies.set(channelId, { messageId: sent.id, content: prev.content });
      saveStickies();
    } finally {
      refreshing.delete(channelId);
    }
  },
};
