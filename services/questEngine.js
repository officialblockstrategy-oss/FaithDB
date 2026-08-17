const {
  getGuildQuestState,
  getQuestSummary,
  markQuestProgress,
  addMetadataSet,
  recordUniqueValue,
} = require('./questsService');

function buildQuestEngine(guildQuests) {
  const state = getGuildQuestState(guildQuests);

  function applyProgress(userId, questId, value, completed = null, meta = {}) {
    return markQuestProgress(state, userId, questId, value, completed, meta);
  }

  function trackUniqueQuestValue(userId, questId, key, value) {
    const result = recordUniqueValue(state, userId, questId, key, value);
    if (result && result.completed && questId !== 'quest-collector') {
      recordUniqueValue(state, userId, 'quest-collector', 'completed-quest-ids', questId);
    }
    return result;
  }

  function getMetaList(userId, questId, key) {
    const userProgress = state.memberProgress.get(userId) || new Map();
    const record = userProgress.get(questId) || { meta: {} };
    return Array.isArray(record.meta?.[key]) ? record.meta[key] : [];
  }

  function removeQuestProgress(userId, questId) {
    const userProgress = state.memberProgress.get(userId);
    if (!userProgress) {
      return false;
    }

    const removed = userProgress.delete(questId);
    const collector = userProgress.get('quest-collector');
    if (collector && Array.isArray(collector.meta?.['completed-quest-ids'])) {
      const ids = collector.meta['completed-quest-ids'].filter((id) => id !== questId);
      if (ids.length) {
        collector.meta['completed-quest-ids'] = ids;
        collector.progress = ids.length;
        collector.completed = ids.length >= Number((state.catalog.get('quest-collector') || {}).goal || 1);
        collector.completedAt = collector.completed ? (collector.completedAt || Date.now()) : null;
        userProgress.set('quest-collector', collector);
      } else {
        userProgress.delete('quest-collector');
      }
    }

    if (userProgress.size === 0) {
      state.memberProgress.delete(userId);
    }

    return removed;
  }

  function invalidateNoStringsAttached(userId) {
    const received = getMetaList(userId, 'first-thanks', 'received');
    if (!received.length) {
      return false;
    }

    const userProgress = state.memberProgress.get(userId);
    if (!userProgress) {
      return false;
    }

    const record = userProgress.get('no-strings-attached') || {
      questId: 'no-strings-attached',
      completed: false,
      progress: 0,
      completedAt: null,
      updatedAt: Date.now(),
      meta: {},
    };

    record.meta = { ...(record.meta || {}), disqualified: true };
    record.completed = false;
    record.progress = 0;
    record.updatedAt = Date.now();
    userProgress.set('no-strings-attached', record);
    state.memberProgress.set(userId, userProgress);
    return record;
  }

  function ensureNoStringsAttached(userId, now) {
    const received = getMetaList(userId, 'first-thanks', 'received');
    if (received.length > 0) {
      invalidateNoStringsAttached(userId);
      return null;
    }

    const existing = getMetaList(userId, 'no-strings-attached', 'giver-only');
    if (existing.length === 0) {
      return trackUniqueQuestValue(userId, 'no-strings-attached', 'giver-only', `${userId}:${now}`);
    }

    return null;
  }

  return {
    state,
    progress(userId, questId, value, completed = null, meta = {}) {
      return applyProgress(userId, questId, value, completed, meta);
    },
    addMeta(userId, questId, key, value) {
      return addMetadataSet(state, userId, questId, key, value);
    },
    recordUnique(userId, questId, key, value) {
      return trackUniqueQuestValue(userId, questId, key, value);
    },
    recordMessage({ userId, channelId, otherUserId, content = '', now = Date.now() }) {
      if (!userId) {
        return [];
      }

      const updates = [];
      const text = String(content || '');

      if (otherUserId) {
        updates.push(trackUniqueQuestValue(userId, 'first-hello', 'members', otherUserId));
        updates.push(trackUniqueQuestValue(userId, 'new-face', 'members', otherUserId));
        updates.push(trackUniqueQuestValue(userId, 'community-circle', 'members', otherUserId));
      }

      if (channelId) {
        updates.push(trackUniqueQuestValue(userId, 'cartographer', 'channels', channelId));
      }

      if (text && /(?:go(?:\s+to|\s+into)?|head\s+to|join|#\w+|channel)/i.test(text)) {
        const channelHint = text.match(/#?([a-z0-9_-]+)/i)?.[1] || `channel:${channelId || 'unknown'}`;
        updates.push(trackUniqueQuestValue(userId, 'directions-please', 'directions', channelHint));
      }

      if (text && /(?:heading\s+to\s+sleep|going\s+to\s+sleep|sleep\s+now|goodnight|nighty|bedtime)/i.test(text)) {
        updates.push(trackUniqueQuestValue(userId, 'one-more-thing', 'sleep-return', `${channelId || 'unknown'}:${now}`));
      }

      return updates.filter(Boolean);
    },
    recordKudos({ giverId, targetId, source = 'manual', now = Date.now() }) {
      if (!giverId || !targetId || giverId === targetId) {
        return [];
      }

      // Only explicit manual kudos awards should satisfy the kudos achievement tracks.
      // Conversation gratitude is a separate social signal and should not unlock these quests.
      if (source !== 'manual') {
        return [];
      }

      const pairKey = `${Math.min(giverId, targetId)}:${Math.max(giverId, targetId)}`;
      const updates = [];

      updates.push(trackUniqueQuestValue(giverId, 'first-kudos', 'given', targetId));
      const targetThanks = trackUniqueQuestValue(targetId, 'first-thanks', 'received', giverId);
      updates.push(targetThanks);
      updates.push(ensureNoStringsAttached(giverId, now));

      const giverGifts = getMetaList(giverId, 'first-kudos', 'given');
      const targetGifts = getMetaList(targetId, 'first-kudos', 'given');
      if (giverGifts.includes(targetId) && targetGifts.includes(giverId)) {
        updates.push(trackUniqueQuestValue(giverId, 'mutual-appreciation', 'mutual', targetId));
        updates.push(trackUniqueQuestValue(targetId, 'mutual-appreciation', 'mutual', giverId));
        updates.push(trackUniqueQuestValue(giverId, 'you-scratch-my-back', 'pairs', pairKey));
        updates.push(trackUniqueQuestValue(targetId, 'you-scratch-my-back', 'pairs', pairKey));
      }

      invalidateNoStringsAttached(targetId);
      return updates.filter(Boolean);
    },
    recordRole({ userId, roleId, now = Date.now() }) {
      if (!userId || !roleId) {
        return [];
      }

      return [
        trackUniqueQuestValue(userId, 'baby-steps', 'roles', roleId),
      ].filter(Boolean);
    },
    recordDailyActivity({ userId, day, now = Date.now() }) {
      if (!userId || !day) {
        return [];
      }

      const isoDay = String(day).slice(0, 10);
      const dayDate = new Date(`${isoDay}T00:00:00Z`);
      const startOfWeek = new Date(dayDate);
      const dayNumber = startOfWeek.getUTCDay();
      const diffToMonday = (dayNumber + 6) % 7;
      startOfWeek.setUTCDate(startOfWeek.getUTCDate() - diffToMonday);
      startOfWeek.setUTCHours(0, 0, 0, 0);
      const weekBucket = `${startOfWeek.toISOString().slice(0, 10)}`;
      const updates = [trackUniqueQuestValue(userId, 'three-day-rhythm', 'days', isoDay)];

      updates.push(trackUniqueQuestValue(userId, 'weekly-presence', 'weekly-days', weekBucket));

      return updates.filter(Boolean);
    },
    summary(userId) {
      return getQuestSummary(state, userId);
    },
  };
}

module.exports = {
  buildQuestEngine,
};
