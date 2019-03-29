#!/usr/bin/env node
/**
 * Guts - A Discord bot made for HLDM-BR.NET.
 * 
 * MIT License
 * 
 * Copyright (c) 2019 Rafael "R4to0" Alves
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

"use strict";

// Static module imports ESM (disabled due to some limitations with cache system)
//import Discord from 'discord.js';
//import ('expose-gc');
//import fs from 'fs';
//import multilang from 'multi-lang';
//import path from 'path';
//import readline from 'readline';

// Static module imports
const fs = require('fs');
const gc = require('expose-gc/function');
const Discord = require('discord.js');
const multilang = require('multi-lang');
const path = require('path');
const readline = require('readline');

// Utils
const utils = require('./utils/utils.js');

const g_basedir = path.resolve(__dirname);

// Yeah feel free to blame me on about writing this way...
class GutsBot {
    constructor() {
        this.m_moduledir = `${g_basedir}/modules`;

        this.m_config = require(`./settings/bot.json`);

        this.m_lang = this.m_config.lang;

        this.m_bot = new Discord.Client({ autoReconnect: true });
        this.m_bot.collection = new Discord.Collection();
        this.m_cooldowns = new Discord.Collection();
        this.m_multilang = multilang(`./app/lang/lang.json`, this.m_lang, false); // hardcoded path
    }

    async Run() {
        // Listen for errors
        this.m_bot.on("error", console.error);
        this.m_bot.on("warn", console.warn);

        await this.Loader();

        this.m_bot.login(this.m_config.token);

        this.ListenMsgs();
    }

    // Load modules
    async Loader() {
        let count = 0;
        let failed = 0;
        let files = fs.readdirSync(this.m_moduledir).filter(file => file.endsWith('.js'));

        // Iterate though all files
        for await (let file of files) {
            let name = path.parse(file).name;

            // File already registered, skip it!
            if (this.m_bot.collection.has(name)) {
                utils.printmsg(`${this.m_multilang('ML_MODULES_ALREADYREGISTERED', { file: file })}`);
                //failed++
                continue;
            }

            try {
                // Load module, instance a class and call it.
                let loadfile = require(`${this.m_moduledir}/${file}`);
                let object = new loadfile(this); // expose this class
                object.Init(); // call setup

                // Register module in the map collector
                this.m_bot.collection.set(name, object);

                utils.printmsg(`${this.m_multilang('ML_MODULE_FILELOADED', { file: file })}`, 2);

                // Destroy references, just in case
                loadfile = null;
                object = null;

                count++;
            }
            catch (error) {
                utils.printmsg(`${this.m_multilang('ML_MODULE_FILEFAIL', { file: file })}`, 2);
                utils.printmsg(error, 3);
                failed++;
            }
        }

        if (count) utils.printmsg(this.m_multilang('ML_MODULES_LOADED', { cnt: count }));
        if (failed) utils.printmsg(this.m_multilang(this.m_config.verbose >= 3 ? 'ML_MODULES_FAILED_VERB' : 'ML_MODULES_FAILED', { fcnt: failed }));
        return;
    }

    // Listen for messages
    ListenMsgs() {
        this.m_bot.once('ready', () => {
            utils.printmsg(`${this.m_multilang('ML_LOGINMSG')} ${this.m_bot.user.username}!`);
            //this.m_bot.user.setActivity(`you lost the game`);
        });

        this.m_bot.on('message', message => {
            // Can't send message, ignore
            if (message.channel.type !== "dm" && !message.channel.permissionsFor(this.m_bot.user).has("SEND_MESSAGES")) return;

            // Log if user type in private
            if (message.channel.type === "dm") utils.printmsg(`Message issued over private by ${message.author.username} (UID: ${message.author.id}): ${message.content}.`, 2);

            // If the message has no prefix, or if the message comes from a bot, don't do anything
            if (!message.content.startsWith(this.m_config.prefix) || message.author.bot) return;

            //Removes prefix, split commands and arguments
            const args = message.content.slice(this.m_config.prefix.length).split(/ +/g);

            // Get command name only
            const commandName = args.shift().toLowerCase();

            // Commands/alias handler.
            const command = this.m_bot.collection.get(commandName) || this.m_bot.collection.find(cmd => cmd.m_aliases && cmd.m_aliases.includes(commandName));

            // Unknown command, do nothing
            if (!command) return;

            // Checks if we can use that command over PMs
            if (command.m_guildonly && message.channel.type !== 'text') return message.reply(this.m_multilang('ML_PM_NOTAVAILABLE'));

            // Check for permission
            if (!this.CheckPermissions(message, command)) return message.reply(this.m_multilang('ML_PERMISSION_DENIED'));

            // If there is no args, show how to use such command
            if (command.m_args && !args.length) {
                if (command.m_usage) {
                    return message.channel.send(`${message.author} ${this.m_multilang('ML_COMMAND_USAGE')}: \`${this.m_config.prefix}${command.m_command} ${command.m_usage}\``);
                }
            }

            // Cooldown feature
            if (!this.m_cooldowns.has(command.m_command)) {
                this.m_cooldowns.set(command.m_command, new Discord.Collection());
            }

            const now = Date.now();
            const timestamps = this.m_cooldowns.get(command.m_command);
            const cooldownAmount = (command.m_cooldown || 3) * 1000;

            if (timestamps.has(message.author.id)) {
                const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return message.reply(`${this.m_multilang('ML_COMMAND_COOLDOWN', { time: timeLeft.toFixed(1), command: command.m_command })}`);
                }
            }

            timestamps.set(message.author.id, now);
            setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

            // Try to run that command
            try {
                utils.printmsg(`Command ${commandName} issued by ${message.author.username} (UID: ${message.author.id}).`);
                command.execute(message, args);
            }
            catch (error) {
                message.reply(this.m_multilang('ML_INTERNAL_ERROR_COMMAND'));
                utils.printmsg(`Failed to execute command ${message}`, 2);
                utils.printmsg(error, 3);
            }
        });
    }

    async Destroy() {
        return this.m_bot.destroy();
    }

    CheckPermissions(msg, command) {
        // 1st check
        if (command.m_permissions && command.m_permissions.length > 0)
            for (let permlist of command.m_permissions)
                if (msg.member.permissions.has(permlist)) return true;

        // 2nd check
        if (command.m_allowedroles && command.m_allowedroles.length > 0)
            if (msg.member.roles.some(r => command.m_allowedroles.includes(r.name))) return true;

        // Freaking wankers (3rd check)
        if (command.m_denyroles && command.m_denyroles.length > 0)
            if (msg.member.roles.some(r => command.m_denyroles.includes(r.name))) return false;

        // Not in the allowed list
        if ((command.m_allowedroles && command.m_allowedroles.length > 0) || (command.m_allowedroles && command.m_allowedroles.length > 0))
            return false;

        return true; // allow by default if roles/permission list doesn't exist or empty
    }

};

let BotInstance = new GutsBot();

// Send unhandled promise error messages over PM
process.on("unhandledRejection", err => {
    console.error(`Unhandled promise rejection!\n${err.stack}`);
    try {
        BotInstance.m_bot.users.get(BotInstance.m_config.owneruid).send(err.stack); // Send stack to owner
    }
    catch (error) {
        process.exit();
    }
});


// Catch CTRL+C on Windows. Requires 'readline'.
// https://stackoverflow.com/questions/10021373/what-is-the-windows-equivalent-of-process-onsigint-in-node-js
if (process.platform === "win32") {
    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on("SIGINT", function () {
        process.emit("SIGINT");
    });
}

// Quit on CTRL+C, destroy bot session
process.on("SIGINT", function () {
    console.log("CTRL + C DETECTED, GRACEFULLY CLOSING...");
    BotInstance.Destroy().then(process.exit());
});

// Custom event to restart without killing process
process.on("RESTART", function () {
    console.log("Killing main class instance...");
    try {
        (async () => {
            BotInstance.Destroy().then(BotInstance = null).then(gc());
            console.log("Spawning new class instance...");
            BotInstance = new GutsBot();
            BotInstance.Run(); // henlo
        })();
    }
    catch (error) {
        console.log(error);
        process.exit();
    }
});

BotInstance.Run(); // henlo
