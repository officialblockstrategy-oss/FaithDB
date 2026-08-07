module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client, context) {
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
