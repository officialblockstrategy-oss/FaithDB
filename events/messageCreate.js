const { render } = require('../utils/tpl');

const refreshing = new Set();

module.exports = {
  name: 'messageCreate',
  async execute(message, client, { stickies, saveStickies, verify, followups }) {
    if (message.author.bot || !message.guild) return;

    // Verification and clean-channel handling takes precedence over sticky refresh.
    const cfg = verify.get(message.guild.id);
    if (cfg) {
      const isVerify = message.channel.id === cfg.channelId;
      const isClean = Array.isArray(cfg.cleanChannels) && cfg.cleanChannels.includes(message.channel.id);
      if (isVerify) {
        const member = message.member;
        const role = member?.guild.roles.cache.get(cfg.roleId);
        if (member && role && message.content.trim().toLowerCase() === cfg.word.trim().toLowerCase() && !member.roles.cache.has(role.id)) {
          try {
            await member.roles.add(role);
          } catch {}

          const list = followups.get(message.guild.id) || [];
          if (list.length) {
            const text = render(list[Math.floor(Math.random() * list.length)], { member, guild: message.guild, word: cfg.word, channel: message.channel, role });
            try {
              await member.send(text);
            } catch {}
          }

          await message.delete().catch(() => {});
        } else if (!message.author.bot) {
          await message.delete().catch(() => {});
        }
        return;
      }

      if (isClean && !message.author.bot) {
        await message.delete().catch(() => {});
        return;
      }
    }

    // Sticky message support: when a new message appears in a channel with a sticky,
    // delete the previous sticky message and repost it so it stays at the bottom.
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

      const sent = prev.embedData
        ? await message.channel.send({ embeds: [prev.embedData] })
        : await message.channel.send(prev.content);

      stickies.set(channelId, {
        messageId: sent.id,
        content: prev.content,
        embed: prev.embed || false,
        embedData: prev.embedData,
      });
      saveStickies();
    } finally {
      refreshing.delete(channelId);
    }
  },
};
