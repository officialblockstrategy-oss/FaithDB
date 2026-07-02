module.exports = {
  name: 'messageDelete',
  async execute(message, client, { reactionRoles, saveReactionRoles }) {
    const messageId = message.id;
    const config = reactionRoles.get(messageId);

    if (!config) return;

    reactionRoles.delete(messageId);
    saveReactionRoles();
    console.log(`Cleaned up deleted reaction role panel: ${messageId}`);
  },
};
