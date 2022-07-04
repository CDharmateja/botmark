/* eslint-disable no-await-in-loop */
/**
 * @author: Izan Cuetara Diez (a.k.a. Unstavle)
 * @version: v1.0 | 2021-11-23
 */

"use strict";

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const { BOT_TOKEN, CLIENT_ID, PROCESS_ID } = require('./client-codes.json');
const { GUILD_LIST } = require('./config.json');
const pm2 = require('pm2');

// Arrays in which to send all commands
const guildCommands = [], globalCommands = [];
// Get all the command files from the appropriate directories
const guildCmdFiles = fs.readdirSync('./guild_commands').filter(file => file.endsWith('.js'));
const globalCmdFiles = fs.readdirSync('./global_commands').filter(file => file.endsWith('.js'));

// Push all the guild commands to their array
for (const file of guildCmdFiles) {
	const command = require(`./guild_commands/${file}`);
	try { guildCommands.push(command.data.toJSON()); }
	catch(error) { console.error(`Error pushing ${file} file to guildCommands array`, error); }
}
// Push all the global commands to their array
for (const file of globalCmdFiles) {
	const command = require(`./global_commands/${file}`);
	try { globalCommands.push(command.data.toJSON()); }
	catch(error) { console.error(`Error pushing ${file} file to globalCommands array`, error); }
}

const rest = new REST({ version: '9' }).setToken(BOT_TOKEN);

(async () => {
	try {
		console.log('\nStarted reloading application commands.');

		// Global commands
		await rest.put(
			Routes.applicationCommands(CLIENT_ID),
			{ body: globalCommands },
		);
		console.log('- Registered global commands.');

		// Guild commands
		for (const guild of GUILD_LIST) {
			// for all files in /guild_commands
			await rest.put(
				Routes.applicationGuildCommands(CLIENT_ID, guild.id),
				{ body: guildCommands },
			);
			console.log(`- Registered commands for server: ${guild.name}`);
		}// guild list for - end

		console.log('Successfully reloaded application commands.');
	}
	catch (error) {
		console.error('Something went wrong when reloading application commands.', error);
	}
})();

// pm2 restart app
setTimeout(() => {
	console.log(`\nAttempting to connect to pm2 to restart '${PROCESS_ID}' process...`);

	// connect to pm2 process manager
	pm2.connect((err) => {
		if (err) {
			console.error(`\n\nSomething went wrong when connecting to '${PROCESS_ID}' process from deploy-commands.js.`, err);
			process.exit(2);
		}

		// Fetch the list of processes managed by pm2
		pm2.list((err, list) => {
			if (err) {
				console.error(`\n\nSomething went wrong when fetching the list of pm2 processes in deploy-commands.js.`, err);
				process.exit(2);
			}

			// Find the process with the right name and send it the SIGUSR1 signal that will make it reboot
			const processDescription = list.find(proc => proc.name === PROCESS_ID);
			if (processDescription && processDescription.pm2_env.status === "online") {
				console.log(`Now restarting ${processDescription.name} process.`);
				process.kill(processDescription.pid, 'SIGUSR1');
			}
			else {
				console.log(`${processDescription.name} process is currently not online, no need to restart it.`);
			}
		});

		// Disconnect from pm2
		setTimeout(() => {
			pm2.disconnect();
			console.log(`Disconnected from pm2.`);
		}, 1000);
	});
}, 1000);