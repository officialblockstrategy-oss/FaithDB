const { Collection } = require('discord.js');

function getGuildKudos(guildMap, userId) {
  if (!guildMap) return null;
  return guildMap.get(userId) || {
    total: 0,
    history: [],
    manual: {},
    gratitude: {},
    bump: {},
    activity: {},
  };
}

function addKudosEntry(guildMap, userId, amount, source, reason, now = Date.now()) {
  if (!guildMap) return { total: 0, entry: null };
  const current = getGuildKudos(guildMap, userId);
  const entry = {
    amount,
    source,
    reason,
    createdAt: now,
  };
  current.total = Number(current.total || 0) + Number(amount || 0);
  current.history = Array.isArray(current.history) ? [...current.history, entry] : [entry];
  if (current.history.length > 200) {
    current.history = current.history.slice(-200);
  }
  guildMap.set(userId, current);
  return { total: current.total, entry };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function calculateConversationKudos(sessionMilliseconds) {
  const minutes = Math.max(0, sessionMilliseconds / 60000);
  if (minutes <= 0) return 0;
  const base = minutes * 0.75;
  const boost = Math.pow(1.45, Math.min(minutes, 30) / 4);
  return Number((base * boost).toFixed(2));
}

function estimateReplyKudos(replyCount, totalReplyWindowHours) {
  const normalized = Math.max(0, replyCount - 1);
  const hours = Math.max(1, totalReplyWindowHours || 1);
  return Number(Math.min(18, (normalized + 2) * (2.5 + Math.log(hours + 1))).toFixed(2));
}

function getKudosStats(guildMap, userId) {
  const rec = getGuildKudos(guildMap, userId);
  return {
    total: Number(rec.total || 0),
    history: Array.isArray(rec.history) ? rec.history : [],
  };
}

function formatDuration(milliseconds) {
  const totalMs = Math.max(0, Number(milliseconds || 0));
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function getProfileMetrics(guildMap, userId) {
  const record = getGuildKudos(guildMap, userId);
  const history = Array.isArray(record.history) ? record.history : [];
  const total = Number(record.total || 0);
  const manualReceived = history.filter((entry) => entry && entry.source === 'manual').length;
  const thankedCount = history.filter((entry) => entry && entry.source === 'gratitude').length;
  const bumpCount = history.filter((entry) => entry && entry.source === 'bump').length;
  const activityMs = Number(record.activity?.totalMs || 0);

  return {
    total,
    manualReceived,
    thankedCount,
    bumpCount,
    activityMs,
    activityText: formatDuration(activityMs),
  };
}

function canReplyAward(guildMap, giverId, targetId, now = Date.now()) {
  if (!guildMap || giverId === targetId) return false;

  const giver = getGuildKudos(guildMap, giverId);
  const gratitude = giver.gratitude || {};
  const recent = Array.isArray(gratitude.recent) ? gratitude.recent : [];
  const pair = gratitude.pairs && gratitude.pairs[targetId] ? gratitude.pairs[targetId] : null;

  if (pair && now - pair < 60 * 60 * 1000) return false;
  if (recent.filter((time) => now - time < 60 * 60 * 1000).length >= 3) return false;
  if (gratitude.lastAwardAt && now - gratitude.lastAwardAt < 90 * 1000) return false;

  return true;
}

module.exports = {
  getGuildKudos,
  addKudosEntry,
  calculateConversationKudos,
  estimateReplyKudos,
  getKudosStats,
  getProfileMetrics,
  canReplyAward,
  clamp,
  formatDuration,
};
