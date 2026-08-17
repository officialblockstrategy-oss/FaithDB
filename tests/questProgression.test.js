const assert = require('assert');
const { buildQuestEngine } = require('../services/questEngine');

const guildQuests = { catalog: new Map(), memberProgress: new Map() };
const engine = buildQuestEngine(guildQuests);

engine.recordMessage({ userId: 'user-1', channelId: 'channel-1', otherUserId: 'user-2', content: 'hello there', now: 1_000 });
engine.recordMessage({ userId: 'user-1', channelId: 'channel-2', otherUserId: 'user-3', content: 'hi friend', now: 2_000 });
engine.recordMessage({ userId: 'user-1', channelId: 'channel-3', otherUserId: 'user-4', content: 'go to #general and ask there', now: 3_000 });
engine.recordMessage({ userId: 'user-1', channelId: 'channel-4', otherUserId: 'user-5', content: 'catch you later, heading to sleep', now: 4_000 });
engine.recordKudos({ giverId: 'user-1', targetId: 'user-2', source: 'manual', now: 5_000 });
engine.recordRole({ userId: 'user-1', roleId: 'role-1', now: 6_000 });
engine.recordDailyActivity({ userId: 'user-1', day: '2025-01-01', now: 7_000 });
engine.recordDailyActivity({ userId: 'user-1', day: '2025-01-02', now: 8_000 });
engine.recordDailyActivity({ userId: 'user-1', day: '2025-01-03', now: 9_000 });

const summary = engine.summary('user-1');
assert.ok(summary.completed.some((quest) => quest.id === 'first-hello' && quest.progress >= 1), 'First hello should count as progress');
assert.ok(summary.incomplete.some((quest) => quest.id === 'community-circle' && quest.progress >= 3), 'Community circle should track unique members even before it reaches 5');
assert.ok(summary.completed.some((quest) => quest.id === 'directions-please' && quest.progress >= 1), 'Direction messages should register');
assert.ok(summary.completed.some((quest) => quest.id === 'first-kudos' && quest.progress >= 1), 'Giving kudos should advance the quest');
assert.ok(summary.incomplete.some((quest) => quest.id === 'you-scratch-my-back'), 'A one-way manual kudos award should not complete the same-person exchange quest');
assert.ok(summary.completed.some((quest) => quest.id === 'no-strings-attached'), 'A single one-way manual kudos award should satisfy no-strings-attached');
assert.ok(summary.completed.some((quest) => quest.id === 'baby-steps' && quest.progress >= 1), 'A role application should count');
assert.ok(summary.completed.some((quest) => quest.id === 'three-day-rhythm' && quest.progress >= 3), 'Three-day rhythm should count unique active days');

const gratitudeOnly = buildQuestEngine({ catalog: new Map(), memberProgress: new Map() });
const gratitudeResult = gratitudeOnly.recordKudos({ giverId: 'g', targetId: 't', source: 'gratitude', now: 7000 });
assert.deepStrictEqual(gratitudeResult, [], 'Gratitude-only responses should not trigger the explicit kudos quest track');

const mutualState = { catalog: new Map(), memberProgress: new Map() };
const mutualEngine = buildQuestEngine(mutualState);
mutualEngine.recordKudos({ giverId: 'a', targetId: 'b', source: 'manual', now: 1_000 });
mutualEngine.recordKudos({ giverId: 'b', targetId: 'a', source: 'manual', now: 2_000 });
const mutualSummary = mutualEngine.summary('a');
assert.ok(mutualSummary.completed.some((quest) => quest.id === 'you-scratch-my-back'), 'A true mutual exchange should satisfy the same-person exchange quest');
assert.ok(mutualSummary.incomplete.some((quest) => quest.id === 'no-strings-attached') === false, 'A mutual exchange should not be treated as no-strings-attached');

const collectorState = { catalog: new Map(), memberProgress: new Map() };
const collectorEngine = buildQuestEngine(collectorState);
collectorEngine.recordMessage({ userId: 'u-1', channelId: 'c-1', otherUserId: 'u-2', content: 'hello', now: 1_000 });
collectorEngine.recordMessage({ userId: 'u-1', channelId: 'c-2', otherUserId: 'u-3', content: 'hi', now: 2_000 });
collectorEngine.recordKudos({ giverId: 'u-1', targetId: 'u-2', source: 'manual', now: 3_000 });
collectorEngine.recordRole({ userId: 'u-1', roleId: 'r-1', now: 4_000 });
const collectorSummary = collectorEngine.summary('u-1');
assert.ok(collectorSummary.completed.some((quest) => quest.id === 'quest-collector' && quest.progress >= 3), 'The collector quest should count actual completed quest milestones, not arbitrary role events');

console.log('quest progress ok');
