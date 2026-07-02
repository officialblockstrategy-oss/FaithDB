function render(text, ctx = {}) {
  if (typeof text !== 'string') return '';

  const user = ctx.user || ctx.member?.user?.username || 'user';
  const name = ctx.name || ctx.member?.displayName || user;
  const mention = ctx.member ? `<@${ctx.member.id}>` : '@user';
  const server = ctx.guild?.name || 'this server';
  const word = ctx.word || 'verify';
  const channel = ctx.channel ? ctx.channel.toString() : 'the verification channel';
  const role = ctx.role ? `<@&${ctx.role.id}>` : 'the configured role';
  const normalized = text.replace(/\\n/g, '\n');

  return normalized
    .replace(/<\$user>/g, name)
    .replace(/<@user>/g, mention)
    .replace(/<@!user>/g, mention)
    .replace(/\{\{user\}\}/g, user)
    .replace(/\{\{username\}\}/g, user)
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{displayname\}\}/g, name)
    .replace(/\{\{mention\}\}/g, mention)
    .replace(/\{\{server\}\}/g, server)
    .replace(/\{\{word\}\}/g, word)
    .replace(/\{\{channel\}\}/g, channel)
    .replace(/\{\{role\}\}/g, role);
}

module.exports = { render };
