const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { addKudosEntry, getGuildKudos } = require('../services/kudosService');
const { buildProfileNavRow, buildStreakEmbed } = require('../commands/profile');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client, context) {
    try {
      if (interaction.isButton() && interaction.customId?.startsWith('claim-bump:')) {
        return handleClaimBump(interaction, context);
      }

      if (interaction.isButton() && interaction.customId?.startsWith('check-bump-streak:')) {
        return handleCheckBumpStreak(interaction, context);
      }

      if (interaction.isButton() && interaction.customId?.startsWith('thank-kudos:')) {
        return handleThankKudos(interaction);
      }

      if (interaction.isButton() && interaction.customId?.startsWith('nav-profile:')) {
        return handleProfileNavigation(interaction, context, 'profile');
      }

      if (interaction.isButton() && interaction.customId?.startsWith('nav-streak:')) {
        return handleProfileNavigation(interaction, context, 'streak');
      }

      // Handle select menu interactions for reaction role panels first.
      if (interaction.isStringSelectMenu()) {
        return handleReactionRoleSelect(interaction, context);
      }

      // Handle panel modals before command execution.
      if (interaction.isModalSubmit() && interaction.customId?.startsWith('panel-')) {
        const panelCommand = client.commands.get('panel');
        if (panelCommand?.handleModalSubmit) {
          return panelCommand.handleModalSubmit(
            interaction,
            context.panels,
            context.savePanels,
            context.commandAccess
          );
        }
      }

      if (interaction.isModalSubmit() && interaction.customId?.startsWith('sticky-')) {
        const stickyCommand = client.commands.get('sticky');
        if (stickyCommand?.handleModalSubmit) {
          return stickyCommand.handleModalSubmit(
            interaction,
            context.stickies,
            context.saveStickies,
            context.commandAccess
          );
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

      await command.execute(interaction, client, context);
    } catch (error) {
      console.error('Interaction error:', error);
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

async function handleThankKudos(interaction) {
  const [, targetUserId, amountRaw] = interaction.customId.split(':');
  const amount = Number(amountRaw) || 10;

  if (interaction.user.id !== targetUserId) {
    await interaction.reply({
      content: 'Only the thanked member can use this button.',
      flags: 64,
    });
    return;
  }

  await interaction.reply({
    content: `You've received ${amount} Kudos.`,
    flags: 64,
  });
}

async function handleProfileNavigation(interaction, context, target) {
  const [, guildId, userId] = interaction.customId.split(':');
  const guildMap = context.kudos.get(guildId) || new Map();
  const guild = interaction.guild;
  const member = guild?.members.cache.get(userId) || { displayName: userId, user: { username: userId } };
  const displayName = member?.displayName || member?.user?.username || 'Member';

  if (target === 'profile') {
    const { buildProfileEmbed } = require('../commands/profile');
    const embed = buildProfileEmbed(guildMap, userId, displayName);

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
  for (const roleId of toAdd) {
    try {
      await member.roles.add(roleId);
      results.push(`Added <@&${roleId}>`);
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
