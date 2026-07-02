const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');
const panel = require('./reactionroles.js');

module.exports = {
  data: {
    name: 'rr',
    description: 'Manage reaction roles',
    options: [
      {
        name: 'add',
        description: 'Add a role to an existing reaction-role panel',
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: [
          {
            name: 'role',
            description: 'Add a role to an existing reaction-role panel',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'message_id',
                description: 'Message ID or link of the reaction-role message',
                type: ApplicationCommandOptionType.String,
                required: true,
              },
              {
                name: 'role',
                description: 'Role to add',
                type: ApplicationCommandOptionType.Role,
                required: true,
              },
              {
                name: 'label',
                description: 'Optional custom label for the role',
                type: ApplicationCommandOptionType.String,
                required: false,
              },
            ],
          },
        ],
      },
      {
        name: 'remove',
        description: 'Remove a role from an existing reaction-role panel',
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: [
          {
            name: 'role',
            description: 'Remove a role from an existing reaction-role panel',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'message_id',
                description: 'Message ID or link of the reaction-role message',
                type: ApplicationCommandOptionType.String,
                required: true,
              },
              {
                name: 'role',
                description: 'Role to remove',
                type: ApplicationCommandOptionType.Role,
                required: true,
              },
            ],
          },
        ],
      },
    ],
  },

  async execute(interaction, client, context) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: 'You need Manage Roles permission to use this command.', ephemeral: true });
      return;
    }

    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (group === 'add' && subcommand === 'role') {
      await panel.handleAddRole(interaction, context.reactionRoles, context.saveReactionRoles);
      return;
    }

    if (group === 'remove' && subcommand === 'role') {
      await panel.handleRemoveRole(interaction, context.reactionRoles, context.saveReactionRoles);
      return;
    }

    await interaction.reply({ content: 'Unknown command.', ephemeral: true });
  },
};
