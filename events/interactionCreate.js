module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client, context) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client, context);
    } catch (error) {
      console.error('Interaction command error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
      }
    }
  },
};
