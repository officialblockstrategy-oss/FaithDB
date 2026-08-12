async function runVeriPurgeCheck(client, verify, saveVerify) {
  for (const [guildId, cfg] of verify.entries()) {
    if (!cfg || !Number.isFinite(Number(cfg.purgeDays)) || Number(cfg.purgeDays) <= 0) {
      continue;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    const purgeMs = Number(cfg.purgeDays) * 24 * 60 * 60 * 1000;
    const warnMs = Number(cfg.purgeWarnHours || 0) * 60 * 60 * 1000;
    const warnText = typeof cfg.purgeWarnText === 'string' && cfg.purgeWarnText.trim()
      ? cfg.purgeWarnText.trim()
      : 'You still have not verified and will be kicked soon.';
    const warnedUsers = cfg.warnedUsers && typeof cfg.warnedUsers === 'object' ? cfg.warnedUsers : {};
    const now = Date.now();

    for (const member of guild.members.cache.values()) {
      if (member.user.bot) continue;
      if (member.roles.cache.size > 1) continue;
      if (!member.joinedAt) continue;

      const ageMs = now - member.joinedAt.getTime();
      const remainingMs = purgeMs - ageMs;

      if (cfg.purgeEnabled === true && ageMs >= purgeMs) {
        try {
          await member.send(`You were kicked from ${guild.name} because you still had no verified role after ${cfg.purgeDays} day${cfg.purgeDays === 1 ? '' : 's'}.`).catch(() => {});
        } catch {}

        try {
          await guild.members.kick(member.id, 'Unverified for the configured purge period').catch(() => {});
        } catch {}

        if (warnedUsers[member.id]) delete warnedUsers[member.id];
        continue;
      }

      if (cfg.purgeWarnEnabled === true && warnMs > 0 && remainingMs > 0 && remainingMs <= warnMs && !warnedUsers[member.id]) {
        try {
          await member.send(warnText).catch(() => {});
        } catch {}
        warnedUsers[member.id] = now;
      }

      if (cfg.purgeWarnEnabled === true && warnMs > 0 && remainingMs > warnMs && warnedUsers[member.id]) {
        delete warnedUsers[member.id];
      }
    }

    if (cfg.purgeEnabled === true || cfg.purgeWarnEnabled === true) {
      cfg.warnedUsers = warnedUsers;
      verify.set(guildId, cfg);
      saveVerify();
    }
  }
}

function startVeriPurgeLoop(client, verify, saveVerify) {
  setInterval(() => {
    runVeriPurgeCheck(client, verify, saveVerify).catch((error) => {
      console.error('Veri purge check failed:', error);
    });
  }, 60 * 60 * 1000);
}

module.exports = {
  runVeriPurgeCheck,
  startVeriPurgeLoop,
};
