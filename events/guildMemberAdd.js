const { render } = require('../utils/tpl');
const { EmbedBuilder } = require('discord.js');

function normalizeGreetingEntry(entry) {
  if (typeof entry === 'string') {
    return { text: entry, embed: false };
  }

  if (!entry || typeof entry !== 'object' || typeof entry.text !== 'string') {
    return null;
  }

  return {
    text: entry.text,
    embed: Boolean(entry.embed),
  };
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client, { greetings, verify }) {
    const guild = member.guild;
    const verifyCfg = verify.get(guild.id);
    const greetCfg = greetings.get(guild.id) || { msgs: [], channelId: null, deleteAfterSeconds: null };

    // If no greeting channel is configured, skip greeting entirely.
    if (!greetCfg.channelId) {
      return;
    }

    const chan = guild.channels.cache.get(greetCfg.channelId);

    if (!chan || !chan.isTextBased()) return;

    const list = (Array.isArray(greetCfg.msgs) ? greetCfg.msgs : [])
      .map(normalizeGreetingEntry)
      .filter(Boolean);

    if (!list.length) {
      return;
    }

    const selected = list[Math.floor(Math.random() * list.length)];
    const text = render(selected.text, {
      member,
      guild,
      word: verifyCfg?.word,
      channel: chan,
      role: verifyCfg?.roleId ? guild.roles.cache.get(verifyCfg.roleId) : undefined,
    });

    const sent = selected.embed
      ? await chan.send({ embeds: [new EmbedBuilder().setDescription(text)] }).catch(() => null)
      : await chan.send(text).catch(() => null);

    const deleteAfterSeconds = Number.isInteger(greetCfg.deleteAfterSeconds) && greetCfg.deleteAfterSeconds > 0
      ? greetCfg.deleteAfterSeconds
      : null;

    if (sent && deleteAfterSeconds) {
      setTimeout(() => {
        sent.delete().catch(() => {});
      }, deleteAfterSeconds * 1000);
    }
  },
};
