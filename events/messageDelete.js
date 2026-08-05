module.exports = {
  name: 'messageDelete',
  async execute(message, client, context) {
    const { reactionRoles, saveReactionRoles, stickies, saveStickies } = context || {};
    const messageId = message.id;

    // Clean up reaction role panel if present
    try {
      if (reactionRoles && reactionRoles.has(messageId)) {
        reactionRoles.delete(messageId);
        if (typeof saveReactionRoles === 'function') saveReactionRoles();
        console.log(`Cleaned up deleted reaction role panel: ${messageId}`);
      }
    } catch (err) {
      console.warn('Error cleaning reaction role panel on messageDelete:', err);
    }

    // Clean up sticky if the deleted message was a sticky for its channel
    try {
      const channelId = message.channel?.id || message.channelId || null;
      if (channelId && stickies && stickies.has(channelId)) {
        const prev = stickies.get(channelId);
        if (prev && prev.messageId === messageId) {
          stickies.delete(channelId);
          if (typeof saveStickies === 'function') saveStickies();
          console.log(`Cleaned up deleted sticky for channel ${channelId}`);
        }
      }
    } catch (err) {
      console.warn('Error cleaning sticky on messageDelete:', err);
    }
  },
};
