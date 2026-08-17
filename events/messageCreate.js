const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { render } = require('../utils/tpl');
const { buildQuestEngine } = require('../services/questEngine');
const {
  addKudosEntry,
  calculateConversationKudos,
  canReplyAward,
  getGuildKudos,
} = require('../services/kudosService');

const refreshing = new Set();
const conversationSessions = new Map();

function isThankYouMessage(content) {
  const text = (content || '').toLowerCase().replace(/<@!?(\d+)>/g, '').trim();
  return /(thanks|thank you|much appreciated|thx|ty|appreciate it|appreciated)/.test(text) && !/(no thanks|not thanks|won't thank)/.test(text);
}

function matchesBumpCommand(content) {
  return /(^|\s)(!d\s*bump|!bump|\bbum[p]?(\s|$))/i.test(content || '');
}

function getConfiguredBumpDetection(guildId, bumpDetection) {
  return bumpDetection.get(guildId) || null;
}

function isValidConfiguredBump(message, config) {
  if (!config || config.enabled === false) {
    return false;
  }

  if (message.channel?.id !== config.channelId) return false;
  if (config.userId && message.author?.id !== config.userId) return false;

  const content = (message.content || '').toLowerCase();
  const embedText = (message.embeds || [])
    .map((embed) => [
      embed.title,
      embed.description,
      embed.footer?.text,
      embed.author?.name,
      ...(embed.fields || []).map((field) => `${field.name} ${field.value}`),
    ])
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const combinedText = `${content} ${embedText}`.trim();

  const successPatterns = [
    'bump done',
    'check it out on disboard',
    'bump done!',
    'bump!'
  ];

  const rejectPatterns = [
    'command list',
    'how do i add my server',
    'need help?',
    'help me',
    'need help',
  ];

  const hasRejectPattern = rejectPatterns.some((pattern) => combinedText.includes(pattern));
  if (hasRejectPattern) {
    return false;
  }

  const hasSuccessPattern = successPatterns.some((pattern) => combinedText.includes(pattern));
  if (hasSuccessPattern) {
    return true;
  }

  if (config.successText) {
    const targetText = String(config.successText).toLowerCase();
    return combinedText.includes(targetText);
  }

  return false;
}

function awardConversationKudos(guildMap, userId, now) {
  const key = `${userId}`;
  const session = conversationSessions.get(key) || { activeMs: 0, lastSeenAt: now };
  const elapsed = Math.max(0, now - (session.lastSeenAt || now));
  if (elapsed > 0 && elapsed <= 10 * 60 * 1000) {
    session.activeMs += elapsed;
  }
  session.lastSeenAt = now;

  if (session.activeMs < 30000) {
    conversationSessions.set(key, session);
    return 0;
  }

  const reward = calculateConversationKudos(session.activeMs);
  if (reward > 0) {
    addKudosEntry(guildMap, userId, reward, 'activity', 'Active conversation time', now);
    const profile = guildMap.get(userId) || { total: 0, history: [], activity: {} };
    const totalMs = Number(profile.activity?.totalMs || 0) + Number(session.activeMs || 0);
    profile.activity = { ...(profile.activity || {}), totalMs };
    guildMap.set(userId, profile);
  }

  session.activeMs = 0;
  session.lastSeenAt = now;
  conversationSessions.set(key, session);
  return reward;
}

const processedBumpMessages = new Set();

module.exports = {
  name: 'messageCreate',
  async execute(message, client, { stickies, saveStickies, verify, followups, bumpDetection, saveBumpDetection, kudos, saveKudos, quests, saveQuests }) {
    if (!message.guild) return;

    const config = getConfiguredBumpDetection(message.guild.id, bumpDetection);
    const isConfiguredBumpSource = Boolean(config && message.channel?.id === config.channelId && message.author?.id === config.userId && message.author?.bot);

    if (message.author.bot && !isConfiguredBumpSource) {
      return;
    }

    const guildMap = kudos.get(message.guild.id) || new Map();
    const now = Date.now();
    const guildQuestState = quests.get(message.guild.id) || { catalog: new Map(), memberProgress: new Map() };
    const questEngine = buildQuestEngine(guildQuestState);

    if (isConfiguredBumpSource && isValidConfiguredBump(message, config)) {
      if (processedBumpMessages.has(message.id)) {
        return;
      }
      processedBumpMessages.add(message.id);

      const reward = Number(config.reward) || 12;
      const claimButton = new ButtonBuilder()
        .setCustomId(`claim-bump:${message.guild.id}:${message.id}:${reward}`)
        .setLabel('Claim Kudos')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(claimButton);
      const claimText = 'Thanks for bumping the server! Click the button below to claim your kudos.';

      await message.channel.send({ content: claimText, components: [row] }).catch(() => {});
      return;
    }

    if (!message.author.bot && !message.author.system) {
      const configuredBump = config ? isValidConfiguredBump(message, config) : matchesBumpCommand(message.content);
      if (configuredBump || (!config && matchesBumpCommand(message.content))) {
        const current = getGuildKudos(guildMap, message.author.id);
        const lastBumpAt = current?.bump?.lastAt || 0;
        if (!lastBumpAt || now - lastBumpAt > 2 * 60 * 60 * 1000) {
          const reward = config?.reward || 12;
          addKudosEntry(guildMap, message.author.id, reward, 'bump', 'Server bump', now);
          const updated = getGuildKudos(guildMap, message.author.id);
          updated.bump = { ...(updated.bump || {}), lastAt: now, count: (updated.bump?.count || 0) + 1 };
          guildMap.set(message.author.id, updated);
          kudos.set(message.guild.id, guildMap);
          saveKudos();
        }
      }
    }

    const talkReward = awardConversationKudos(guildMap, message.author.id, now);
    if (talkReward > 0) {
      kudos.set(message.guild.id, guildMap);
      saveKudos();
    }

    if (message.content) {
      questEngine.recordMessage({
        userId: message.author.id,
        channelId: message.channel.id,
        otherUserId: message.mentions?.users?.first()?.id || null,
        content: message.content,
        now,
      });
      questEngine.recordDailyActivity({ userId: message.author.id, day: new Date(now).toISOString().slice(0, 10), now });
      quests.set(message.guild.id, questEngine.state);
      saveQuests();
    }

    if (message.reference && message.content && isThankYouMessage(message.content)) {
      const targetMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      const targetUser = targetMessage?.author;
      if (targetUser && targetUser.id !== message.author.id && canReplyAward(guildMap, message.author.id, targetUser.id, now)) {
        const reward = Math.min(14, 4 + (message.content.split(/\s+/).length > 10 ? 4 : 2));
        addKudosEntry(guildMap, targetUser.id, reward, 'gratitude', `Thanked by ${message.author.id}`, now);
        const giver = getGuildKudos(guildMap, message.author.id);
        giver.gratitude = {
          ...(giver.gratitude || {}),
          lastAwardAt: now,
          pairs: { ...(giver.gratitude?.pairs || {}), [targetUser.id]: now },
          recent: [...(giver.gratitude?.recent || []), now].slice(-10),
        };
        guildMap.set(message.author.id, giver);
        const targetProfile = getGuildKudos(guildMap, targetUser.id);
        targetProfile.gratitude = { ...(targetProfile.gratitude || {}), count: (targetProfile.gratitude?.count || 0) + 1 };
        guildMap.set(targetUser.id, targetProfile);
        kudos.set(message.guild.id, guildMap);
        saveKudos();

        // Gratitude responses are tracked as social feedback, but they do not satisfy the
        // explicit kudos achievements. Only the manual kudos command should advance those quests.
      }
    }

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
