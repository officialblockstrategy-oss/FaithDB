// This module is a lightweight wrapper around the panel manager.
// It exposes `/rr add role` and `/rr remove role` while delegating the actual panel updates to panel.js.
const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');
const panel = require('./panel.js');

module.exports = {
  data: {
    name: 'rr',
    description: 'Manage reaction roles',
    default_member_permissions: null,
    dm_permission: false,
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
                name: 'role_2',
                description: 'Optional second role to add',
                type: ApplicationCommandOptionType.Role,
                required: false,
              },
              {
                name: 'role_3',
                description: 'Optional third role to add',
                type: ApplicationCommandOptionType.Role,
                required: false,
              },
              {
                name: 'role_4',
                description: 'Optional fourth role to add',
                type: ApplicationCommandOptionType.Role,
                required: false,
              },
              {
                name: 'role_5',
                description: 'Optional fifth role to add',
                type: ApplicationCommandOptionType.Role,
                required: false,
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
    // Wrapper command for adding or removing roles from an existing reaction role panel.
    if (!panel.canManagePanels(interaction, context.commandAccess)) {
      await interaction.reply({
        content: 'You need Manage Roles, Manage Messages, or granted panel access to use this command.',
        flags: 64,
      });
      return;
    }

    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (group === 'add' && subcommand === 'role') {
      await panel.handleAddRole(interaction, context.panels, context.savePanels);
      return;
    }

    if (group === 'remove' && subcommand === 'role') {
      await panel.handleRemoveRole(interaction, context.panels, context.savePanels);
      return;
    }

    await interaction.reply({ content: 'Unknown command.', flags: 64 });
  },
};
