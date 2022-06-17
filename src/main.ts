import { Client, CommandInteraction, Guild, Intents } from 'discord.js';
import assert from 'assert';
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { execSync } from 'child_process';

const DISCORD_BOT_TOKEN: string | undefined = process.env.DISCORD_BOT_TOKEN;
assert(DISCORD_BOT_TOKEN, 'DISCORD_BOT_TOKEN is not defined');

const DISCORD_APPLICATION_ID: string | undefined =
  process.env.DISCORD_APPLICATION_ID;
assert(DISCORD_APPLICATION_ID, 'DISCORD_APPLICATION_ID is not defined');

const commands: Array<{
  commandBuilder: {
    toJSON: SlashCommandBuilder['toJSON'];
    name: SlashCommandBuilder['name'];
  };
  replyFn: (interaction: CommandInteraction) => Promise<void>;
}> = [
  {
    commandBuilder: new SlashCommandBuilder()
      .setName('satisfactory')
      .setDescription('Controls the satisfactory server')
      .addStringOption((options) =>
        options
          .setName('action')
          .setDescription('Action to perform')
          .setChoices(
            ...['start', 'stop', 'restart'].map((action) => ({
              name: action,
              value: action,
            })),
          )
          .setRequired(true),
      ),
    async replyFn(interaction) {
      const action = interaction.options.get('action')?.value;

      if (!action) {
        await interaction.reply({
          content: 'Please specify an action',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        execSync(`sudo systemctl ${action} satisfactory.service`);
        await interaction.editReply(
          `Successfully ran server command: ${action}`,
        );
      } catch (e) {
        console.error(e);
        await interaction.editReply('Failed to run server command');
      }
    },
  },
];

const client = new Client({
  intents: Intents.FLAGS.GUILDS,
});

client.once('ready', async (client) => {
  await registerCommands(DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID);

  console.log('Ready!');
  console.log(
    `Connect the bot to your servers at: https://discord.com/oauth2/authorize?client_id=${DISCORD_APPLICATION_ID}&permissions=2147483648&scope=bot%20applications.commands`,
  );
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const replyFn = commands.find(
    ({ commandBuilder }) => commandBuilder.name === interaction.commandName,
  )?.replyFn;

  if (!replyFn) return;

  try {
    await replyFn(interaction);
  } catch (e) {
    console.error(e);
    await interaction.reply({
      content: 'There was an error while executing this command!',
      ephemeral: true,
    });
  }
});

client.login(DISCORD_BOT_TOKEN);

async function registerCommands(
  discordBoToken: string,
  applicationId: string,
): Promise<void> {
  const rest = new REST({ version: '9' }).setToken(discordBoToken);

  try {
    await rest.put(Routes.applicationCommands(applicationId), {
      body: commands.map(({ commandBuilder }) => commandBuilder.toJSON()),
    });
    console.log(`Registered commands`);
  } catch (e) {
    console.error(e);
  }
}
