/**
 * Discord bot made for HLDM-BR.NET.
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

// Static module imports
const Discord = require('discord.js');
const fs = require('fs');
const multilang = require('multi-lang');
const path = require('path');

// Utils
const utils = require('./utils/utils.js');

// Yeah feel free to blame me on about writing this way...
module.exports = class Bot {
    constructor() {
        this.moduledir = `${g_basedir}/modules`;

        this.botconfig = require(`./settings/bot.json`);

        this.lang = this.botconfig.lang;

        this.bot = new Discord.Client({ autoReconnect: true });
        this.bot.collection = new Discord.Collection();
        this.cooldowns = new Discord.Collection();
        this.multilang = multilang(`./app/lang/lang.json`, this.lang, false); // hardcoded path
    }

    async Run() {
        // Listen for errors
        this.bot.on("error", console.error);
        this.bot.on("warn", console.warn);

        await this.Loader();

        this.bot.login(this.botconfig.token);

        this.ListenMsgs();
    }

    // Load modules
    async Loader() {
        let count = 0;
        let failed = 0;
        let files = fs.readdirSync(this.moduledir).filter(file => file.endsWith('.js'));

        // Iterate though all files
        for await (let file of files) {
            let name = path.parse(file).name;

            // File already registered, skip it!
            if (this.bot.collection.has(name)) {
                utils.printmsg(`${this.multilang('ML_MODULES_ALREADYREGISTERED', { file: file })}`);
                //failed++
                continue;
            }

            try {
                // Load module, instance a class and call it.
                let loadfile = require(`${this.moduledir}/${file}`);
                let object = new loadfile(this); // expose this class
                await object.Init(); // call setup

                // Register module in the map collector
                this.bot.collection.set(name, object);

                utils.printmsg(`${this.multilang('ML_MODULE_FILELOADED', { file: file })}`, 2);

                // Destroy references, just in case
                loadfile = null;
                object = null;

                count++;
            }
            catch (error) {
                utils.printmsg(`${this.multilang('ML_MODULE_FILEFAIL', { file: file })}`, 2);
                utils.printmsg(error, 3);
                failed++;
            }
        }

        if (count) utils.printmsg(this.multilang('ML_MODULES_LOADED', { cnt: count }));
        if (failed) utils.printmsg(this.multilang(this.botconfig.verbose >= 3 ? 'ML_MODULES_FAILED_VERB' : 'ML_MODULES_FAILED', { fcnt: failed }));
        return;
    }

    // Listen for messages
    ListenMsgs() {
        this.bot.once('ready', () => {
            utils.printmsg(`${this.multilang('ML_LOGINMSG')} ${this.bot.user.username}!`);
            g_issafe = true;
            //this.bot.user.setActivity(`you lost the game`);
        });

        this.bot.on('rateLimit', info => {
            console.log(`You're being rate limited.`);
            console.log(info);
        });

        this.bot.on('message', message => {
            // Message from a bot, ignore
            if (message.author.bot) return;

            // Can't send message, ignore
            if (message.channel.type !== "dm" && !message.channel.permissionsFor(this.bot.user).has("SEND_MESSAGES")) return;

            // Log if user type in private
            if (!message.author.bot && message.channel.type === "dm") utils.printmsg(`Message issued over private by ${message.author.username} (UID: ${message.author.id}): ${message.content}.`, 2);

            // If the message has no prefix, or if the message comes from a bot, don't do anything
            if (!message.content.startsWith(this.botconfig.prefix) || message.author.bot) return;

            // Removes prefix, split commands and arguments
            const args = message.content.slice(this.botconfig.prefix.length).split(/ +/g);

            // Get command name only
            const commandName = args.shift().toLowerCase();

            // Commands/alias handler.
            const command = this.bot.collection.get(commandName) || this.bot.collection.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

            // Unknown command, do nothing
            if (!command) return;

            let canuse = this.CheckPermissions(message, command);

            // Owner always can use any commands
            if (canuse !== "owner") {
                if (command.guildonly && message.channel.type === 'dm' && command.hidden)
                    return; // DON'T SAY A THING
                else if (command.guildonly && message.channel.type === 'dm')
                    return message.reply(this.multilang('ML_PM_NOTAVAILABLE'));

                if (!this.ChannelPerms(message)) return message.reply(this.multilang('ML_CHANNEL_DENIED'));

                // The hidden stuff
                if (canuse == false && command.hidden)
                    return; // SILENCE! I KILL YOU!
                else if (canuse == false)
                    return message.reply(this.multilang('ML_PERMISSION_DENIED')); // no, you can't
            }

            // If there is no args, show how to use such command
            if (command.args && !args.length)
                if (command.usage && command.hidden)
                    return; // Ur not allowed, no u
                else if (command.usage)
                    return message.channel.send(`${message.author} ${this.multilang('ML_COMMAND_USAGE')}: \`${this.botconfig.prefix}${command.command} ${command.usage}\``);

            // Cooldown feature
            if (!this.cooldowns.has(command.command)) {
                this.cooldowns.set(command.command, new Discord.Collection());
            }

            const now = Date.now();
            const timestamps = this.cooldowns.get(command.command);
            const cooldownAmount = (command.cooldown || 3) * 1000;

            if (timestamps.has(message.author.id)) {
                const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return message.reply(`${this.multilang('ML_COMMAND_COOLDOWN', { time: timeLeft.toFixed(1), command: command.command })}`);
                }
            }

            if (canuse !== "owner") {
                timestamps.set(message.author.id, now);
                setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
            }

            // Try to run that command
            try {
                utils.printmsg(`Command ${commandName} issued by ${message.author.username} (UID: ${message.author.id}).`);
                command.execute(message, args);
            }
            catch (error) {
                message.reply(this.multilang('ML_INTERNAL_ERROR_COMMAND'));
                utils.printmsg(`Failed to execute command ${message}`, 2);
                utils.printmsg(error, 3);
            }
        });
    }

    async Destroy() {
        for (const [key, value] of this.bot.collection.entries()) {
            try {
                //console.log(key, value);
                value.Unload();
                Object.keys(value).forEach(function (key) { value[key] = null;/* console.log(value[key]);*/ }); //Null all member vars
                this.bot.collection.set(key, null);
                this.bot.collection.delete(key, null);
                utils.printmsg(`${this.multilang('ML_MODULE_UNLOADED', { victim: key })}`, 2);
            }
            catch (error) {
                utils.printmsg(`${this.multilang('ML_MODULE_UNLOADFAIL', { victim: key })}`, 2);
                process.exit(); // Force quit
            }
        }
        return await this.bot.destroy();
    }

    // Note: Is this too messy?
    // Note: setting owneronly and guildonly to false will allow anyone to use over PM.
    CheckPermissions(msg, command) {
        // Owner
        if (this.IsOwner(msg)) return "owner";
        //if (this.botconfig.owneruid && this.botconfig.owneruid === msg.author.id)
        //return "owner";

        // Channel permissions
        if (msg.channel.type !== "dm") {
            // Owner only, uid set, uid don't match, DENIED!
            if (command.owneronly === true && !this.IsOwner(msg)) return false;

            // Enum check
            if (command.permissions && command.permissions.length > 0)
                for (let permlist of command.permissions)
                    if (msg.member.permissions.has(permlist)) return true;

            // Role check
            if (command.allowedroles && command.allowedroles.length > 0)
                if (msg.member.roles.some(r => command.allowedroles.includes(r.name))) return true;

            // Wankers
            if (command.denyroles && command.denyroles.length > 0)
                if (msg.member.roles.some(r => command.denyroles.includes(r.name))) return false;

            // Not in the allowed list
            if ((command.allowedroles && command.allowedroles.length > 0) || (command.allowedroles && command.allowedroles.length > 0))
                return false;
        }

        // Messaged over PM, guildonly is set and isn't the owner, nope.js
        if (msg.channel.type === "dm" && command.guildonly === true)
            return false;

        return true; // allow by default if roles/permission list doesn't exist or empty or whatever
    }

    ChannelPerms(msg) {
        // Don't send if not in allowed list
        if (msg.channel.type !== "dm" && this.botconfig.denychannelids.length > 0 && this.botconfig.denychannelids.includes(msg.channel.id)) return false;
        if (msg.channel.type !== "dm" && this.botconfig.allowedchannelids.length > 0 && !this.botconfig.allowedchannelids.includes(msg.channel.id)) return false;

        return true;
    }

    IsOwner(msg) {
        // I AM THE BOSS
        if (this.botconfig.owneruid && this.botconfig.owneruid === msg.author.id)
            return true;

        // "Super privileged users" hack
        if (this.botconfig.privilegedusers.includes(msg.author.id)) return true;

        // gtfo
        return false;
    }
};
