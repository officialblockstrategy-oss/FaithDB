const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { addKudosEntry, getGuildKudos } = require('../services/kudosService');

function getBumpStats(guildMap, userId) {
  const record = getGuildKudos(guildMap, userId);
  const history = Array.isArray(record?.bump?.history) ? record.bump.history : [];
  const uniqueDays = [...new Set(history.map((timestamp) => new Date(Number(timestamp)).toISOString().slice(0, 10)))];

  let streak = 0;
  const today = new Date();
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (uniqueDays.includes(iso)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  const perDayCounts = history.reduce((map, timestamp) => {
    const iso = new Date(Number(timestamp)).toISOString().slice(0, 10);
    map[iso] = (map[iso] || 0) + 1;
    return map;
  }, {});

  const bestDayCount = Object.values(perDayCounts).reduce((max, count) => Math.max(max, count), 0);

  return {
    streak,
    bestDayCount,
    totalBumps: history.length,
  };
}

function buildProfileNavRow(guildId, userId, current = 'profile') {
  const leftDisabled = current === 'profile';
  const rightDisabled = current === 'streak';

  const leftButton = new ButtonBuilder()
    .setCustomId(`nav-profile:${guildId}:${userId}`)
    .setEmoji('⬅️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(leftDisabled);

  const rightButton = new ButtonBuilder()
    .setCustomId(`nav-streak:${guildId}:${userId}`)
    .setEmoji('➡️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(rightDisabled);

  return new ActionRowBuilder().addComponents(leftButton, rightButton);
}

function buildStreakEmbed(guildMap, userId) {
  const stats = getBumpStats(guildMap, userId);

  return new EmbedBuilder()
    .setTitle('Bump Streak')
    .setColor(0xEB583B)
    .setDescription([
      '```text',
      `Current Streak: ${stats.streak} day${stats.streak === 1 ? '' : 's'}`,
      `Best Day: ${stats.bestDayCount} bumps`,
      `Total Bumps: ${stats.totalBumps}`,
      '```',
    ].join('\n'));
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client, context) {
    if (interaction.isButton() && interaction.customId?.startsWith('claim-bump:')) {
      return handleClaimBump(interaction, context);
    }

    if (interaction.isButton() && interaction.customId?.startsWith('check-bump-streak:')) {
      return handleCheckBumpStreak(interaction, context);
    }

    if (interaction.isButton() && interaction.customId?.startsWith('nav-profile:')) {
      return handleProfileNavigation(interaction, context, 'profile');
    }

    if (interaction.isButton() && interaction.customId?.startsWith('nav-streak:')) {
      return handleProfileNavigation(interaction, context, 'streak');
    }

    if (
      interaction.isButton() &&
      (interaction.customId?.startsWith('quests-nav-left:') || interaction.customId?.startsWith('quests-nav-right:'))
    ) {
      return handleQuestNavigation(interaction, context);
    }

    if (interaction.isButton() && interaction.customId?.startsWith('quests-toggle:')) {
      return handleQuestToggle(interaction, context);
    }

    // Handle select menu interactions for reaction role panels first.
    if (interaction.isStringSelectMenu()) {
      return handleReactionRoleSelect(interaction, context);
    }

    // Handle panel modals before command execution.
    if (interaction.isModalSubmit() && interaction.customId?.startsWith('panel-')) {
      const panelCommand = client.commands.get('panel');
      if (panelCommand?.handleModalSubmit) {
        return panelCommand.handleModalSubmit(interaction, context.panels, context.savePanels);
      }
    }

    const commandName = interaction.commandName || interaction.command?.name;
    if (!commandName) {
      return;
    }

    const command = client.commands.get(commandName);
    if (!command) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Unknown command.', flags: 64 });
      }
      return;
    }

    try {
      await command.execute(interaction, client, context);
    } catch (error) {
      console.error('Interaction command error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Something went wrong.', flags: 64 });
      }
    }
  },
};

async function handleClaimBump(interaction, context) {
  const parts = interaction.customId.split(':');
  const guildId = parts[1];
  const targetMessageId = parts.length >= 4 ? parts[2] : null;
  const rewardRaw = parts.length >= 4 ? parts[3] : parts[2];
  const reward = Number(rewardRaw) || 12;
  const bumpConfig = context.bumpDetection?.get(guildId) || {};
  const reactionEmoji = typeof bumpConfig.emoji === 'string' && bumpConfig.emoji.trim() ? bumpConfig.emoji.trim() : '✅';

  const guildMap = context.kudos.get(guildId) || new Map();
  const now = Date.now();
  const current = getGuildKudos(guildMap, interaction.user.id);
  const lastBumpAt = current?.bump?.lastAt || 0;

  if (!lastBumpAt || now - lastBumpAt > 2 * 60 * 60 * 1000) {
    addKudosEntry(guildMap, interaction.user.id, reward, 'bump', 'Server bump', now);
    const updated = getGuildKudos(guildMap, interaction.user.id);
    const history = Array.isArray(updated.bump?.history) ? updated.bump.history : [];
    updated.bump = {
      ...(updated.bump || {}),
      lastAt: now,
      count: (updated.bump?.count || 0) + 1,
      history: [...history, now],
    };
    guildMap.set(interaction.user.id, updated);
    context.kudos.set(guildId, guildMap);
    context.saveKudos();
  }

  if (targetMessageId && targetMessageId !== 'preview' && interaction.channel) {
    const targetMessage = await interaction.channel.messages.fetch(targetMessageId).catch(() => null);
    if (targetMessage) {
      await targetMessage.react(reactionEmoji).catch(() => {});
    }
  }

  const streakButton = new ButtonBuilder()
    .setCustomId(`check-bump-streak:${guildId}`)
    .setLabel('Check Streak')
    .setStyle(ButtonStyle.Primary);

  if (interaction.message) {
    await interaction.message.delete().catch(() => {});
  }

  await interaction.reply({
    content: `Kudos claimed! You received ${reward} kudos for bumping the server.`,
    components: [new ActionRowBuilder().addComponents(streakButton)],
    ephemeral: true,
  });
}

async function handleCheckBumpStreak(interaction, context) {
  const [, guildId] = interaction.customId.split(':');
  const guildMap = context.kudos.get(guildId) || new Map();
  const embed = buildStreakEmbed(guildMap, interaction.user.id);

  await interaction.update({
    embeds: [embed],
    components: [buildProfileNavRow(guildId, interaction.user.id, 'streak')],
  });
}

async function handleProfileNavigation(interaction, context, target) {
  const [, guildId, userId] = interaction.customId.split(':');
  const guildMap = context.kudos.get(guildId) || new Map();
  const guild = interaction.guild;
  const member = guild?.members.cache.get(userId) || { displayName: userId, user: { username: userId } };
  const displayName = member?.displayName || member?.user?.username || 'Member';

  if (target === 'profile') {
    const metrics = require('../services/kudosService').getProfileMetrics(guildMap, userId);
    const allEntries = [...guildMap.entries()]
      .map(([memberId, data]) => ({ userId: memberId, total: Number(data?.total || 0) }))
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total);

    const rankIndex = allEntries.findIndex((entry) => entry.userId === userId);
    const rankText = rankIndex >= 0 ? `#${rankIndex + 1}` : 'Unranked';

    const embed = new EmbedBuilder()
      .setTitle(`${displayName}'s Profile`)
      .setColor(0xEB583B)
      .setDescription([
        '```text',
        `Server Rank: ${rankText}`,
        `Total Kudos: ${Math.round(Number(metrics.total || 0))}`,
        `Kudos "To": ${metrics.manualReceived}`,
        `Yap Timer: ${metrics.activityText}`,
        `Times Thanked: ${metrics.thankedCount}`,
        '```',
      ].join('\n'));

    await interaction.update({
      embeds: [embed],
      components: [buildProfileNavRow(guildId, userId, 'profile')],
    });
    return;
  }

  const embed = buildStreakEmbed(guildMap, userId);
  await interaction.update({
    embeds: [embed],
    components: [buildProfileNavRow(guildId, userId, 'streak')],
  });
}

async function handleQuestNavigation(interaction, context) {
  const [action, guildId, userId, mode, pageRaw] = interaction.customId.split(':');
  const page = Number(pageRaw) || 0;
  const guildState = context.quests?.get(guildId) || { catalog: new Map(), memberProgress: new Map() };
  const { getQuestSummary } = require('../services/questsService');
  const summary = getQuestSummary(guildState, userId);
  const entries = mode === 'finished' ? [...summary.completed] : [...summary.incomplete];
  const totalPages = Math.max(1, Math.ceil(entries.length / 5));
  const safePage = Math.min(Math.max(page, 0), Math.max(0, totalPages - 1));
  const member = interaction.guild?.members.cache.get(userId) || null;
  const name = member?.displayName || userId;

  const { buildQuestEmbed, buildQuestRow } = require('../commands/quests');
  const embed = buildQuestEmbed(name, mode, safePage, entries);
  const row = buildQuestRow(guildId, userId, mode, safePage, totalPages);

  await interaction.update({ embeds: [embed], components: [row] });
}

async function handleQuestToggle(interaction, context) {
  const [, guildId, userId, mode, pageRaw] = interaction.customId.split(':');
  const page = Number(pageRaw) || 0;
  const nextMode = mode === 'finished' ? 'unfinished' : 'finished';
  const guildState = context.quests?.get(guildId) || { catalog: new Map(), memberProgress: new Map() };
  const { getQuestSummary } = require('../services/questsService');
  const summary = getQuestSummary(guildState, userId);
  const entries = nextMode === 'finished' ? [...summary.completed] : [...summary.incomplete];
  const totalPages = Math.max(1, Math.ceil(entries.length / 5));
  const safePage = Math.min(Math.max(page, 0), Math.max(0, totalPages - 1));
  const member = interaction.guild?.members.cache.get(userId) || null;
  const name = member?.displayName || userId;

  const { buildQuestEmbed, buildQuestRow } = require('../commands/quests');
  const embed = buildQuestEmbed(name, nextMode, safePage, entries);
  const row = buildQuestRow(guildId, userId, nextMode, safePage, totalPages);

  await interaction.update({ embeds: [embed], components: [row] });
}

async function handleReactionRoleSelect(interaction, context) {
  const { panels } = context;
  const panelId = interaction.message.id;
  const config = panels.get(panelId);
  if (!config) return;

  // Determine which roles need to be added and removed based on the current selection.
  const selectedRoleIds = interaction.values;
  const member = interaction.member;
  const currentRoleIds = config.roles.map((entry) => entry.roleId);

  const toAdd = selectedRoleIds.filter((id) => !member.roles.cache.has(id));
  const toRemove = currentRoleIds.filter((id) => !selectedRoleIds.includes(id) && member.roles.cache.has(id));

  const results = [];
  const { buildQuestEngine } = require('../services/questEngine');
  const guildQuestState = context.quests?.get(interaction.guildId) || { catalog: new Map(), memberProgress: new Map() };
  const questEngine = buildQuestEngine(guildQuestState);
  for (const roleId of toAdd) {
    try {
      await member.roles.add(roleId);
      results.push(`Added <@&${roleId}>`);
      questEngine.recordRole({ userId: member.id, roleId, now: Date.now() });
      if (context.quests) {
        context.quests.set(interaction.guildId, questEngine.state);
        context.saveQuests?.();
      }
    } catch (error) {
      console.warn('Failed to add reaction role:', error);
    }
  }

  for (const roleId of toRemove) {
    try {
      await member.roles.remove(roleId);
      results.push(`Removed <@&${roleId}>`);
    } catch (error) {
      console.warn('Failed to remove reaction role:', error);
    }
  }

  const reply = results.length > 0 ? results.join('\n') : 'Your roles are already up to date.';
  await interaction.reply({ content: reply, flags: 64 });
}
