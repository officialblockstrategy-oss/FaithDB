const { render } = require('../utils/tpl');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client, { greetings, verify }) {
    const guild = member.guild;
    const verifyCfg = verify.get(guild.id);
    const greetCfg = greetings.get(guild.id) || { msgs: [], channelId: null };
    const chan = greetCfg.channelId
      ? guild.channels.cache.get(greetCfg.channelId) || (verifyCfg ? guild.channels.cache.get(verifyCfg.channelId) : null) || guild.systemChannel
      : verifyCfg ? guild.channels.cache.get(verifyCfg.channelId) || guild.systemChannel : guild.systemChannel;

    if (!chan || !chan.isTextBased()) return;

    const list = greetCfg.msgs || [];
    const base = list.length ? list[Math.floor(Math.random() * list.length)] : `Welcome to ${guild.name}, ${member.displayName}!`;
    const text = render(base, { member, guild, word: verifyCfg?.word, channel: chan, role: verifyCfg?.roleId ? guild.roles.cache.get(verifyCfg.roleId) : undefined });

    await chan.send(text).catch(() => {});
  },
};
