/**
 * Discord bot made for HLDM-BR.NET.
 * 
 * SCStats player query module module
 * 
 * Based on incognico's perl implementation https://github.com/incognico
 * For servers with incognico's svenstats log parser database https://github.com/incognico
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
const Database = require('better-sqlite3');
const Discord = require('discord.js');
const fs = require('fs');
const multilang = require('multi-lang');
const SteamAPI = require('steamapi');
const SteamID = require('steamid');

// Utils
const utils = require('../utils/utils.js');

module.exports = class scsplr {
    constructor(bot) {
        this.bot = bot;

        this.multilang = multilang(`./app/lang/player.json`, bot.lang, false);
        this.config = require(`../settings/player.json`);

        this.sapi = new SteamAPI(this.config.steamapikey/*, { enabled: true, expires: 86400000 }*/); // NOTE: investigate why caching options doesn't work. Implemented my own solution for this for now...

        this.command = 'player'; // Main command
        this.aliases = ['plr', 'jogador']; // Command aliases
        this.description = this.multilang('ML_PLAYER_DESCRIPTION'); // Brief description
        this.args = true; // Requires arguments or not
        this.guildonly = true; // Can only be used at channel or over pm too
        this.hidden = false; // [redacted]
        this.usage = this.multilang('ML_PLAYER_USAGE'); // How to use this command
        this.owneronly = false; // Only owner can use (needs owneruid in bot.json)
        this.cooldown = 5; // Delay between usage again
        this.permissions = []; // Users with such permissions will be allowed to use (1st check)
        this.allowedroles = []; // Users with such roles will be allowed to use (2nd check)
        this.denyroles = []; // Users with such roles will be DENIED to use (3rd check)

        // Cache idea: KernCore.
        this.cachetime = this.config.cachetime; // Time in minutes to hold a cache of the query
        this.nextcache = 0; // When refresh local database, in unix timestamp
        this.cached = []; // SQLite cached data
        this.isrunning = false; // Safeguard to prevent trying to cache multiple times in the same second
        this.cachedresult = false; // Boolean to say if is a fresh result or not
        this.sapicache = new Discord.Collection(); // Steam API cache collection
        this.sapicachetime = this.config.steamapicachetime; // How long to cache steam api data
        this.issapirunning = false; // Another safeguard, for the Steam API
        this.sapicached = false; // Another boolean, for Steam API
        this.dbdate; // Last modified date for database file

        this.SteamIDRgx = /^(STEAM_)?(([01]):([01]):([0-9]+))$/i;

        // TODO:
        // profile id
        // profile custom name
        // https://developer.valvesoftware.com/wiki/SteamID
    }
    Init() {
        // Check if database file exists
        fs.accessSync(`${this.config.databasefile}`, fs.constants.R_OK);
    }
    Unload() { }

    async execute(msg, args) {
        // Safeguards
        if (this.isrunning) return msg.reply(this.multilang('ML_PLAYER_SQLITEBUSY'));

        // Merge args array into a single one
        args = args.join(" ");

        let playerdata = [];

        msg.channel.startTyping();
        //let startms = utils.GetTimeMS();
        
        // HACK: Replace thumbsup emoji with :1: because mobile converts :1: to it
        args = args.replace(/👍/g, ":1:");

        args = utils.ResolveStuff(msg.client, (msg.channel.type === 'text' ? msg.guild.id : null), args, false); // Resolve nicks/usernames/emojis/mentions/roles if any
        if (!args) return; // User input is non-ascii chars only, now empty.

        let sqlitems = utils.GetTimeMS();

        playerdata["stats"] = await this.QueryPlayer(args); // Process player data
        if (!playerdata.stats) {
            setTimeout(() => { msg.channel.stopTyping() }, 3 * 1000);
            return msg.channel.send(this.multilang('ML_PLAYER_NOTFOUND'));
        }

        sqlitems = utils.GetTimeMS() - sqlitems;

        let sapims = utils.GetTimeMS();

        playerdata["steamapi"] = await this.QuerySteamAPI(msg, `STEAM_${playerdata.stats.steamid}`);

        sapims = utils.GetTimeMS() - sapims;

        // Fancy embed stuff
        let embed = new Discord.MessageEmbed();

        if (!playerdata.steamapi) embed.setAuthor(this.multilang('ML_PLAYER_SAPIUNAVAILABLE'));

        embed.setColor(0xfa4a4a); // Left ribbon colour
        if (playerdata.steamapi) embed.setThumbnail(playerdata.steamapi.summ.avatar.large); // Upper right thumbnail

        embed.addField(this.multilang('ML_PLAYER_NAMEFIELD'), `[${playerdata.stats.name}](${(playerdata.steamapi ? playerdata.steamapi.summ.profileURL : '')})`, true);
        embed.addField(this.multilang('ML_PLAYER_RANKFIELD'), (playerdata.stats.posicao === 1 ? `:crown: 1` : playerdata.stats.posicao), true);

        embed.addField(this.multilang('ML_PLAYER_COUNTRYFIELD'), playerdata.stats.geo === null ? this.multilang('ML_PLAYER_UNKNOWN') : `:flag_${playerdata.stats.geo.toLowerCase()}:`, true);
        embed.addField(this.multilang('ML_PLAYER_SRVTIMEFIELD'), playerdata.stats.datapoints > 1
            ? utils.FormatTime(playerdata.stats.datapoints * 30) + (playerdata.stats.datapointgain > 1 ?
                ` *(+${utils.FormatTime(playerdata.stats.datapointgain * 30)})*`
                : "")
            : "-", true);

        embed.addField(this.multilang('ML_PLAYER_LSTSEENFIELD'), playerdata.stats.ultvisto === null ? this.multilang('ML_PLAYER_UNKNOWN') : playerdata.stats.ultvisto, true);
        if (playerdata.stats.pontos > 0 || playerdata.stats.deaths > 0) {
            embed.addField(this.multilang('ML_PLAYER_SCOREFIELD'), playerdata.stats.pontos + (playerdata.stats.ultsganho > 0 ? " *(+" + playerdata.stats.ultsganho + ")*" : ""), true);
            embed.addField(this.multilang('ML_PLAYER_DEATHFIELD'), playerdata.stats.deaths + (playerdata.stats.ultdhs > 0 ? " *(+" + playerdata.stats.ultdhs + ")*" : ""), true);
            //embed.addField("Relação pontos/mortes", (playerdata.stats.pontos / playerdata.stats.deaths).toFixed(2), true);
            embed.addField(this.multilang('ML_PLAYER_SIDFIELD'), "STEAM_" + playerdata.stats.steamid, true);
        }

        if (playerdata.steamapi) {
            if (playerdata.steamapi.bans.vacBanned)
                embed.addField(this.multilang('ML_PLAYER_VACFIELD'), `${this.multilang('ML_PLAYER_YES')} *(${playerdata.steamapi.bans.vacBans})*`, true);

            if (playerdata.steamapi.bans.gameBans > 0)
                embed.addField("Game Banned", `${this.multilang('ML_PLAYER_YES')} *(${playerdata.steamapi.bans.gameBans})*`, true);

            if (playerdata.steamapi.bans.communityBanned)
                embed.addField(this.multilang('ML_PLAYER_COMMBAN'), this.multilang('ML_PLAYER_YES'), true);

            if (playerdata.steamapi.bans.economyBan == "banned")
                embed.addField(this.multilang('ML_PLAYER_TRADEBAN'), this.multilang('ML_PLAYER_YES'), true);

            if (playerdata.steamapi.bans.vacBanned || playerdata.steamapi.bans.gameBans > 0) {
                let daysago;
                if (playerdata.steamapi.bans.daysSinceLastBan == 0) daysago = `${this.multilang('ML_PLAYER_TODAY')}` // you're lucky enough to query a steam profile that was banned today
                else if (playerdata.steamapi.bans.daysSinceLastBan == 1) daysago = `${this.multilang('ML_PLAYER_YESTERDAY')}` // ^ +1 day
                else daysago = `${utils.FormatTime(playerdata.steamapi.bans.daysSinceLastBan * 86400)} ${this.multilang('ML_PLAYER_DAYSAGO')}`
                embed.addField(this.multilang('ML_PLAYER_LASTBAN'), `${daysago}`, true);
            }

        }

        //if (this.config.gmapsapikey) embed.setImage(`https://maps.googleapis.com/maps/api/staticmap?size=360x80&scale=2&language=en&region=ps&center=${playerdata.stats.lat},${playerdata.stats.lon}&zoom=8&key=${this.config.gmapsapikey}`);
        embed.setTimestamp(this.dbdate);
        //embed.setFooter(`${this.multilang('ML_PLAYER_QUERYTIME', { time: utils.GetTimeMS() - startms })} ${(this.cachedresult && this.sapicached) ? `${this.multilang('ML_PLAYER_CACHEMSG', { timesec: this.nextcache - utils.GetUnixTime() })}.` : '.'} ${this.multilang('ML_PLAYER_LASTUPDATE')}`);
        embed.setFooter(`DB query: ${sqlitems}ms, Steam API: ${sapims}ms${(this.cachedresult && this.sapicached) ? `, ${this.multilang('ML_PLAYER_CACHEMSG', { timesec: this.nextcache - utils.GetUnixTime() })}.` : '.'} ${this.multilang('ML_PLAYER_LASTUPDATE')}`);

        setTimeout(() => { msg.channel.stopTyping() }, 3 * 1000);
        return msg.channel.send({ embed });

    }

    async QueryPlayer(plr) {
        let pSQLiteDB;
        let now = utils.GetUnixTime();

        // Is cache fresh?
        if (!this.isrunning && (!this.nextcache || now > this.nextcache/* || fs.statSync(this.config.databasefile).mtime > this.dbdate*/)) {
            this.isrunning = true;
            this.cachedresult = false;
            this.cached = null;

            // Fetch all data from database and cache it
            pSQLiteDB = new Database(this.config.databasefile, { readonly: true/*, memory: true*/ }); // TypeError: In-memory databases cannot be readonly

            try {
                this.cached = await pSQLiteDB.prepare(`SELECT
                    ROW_NUMBER() OVER (
                        ORDER BY score DESC
                    ) posicao,
                    steamid,
                    name,
                    ROUND(score,0) as pontos,
                    deaths,
                    ROUND(scoregain,0) as ultsganho,
                    ROUND(deathgain,0) as ultdhs,
                    geo,
                    datapoints,
                    datapointgain,
                    strftime(\'%d/%m/%Y\', seen) as ultvisto,
                    lat,
                    lon
                FROM
                    stats`).all();

                // Save next cache time
                this.nextcache = now + (this.cachetime * 60);

                // And close the database
                pSQLiteDB.close();
                this.dbdate = fs.statSync(this.config.databasefile).mtime;
                this.isrunning = false;

                //console.log(`DEBUG: refreshed cached data.`);
            }
            catch (error) {
                pSQLiteDB.close();
                this.isrunning = false;
            }
        }
        else {
            this.cachedresult = true;
            //console.log(`DEBUG: cached sqlite data, next refresh in ${this.nextcache - now} seconds...`);
        }

        if (this.SteamIDRgx.test(plr)) {
            //plr = plr.replace('STEAM_', '');
            plr = plr.replace(this.SteamIDRgx, '0:$4:$5');
            for (let target of this.cached) {
                if (target.steamid === plr) return target;
            }
        }
        else {
            let reg = new RegExp(`${plr.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")}`, 'i'); // case insensitive; escape regex related chars -R4to0 (2 November 2020)
            for (let target of this.cached) {
                if (reg.test(target.name)) return target;
            }
        }

        return null;
    }

    async QuerySteamAPI(msg, id) {
        if (!this.config.steamapikey) return;
        if (this.issapirunning) return/* msg.reply(`Steam API is busy! Please try again in a second...`)*/;

        // Is cache fresh²?
        let cached = this.sapicache.get(id);
        if (cached && cached.validuntil > utils.GetUnixTime()) { this.sapicached = true; return cached; }

        const sid = new SteamID(id);
        //const sapi = new SteamAPI(this.config.steamapikey);

        // Loop indefinitely until we get a reply, because the API service is so unreliable.
        let count = 0;
        while (true) {
            try {
                this.issapirunning = true;
                this.sapicached = false;

                let data = [];
                data["validuntil"] = utils.GetUnixTime() + (this.sapicachetime * 60);

                utils.printmsg(`Querying Steam API Summary: ID ${sid}`, 2);
                data["summ"] = await this.sapi.getUserSummary(sid.getSteamID64());
                utils.printmsg(`Steam API Summary query finished.`, 2);

                utils.printmsg(`Querying Steam API User Bans: ID ${sid}`, 2);
                data["bans"] = await this.sapi.getUserBans(sid.getSteamID64());
                utils.printmsg(`Steam API User Bans query finished.`, 2);

                // All good, lets cache
                this.sapicache.set(id, data);
                this.issapirunning = false;

                return data;
            } catch (error) {
                utils.printmsg(`Steam API ${error}`, 2);
                this.issapirunning = false;
                this.sapicached = false;
                if (++count >= this.config.steamapiqueryretries) {
                    //msg.channel.send(`\`Steam API ${error}. Retries: ${count}/${this.config.steamapiqueryretries}\``); // change this later
                    return false;
                }
                //msg.channel.send(`\`Steam API ${error}. Retries: ${count}/${this.config.steamapiqueryretries}\``);
            }
        }
    }
}

/* Old logic for future reference
const row = await sql.prepare(
			`SELECT * FROM (
				SELECT
					ROW_NUMBER() OVER (
						ORDER BY score DESC
					) posicao,
					steamid,
					name,
					ROUND(score,0) as pontos,
					deaths,
					ROUND(scoregain,0) as ultsganho,
					ROUND(deathgain,0) as ultdhs,
					geo,
					datapoints,
					datapointgain,
					strftime(\'%d/%m/%Y\', seen) as ultvisto,
					lat,
					lon
				FROM
					stats
			) t
			WHERE
				${SteamIDRgx.test(param) ? 'steamid = "' + param.replace('STEAM_', '') + '"' : 'name LIKE "%' + param + '%"'}
			LIMIT 1
				`).get();

*/
