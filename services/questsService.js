function getGuildQuestState(guildQuests, guildId) {
  if (!guildQuests) return { catalog: new Map(), memberProgress: new Map() };
  return {
    catalog: guildQuests.catalog || new Map(),
    memberProgress: guildQuests.memberProgress || new Map(),
  };
}

function getUserQuestProgress(guildQuests, userId) {
  const state = getGuildQuestState(guildQuests);
  return state.memberProgress.get(userId) || new Map();
}

function getQuestRecord(guildQuests, userId, questId) {
  const progress = getUserQuestProgress(guildQuests, userId);
  return progress.get(questId) || {
    questId,
    completed: false,
    progress: 0,
    completedAt: null,
    updatedAt: Date.now(),
  };
}

function markQuestProgress(guildQuests, userId, questId, nextProgress = null, completed = null) {
  const guildState = getGuildQuestState(guildQuests);
  const userProgress = guildState.memberProgress.get(userId) || new Map();
  const current = getQuestRecord(guildQuests, userId, questId);
  const quest = guildState.catalog.get(questId) || null;
  const now = Date.now();

  const progressValue = nextProgress === null ? Number(current.progress || 0) : Number(nextProgress || 0);
  const finalCompleted = completed === null ? Boolean(quest && progressValue >= Number(quest.goal || 1)) : Boolean(completed);

  const updated = {
    ...current,
    questId,
    progress: finalCompleted ? Math.max(progressValue, Number(quest?.goal || progressValue || 0)) : progressValue,
    completed: finalCompleted,
    completedAt: finalCompleted ? (current.completedAt || now) : null,
    updatedAt: now,
  };

  userProgress.set(questId, updated);
  guildState.memberProgress.set(userId, userProgress);
  return updated;
}

function getQuestSummary(guildQuests, userId) {
  const state = getGuildQuestState(guildQuests);
  const userProgress = getUserQuestProgress(guildQuests, userId);
  const completed = [];
  const incomplete = [];

  for (const [questId, quest] of state.catalog.entries()) {
    const record = userProgress.get(questId) || {
      questId,
      completed: false,
      progress: 0,
      completedAt: null,
      updatedAt: Date.now(),
    };

    const entry = {
      id: quest.id || questId,
      title: quest.title || questId,
      description: quest.description || '',
      enabled: quest.enabled !== false,
      progress: Number(record.progress || 0),
      goal: Number(quest.goal || 1),
      completed: Boolean(record.completed),
      completedAt: record.completedAt || null,
    };

    if (entry.completed) {
      completed.push(entry);
    } else {
      incomplete.push(entry);
    }
  }

  return { completed, incomplete };
}

module.exports = {
  getGuildQuestState,
  getUserQuestProgress,
  getQuestRecord,
  markQuestProgress,
  getQuestSummary,
};
