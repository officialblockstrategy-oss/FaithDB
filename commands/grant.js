const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

const FEATURE_CHOICES = [
  { name: 'panel', value: 'panel' },
  { name: 'sticky', value: 'sticky' },
  { name: 'both', value: 'both' },
];

const ACTION_CHOICES = [
  { name: 'add', value: 'add' },
  { name: 'remove', value: 'remove' },
  { name: 'list', value: 'list' },
];

module.exports = {
  data: {
    name: 'grant',
    description: 'Grant or revoke bot access for panel/sticky commands',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    dm_permission: false,
    options: [
      {
        name: 'access',
        description: 'Manage panel/sticky access overrides',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'action',
            description: 'What to do',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: ACTION_CHOICES,
          },
          {
            name: 'feature',
            description: 'Which command access to change',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: FEATURE_CHOICES,
          },
          {
            name: 'user',
            description: 'User to grant/revoke',
            type: ApplicationCommandOptionType.User,
            required: false,
          },
          {
            name: 'role',
            description: 'Role to grant/revoke',
            type: ApplicationCommandOptionType.Role,
            required: false,
          },
        ],
      },
    ],
  },

  async execute(interaction, client, { commandAccess, saveCommandAccess }) {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission.', flags: 64 });
      return;
    }

    const action = interaction.options.getString('action', true);
    const feature = interaction.options.getString('feature', true);
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    const guildId = interaction.guildId;
    const current = normalizeGuildAccess(commandAccess.get(guildId));

    if (action === 'list') {
      await interaction.reply({ content: formatAccessSummary(current), flags: 64 });
      return;
    }

    if ((user && role) || (!user && !role)) {
      await interaction.reply({ content: 'Choose exactly one target: either user or role.', flags: 64 });
      return;
    }

    const targetType = user ? 'user' : 'role';
    const targetId = user ? user.id : role.id;
    const targetMention = user ? `<@${user.id}>` : `<@&${role.id}>`;

    const targets = feature === 'both' ? ['panel', 'sticky'] : [feature];
    const results = [];

    for (const key of targets) {
      const bucket = targetType === 'user' ? current[key].users : current[key].roles;
      const had = bucket.includes(targetId);

      if (action === 'add' && !had) {
        bucket.push(targetId);
        results.push(`Granted ${key} access to ${targetMention}.`);
        continue;
      }

      if (action === 'remove' && had) {
        current[key][targetType === 'user' ? 'users' : 'roles'] = bucket.filter((id) => id !== targetId);
        results.push(`Removed ${key} access from ${targetMention}.`);
        continue;
      }

      if (action === 'add' && had) {
        results.push(`${targetMention} already has ${key} access.`);
        continue;
      }

      if (action === 'remove' && !had) {
        results.push(`${targetMention} does not currently have ${key} access.`);
      }
    }

    commandAccess.set(guildId, current);
    saveCommandAccess();

    await interaction.reply({
      content: `${results.join('\n')}\n\n${formatAccessSummary(current)}`,
      flags: 64,
    });
  },
};

function normalizeGuildAccess(raw) {
  const normalized = {
    panel: { users: [], roles: [] },
    sticky: { users: [], roles: [] },
  };

  if (!raw || typeof raw !== 'object') {
    return normalized;
  }

  for (const feature of ['panel', 'sticky']) {
    const block = raw[feature] && typeof raw[feature] === 'object' ? raw[feature] : {};
    normalized[feature].users = Array.isArray(block.users) ? uniqueStrings(block.users) : [];
    normalized[feature].roles = Array.isArray(block.roles) ? uniqueStrings(block.roles) : [];
  }

  return normalized;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function formatAccessSummary(config) {
  const panelUsers = config.panel.users.length ? config.panel.users.map((id) => `<@${id}>`).join(', ') : 'none';
  const panelRoles = config.panel.roles.length ? config.panel.roles.map((id) => `<@&${id}>`).join(', ') : 'none';
  const stickyUsers = config.sticky.users.length ? config.sticky.users.map((id) => `<@${id}>`).join(', ') : 'none';
  const stickyRoles = config.sticky.roles.length ? config.sticky.roles.map((id) => `<@&${id}>`).join(', ') : 'none';

  return [
    'Current access overrides:',
    `Panel users: ${panelUsers}`,
    `Panel roles: ${panelRoles}`,
    `Sticky users: ${stickyUsers}`,
    `Sticky roles: ${stickyRoles}`,
  ].join('\n');
}
