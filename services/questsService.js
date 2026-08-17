const DEFAULT_QUESTS = [
  { id: 'first-hello', title: 'First Hello', description: 'Start a conversation with someone for the first time.', category: 'social', goal: 1, hidden: false },
  { id: 'new-face', title: 'New Face', description: 'Interact with someone you have never spoken with before.', category: 'social', goal: 1, hidden: false },
  { id: 'community-circle', title: 'Community Circle', description: 'Talk to 5 different members.', category: 'social', goal: 5, hidden: false },
  { id: 'cartographer', title: 'Cartographer', description: 'Talk in 4 different channels.', category: 'social', goal: 4, hidden: false },
  { id: 'helpful-hand', title: 'Helpful Hand', description: 'Help someone and receive a thank-you.', category: 'social', goal: 1, hidden: false },
  { id: 'directions-please', title: 'Directions, Please', description: 'Direct someone to a specific channel.', category: 'social', goal: 1, hidden: false },
  { id: 'pull-up-a-chair', title: 'Pull Up a Chair', description: 'Join a conversation that has lasted at least 30 minutes.', category: 'social', goal: 1, hidden: false },
  { id: 'i-was-here', title: 'I Was Here', description: 'Take part in a conversation that is still going after 20+ minutes away.', category: 'social', goal: 1, hidden: false },
  { id: 'the-round-table', title: 'The Round Table', description: 'Be part of a conversation with 4 or more people.', category: 'social', goal: 1, hidden: false },
  { id: 'one-more-thing', title: 'One More Thing...', description: 'Secret: return to a conversation after saying you are going to sleep.', category: 'secret', goal: 1, hidden: true },
  { id: 'first-kudos', title: 'First Kudos', description: 'Give kudos to someone for the first time.', category: 'kudos', goal: 1, hidden: false },
  { id: 'first-thanks', title: 'First Thanks', description: 'Receive kudos for the first time.', category: 'kudos', goal: 1, hidden: false },
  { id: 'mutual-appreciation', title: 'Mutual Appreciation', description: 'Exchange kudos with 3 different members.', category: 'kudos', goal: 3, hidden: false },
  { id: 'you-scratch-my-back', title: 'You Scratch My Back', description: 'Exchange kudos with the same person.', category: 'kudos', goal: 1, hidden: false },
  { id: 'pay-it-forward', title: 'Pay It Forward', description: 'Receive kudos and then give kudos to someone else.', category: 'kudos', goal: 1, hidden: false },
  { id: 'no-strings-attached', title: 'No Strings Attached', description: 'Give kudos without receiving any in return.', category: 'kudos', goal: 1, hidden: false },
  { id: 'three-day-rhythm', title: 'Three-Day Rhythm', description: 'Be active on 3 different days.', category: 'activity', goal: 3, hidden: false },
  { id: 'weekly-presence', title: 'Weekly Presence', description: 'Be active on 3 different days in a single week.', category: 'activity', goal: 3, hidden: false },
  { id: 'baby-steps', title: 'Baby Steps', description: 'Apply a role for the first time.', category: 'role', goal: 1, hidden: false },
  { id: 'quest-collector', title: 'Quest Collector', description: 'Complete 5 quests.', category: 'milestone', goal: 5, hidden: false },
];

function getDefaultQuestCatalog() {
  return new Map(DEFAULT_QUESTS.map((quest) => [quest.id, { ...quest, enabled: true, createdAt: Date.now() }]));
}

function ensureGuildQuestState(guildQuests) {
  const state = guildQuests && typeof guildQuests === 'object' ? guildQuests : { catalog: new Map(), memberProgress: new Map() };
  const catalog = state.catalog instanceof Map ? state.catalog : new Map();
  const memberProgress = state.memberProgress instanceof Map ? state.memberProgress : new Map();
  const defaultCatalog = getDefaultQuestCatalog();

  for (const [questId, quest] of defaultCatalog.entries()) {
    if (!catalog.has(questId)) {
      catalog.set(questId, { ...quest });
    } else {
      catalog.set(questId, { ...quest, ...(catalog.get(questId) || {}), enabled: catalog.get(questId).enabled !== false });
    }
  }

  state.catalog = catalog;
  state.memberProgress = memberProgress;
  return state;
}

function getGuildQuestState(guildQuests) {
  if (!guildQuests) return { catalog: getDefaultQuestCatalog(), memberProgress: new Map() };
  return ensureGuildQuestState(guildQuests);
}

function getUserQuestProgress(guildQuests, userId) {
  const state = getGuildQuestState(guildQuests);
  return state.memberProgress.get(userId) || new Map();
}

function getQuestRecord(guildQuests, userId, questId) {
  const progress = getUserQuestProgress(guildQuests, userId);
  const existing = progress.get(questId);
  if (existing) return existing;

  const fallback = {
    questId,
    completed: false,
    progress: 0,
    completedAt: null,
    updatedAt: Date.now(),
    meta: {},
  };
  progress.set(questId, fallback);
  const state = getGuildQuestState(guildQuests);
  state.memberProgress.set(userId, progress);
  return fallback;
}

function addMetadataSet(guildQuests, userId, questId, key, value) {
  const state = getGuildQuestState(guildQuests);
  const progress = state.memberProgress.get(userId) || new Map();
  const current = getQuestRecord(state, userId, questId);
  const meta = { ...(current.meta || {}) };
  const list = Array.isArray(meta[key]) ? [...meta[key]] : [];
  if (value !== undefined && value !== null && !list.includes(value)) {
    list.push(value);
  }
  meta[key] = list;
  current.meta = meta;
  current.progress = list.length;
  current.updatedAt = Date.now();
  progress.set(questId, current);
  state.memberProgress.set(userId, progress);
  return current;
}

function recordUniqueValue(guildQuests, userId, questId, key, value) {
  const state = getGuildQuestState(guildQuests);
  const progress = state.memberProgress.get(userId) || new Map();
  const current = getQuestRecord(state, userId, questId);
  const meta = { ...(current.meta || {}) };
  const values = Array.isArray(meta[key]) ? [...meta[key]] : [];
  if (value !== undefined && value !== null && !values.includes(value)) {
    values.push(value);
  }
  meta[key] = values;
  const goal = Number((state.catalog.get(questId) || {}).goal || 1);
  const completed = values.length >= goal;
  const updated = {
    ...current,
    completed,
    progress: values.length,
    completedAt: completed ? (current.completedAt || Date.now()) : null,
    updatedAt: Date.now(),
    meta,
  };
  progress.set(questId, updated);
  state.memberProgress.set(userId, progress);
  return updated;
}

function markQuestProgress(guildQuests, userId, questId, nextProgress = null, completed = null, meta = {}) {
  const state = getGuildQuestState(guildQuests);
  const userProgress = state.memberProgress.get(userId) || new Map();
  const current = getQuestRecord(state, userId, questId);
  const quest = state.catalog.get(questId) || null;
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
    meta: { ...(current.meta || {}), ...(meta || {}) },
  };

  userProgress.set(questId, updated);
  state.memberProgress.set(userId, userProgress);
  return updated;
}

function getQuestSummary(guildQuests, userId) {
  const state = getGuildQuestState(guildQuests);
  const userProgress = getUserQuestProgress(state, userId);
  const completed = [];
  const incomplete = [];

  for (const [questId, quest] of state.catalog.entries()) {
    const record = userProgress.get(questId) || {
      questId,
      completed: false,
      progress: 0,
      completedAt: null,
      updatedAt: Date.now(),
      meta: {},
    };

    if (record.meta && record.meta.disqualified) {
      continue;
    }

    const entry = {
      id: quest.id || questId,
      title: quest.title || questId,
      description: quest.description || '',
      enabled: quest.enabled !== false,
      progress: Number(record.progress || 0),
      goal: Number(quest.goal || 1),
      completed: Boolean(record.completed),
      completedAt: record.completedAt || null,
      hidden: Boolean(quest.hidden),
      category: quest.category || 'general',
    };

    if (entry.completed) {
      completed.push(entry);
    } else if (!entry.hidden) {
      incomplete.push(entry);
    }
  }

  return { completed, incomplete };
}

module.exports = {
  DEFAULT_QUESTS,
  getDefaultQuestCatalog,
  ensureGuildQuestState,
  getGuildQuestState,
  getUserQuestProgress,
  getQuestRecord,
  addMetadataSet,
  recordUniqueValue,
  markQuestProgress,
  getQuestSummary,
};
