const { ActionRowBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { addKudosEntry, getGuildKudos } = require('../services/kudosService');

function scheduleDeletion(message, delayMs = 30000) {
  if (!message || typeof message.delete !== 'function') {
    return;
  }

  setTimeout(() => {
    message.delete().catch(() => {});
  }, delayMs);
}

module.exports = {
  data: {
    name: 'thank',
    description: 'Thank a member for something they did',
    dm_permission: false,
    options: [
      {
        name: 'user',
        description: 'Member to thank',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: 'for',
        description: 'What you are thanking them for',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  async execute(interaction, client, { kudos, saveKudos }) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command must be used in a server.', flags: 64 });
      return;
    }

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('for', true).trim();
    const guildMap = kudos.get(interaction.guildId) || new Map();

    if (!reason || reason.length < 3) {
      await interaction.reply({ content: 'Please give a brief reason for the kudos award.', flags: 64 });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot give yourself kudos.', flags: 64 });
      return;
    }

    const current = getGuildKudos(guildMap, target.id);
    const lastManual = current.manual && current.manual.lastAt ? current.manual.lastAt : 0;
    const now = Date.now();
    if (now - lastManual < 60 * 60 * 1000) {
      await interaction.reply({ content: 'That member has already received kudos recently.', flags: 64 });
      return;
    }

    const giverCurrent = getGuildKudos(guildMap, interaction.user.id);
    const giverLast = giverCurrent.manual && giverCurrent.manual.lastAt ? giverCurrent.manual.lastAt : 0;
    if (now - giverLast < 10 * 60 * 1000) {
      await interaction.reply({ content: 'You are giving kudos too quickly. Please wait a bit.', flags: 64 });
      return;
    }

    const amount = 10;
    addKudosEntry(guildMap, target.id, amount, 'manual', `Awarded by ${interaction.user.id}: ${reason}`, now);
    const updated = getGuildKudos(guildMap, target.id);
    updated.manual = { ...(updated.manual || {}), lastAt: now, reason };
    guildMap.set(target.id, updated);

    const giverUpdated = getGuildKudos(guildMap, interaction.user.id);
    giverUpdated.manual = { ...(giverUpdated.manual || {}), lastAt: now };
    guildMap.set(interaction.user.id, giverUpdated);

    kudos.set(interaction.guildId, guildMap);
    saveKudos();

    const embed = new EmbedBuilder()
      .setColor(0xEB583B)
      .setTitle('Thanks Sent')
      .setDescription(`${interaction.user} has thanked ${target} for ${reason}`)
      .setFooter({ text: 'This message will disappear in 30 seconds.' });

    const kudosButton = new ButtonBuilder()
      .setCustomId(`thank-kudos:${target.id}:${amount}`)
      .setLabel('View Kudos')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(kudosButton);

    const reply = await interaction.reply({
      content: `${interaction.user} thanked ${target}.`,
      embeds: [embed],
      components: [row],
      allowedMentions: { users: [interaction.user.id, target.id] },
      fetchReply: true,
    });

    scheduleDeletion(reply);
  },
};
