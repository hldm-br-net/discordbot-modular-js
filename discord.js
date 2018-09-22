/**
 * Guts - Discord bot made specially for HLDM-BR.NET by Rafael "R4to0" Alves.
 * Based on 'gus.pl' by incognico.
 * 
 * Copyright(C) 2018 Rafael Alves
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

// Não mexa abaixo a não ser que você saiba o que está fazendo

// A fazer: Trocar o sqlite3 por better-sqlite3

// Handler global de erros, sair da aplicação em caso de unhandled promises (temporario)
process.on('unhandledRejection', (reason, p) => {
    client.on("message", async msg => {
        await msg.channel.send("`Ocorreu um erro inesperado, reiniciando...`");
    });
    console.log('Unhandled Rejection at:', reason.stack || reason)
    console.log("Ocorreu uma exceção não tratada. Finalizando script...")
    client.destroy(); // destroi a sessão e desloga o bot corretamente
    process.exit(1);
});

// Bibliotecas
const Discord = require('discord.js');          // https://www.npmjs.com/package/discord.js
const sqlite3 = require('sqlite3');             // https://www.npmjs.com/package/sqlite3
const SteamID = require('steamid');             // https://www.npmjs.com/package/steamid
const SteamAPI = require('steamapi');           // https://www.npmjs.com/package/steamapi
const SourceQuery = require('sourcequery');     // https://www.npmjs.com/package/sourcequery
const async = require('async');                 // https://www.npmjs.com/package/async
const fs = require('fs');
const Tail = require('tail').Tail;				// https://www.npmjs.com/package/tail
//const isIp = require('is-ip');                  // https://www.npmjs.com/package/is-ip

const config = require("./config.json")
const client = new Discord.Client();
const db = new sqlite3.Database(config.sqlitedb);
const steam = new SteamAPI(config.steamapikey); // https://steamcommunity.com/dev/apikey
const sq = new SourceQuery(config.gstimeout);
const g_chatfromsven = "C:\\gameservers\\svends\\svencoop\\scripts\\plugins\\store\\_fromsven.txt";
const g_chattosven = "C:\\gameservers\\svends\\svencoop\\scripts\\plugins\\store\\_tosven.txt";
const tail = new Tail(g_chatfromsven);

// Regex
const SteamIDRegex = /^STEAM_(0:[01]:[0-9]+)$/;
const DiscordIDRegex = /^\<\@[0-9]+\>/;
const statusregex = /^status .+ [0-9][0-9]?$/
const joinregex = /^\+ <(.+)><STEAM_0.+> has joined the game/
const leftregex = /^\- <(.+)><STEAM_0.+> has left the game/

var g_isSafe = true;

// Super shitty array for map data, because I don't have a PRO account to use wikidot API
// mapname, scmdbname, thumb, mappic, desc
const MapData = [
    {
        'name': 'IO',
        'author': 'RNG',
        'mapname': "io_v1",
        'scmdbname': "io",
        'thumb': "iomapheader2.png",
        'mappic': "0-iobeta111_1.jpg",
        'desc': "Somewhere in 22th century an important laboratory in the moon Io has gone all messed up and stupid, and its your job once again to \"fix\" things no matter the international or intergalactic impact it has."
    },
    {
        'name': 'Complex',
        'author': 'enCore',
        'mapname': 'complex',
        'scmdbname': 'complex',
        'thumb': '',
        'mappic': '0-complex-top.jpg',
        'desc': 'Find a way out of this complex.'
    },
    {
        'name': 'Abandoned',
        'author': 'Nih',
        'mapname': 'abandoned',
        'scmdbname': 'abandoned',
        'thumb': '',
        'mappic': '0-abandoned0043.jpg',
        'desc': 'You and your colleagues knew that the resonance cascade would happen. It was inevitable. The administrator was more concerned about profit than the fate of the human race. But it\'s not too late to save earth. You and some of your colleagues ventured deep into the abandoned parts of Black Mesa to find the unfinished plans for the GTIS, or Global Transdimensional Intrusion Shield. With the plans for this, we could stop the aliens from ever coming to our planet. Or should the horror happen before mankind is fully prepared, at least prevent more from coming. Unfortunately, hell decided to break loose just as you found the documents. Screams are heard from outside the old archiving room. Barney and Fred were supposed to keep guard, but now they\'re being zombified. Shit happens. You need to escape NOW, and you need to get the documents with you. Fortunately, being the gun-nut Barney is, he left some extra weaponry at our SUV\'s. If we can get to the SUV\'s, we can ride through the tunnel system, up the main entry lift, fight our way to the lambda guys, and save the world. Let\'s do it.'
    }
];

const MapNames = [
    ['hl_c00_a0', 'Half-Life'],
    ['of0a0', 'Opposing Force'],
    ['ba_security1', 'Blue Shift'],
    ['escape_series_1a', 'Escape Series: Part 1'],
    ['escape_series_2a', 'Escape Series: Part 2'],
    ['escape_series_3a', 'Escape Series: Part 3'],
    ['etc', 'Earthquake Test Center '],
    ['etc2_1', 'Earthquake Test Center 2'],
    ['mistake_coop_a', 'Mistake Co-op'],
    ['po_c1m1', 'Poke 646'],
    ['pv_c1m1', 'Poke 646: Vendetta'],
    ['rl02', 'Residual Life'],
    ['th_ep1_00', 'They Hunger: Episode 1'],
    ['th_ep2_00', 'They Hunger: Episode 2'],
    ['th_ep3_00', 'They Hunger: Episode 3'],
    ['th_escape', 'O simulador de observadores They Hunger: Escape'],
    ['sc_tl_build_puzzle_fft_final', 'Build Puzzle'],
    ['cracklife_c00', 'Do you suck dicks? Crack-Life'],
    ['deluge_beta_v3', 'Deluge'],
    ['io_v1', 'IO'],
    ['dis_beta', 'Disintegration of Time'],
    ['doom2_ep1_b6', 'DOOM II: Hell on Earth'],
    ['afraidofmonsters_lobby', 'Afraid of Monsters (Lobby)'],
    ['aom_intro', 'Afraid of Monsters (Classic)'],
    ['aomdc_1intro', 'Afraid of Monsters (Ending 1)'],
    ['aomdc_2intro', 'Afraid of Monsters (Ending 2)'],
    ['aomdc_3intro', 'Afraid of Monsters (Ending 3)'],
    ['sandstone', 'Sandstone'],
    ['sc_persia', 'Persia'],
    ['afrikakorps1', 'Afrika Korps'],
    ['toonrun1', 'Toon Run'],
    ['sectore_1', 'Sector E'],
    ['richard_boderman', 'Richard Boderman'],
    ['restriction01', 'Restriction'],
    ['mommamesa', 'Momma Mesa'],
    ['crystal', 'Crystal'],
    ['botparty', 'Bot Party'],
    ['bm_nightmare_a_final', 'Black Mesa Nightmare'],
    ['ShockRaid_Jungle', 'ShockRaid Jungle'],
    ['sc_royals1', 'Royals'],
    ['pizza_ya_san1', 'Pizza ya san'],
    ['sc_activist', 'Activist'],
    ['q1_start', 'Quake'],
    ['beachxp', 'Beach Experience'],
    ['infested', 'Infested'],
    ['incoming', 'Incoming'],
    ['kh1', 'Keen Halloween'],
    ['hplanet', 'Hostile Planet'],
    ['uboa_rampage_II', 'Uboa Rampage II'],
    ['sc_egypt', 'Egypt'],
    ['sc_egypt2', 'Egypt 2']
];

/**
 * Returns index for a map from the scmapdb array.
 * 
 * @param {string} map Map name
 * @returns {number} int of the map array, or null if map does not exist in the array.
 */
function mapindex(map) {
    const index = MapData.findIndex((maparr) => maparr.mapname === map);
    if (index == -1) {
        return null;
    }
    else {
        return index;
    }
}

/**
 * Returns string from MapNames array.
 * 
 * @param {string} map Map name
 * @returns {number} string of the queried map in the array, or null if map does not exist in the array.
 */
function MapMsg(map) {
    const index = MapNames.findIndex((maparr) => maparr[0] === map);
    if (index == -1) {
        return null;
    }
    else {
        return MapNames[index][1];
    }
}

/**
 * Returns years, months, days, hours, mins and secs from int value.
 * Limited by its max range:
 *
 * Seconds: 0-59
 * Minutes: 0-59
 * Hours: 0-23
 * Days: 1-30
 * Months: 1-12
 *
 * Does not display if result is 0.
 *
 * Formula base
 * hour in seconds: 60*60 = 3600
 * day in seconds: 60*60*24 = 86400
 * month in seconds: 60*60*24*30 = 2592000
 * year in seconds: 60*60*24*30*12 = 31104000
 *
 * ... but a year is 31536000 compared to previous calculation (diff 432000 = 5 days)
 *
 * @param {number} value Time in seconds.
 * @returns {string} Time in format 00A 00M 00d 00h 00m where each value is > 0.
 */
function converttime(value) {

    const sec = Math.floor(value % 60);
    const min = Math.floor((value % 3600) / 60);
    const hrs = Math.floor((value % 86400) / 3600);
    const dys = Math.floor((value % 2592000) / 86400);
	const mts = Math.floor((value % 31104000) / 2592000 );
    const yrs = Math.floor((value / 31536000));

    const yShow = yrs > 0 ? yrs + (yrs == 1 ? "A " : "A ") : "";
	const MShow = mts > 0 ? mts + (mts == 1 ? "M " : "M ") : "";
    const dShow = dys > 0 ? dys + (dys == 1 ? "D " : "D ") : "";
    const hShow = hrs > 0 ? hrs + (hrs == 1 ? "H " : "H ") : "";
    const mShow = min > 0 ? min + (min == 1 ? "m" : "m") : "";

    return yShow + MShow + dShow + hShow + mShow;
}

/**
 * Returns date and time in UTC.
 * 
 * @returns {string} date in format yyyy-mm-dd hh:mm:ss UTC.
 */
function getutcdate() {
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + " UTC - ";
}

/**
 * Returns some server information such as current players, maxplayers and current map.
 * Sets a message if server is down.
 * @returns {string} Server information in format (0/32) mapname.
 */
var iSrvRetries = 0;
function ServerStatus() {
    sq.open(config.gameserverip, config.gameserverport);
    async.series([
        function (callback) {
            sq.getInfo(function (err, info) {
                callback(err, info);
            });
        },
        /*function (callback) {
             sq.close(function (err, info) {
                 // socket closes when all pending queries have returned or timed out
                 console.log('Socket closed.');
                 callback(err, info);
             });
        },*/
    ],
        function (err, res) {
            if (err != null) {
                iSrvRetries++;
                console.log("Server failed " + iSrvRetries + " times!");
                if (iSrvRetries >= 3) {
                    client.user.setActivity("Server is offline or crashed!");
                }
            }
            else {
                client.user.setActivity("(" + res[0].players + "/" + res[0].maxplayers + ") " + res[0].map);
                iSrvRetries = 0;
            }
            // Encerra a conexão e fecha o socket (evita que fique várias portas de saída em uso)
            sq.close();
        });
}

function FileWatch() {
    g_isSafe = false;

    var guild = client.guilds.get('');

	var previousmap; // to save previous map

    tail.on("line", function (data) {
        //console.log(data);
        if (!data) return;

        if (statusregex.test(data)) { // Map status
            console.log(getutcdate() + "Map Change -> " + data);
            data = data.split(' ');

            if (data[2] === '0') return;

            if (MapMsg(data[1]) != null && data[1] != previousmap ) { //XX iniciou com x jogadores!
                guild.channels.get(config.statuschannel).send('**' + MapMsg(data[1]) + '** ' + 'iniciou com **' + data[2] + '**' + (data[2] > 1 ? ' jogadores!' : ' jogador!'));
            }

            const embed = new Discord.RichEmbed()
                .setColor(0x00AE86) // cor da faixa na esquerda
                .addField("Mapa", data[1], true)
                .addField("Jogadores", data[2], true)
                .setTimestamp() // assina com a data atual no rodapé
            guild.channels.get(config.chatchannel).send({ embed });

			previousmap = data[1];

            return;
        }
        else if (joinregex.test(data)) { // Player Join
            console.log(getutcdate() + "Player Join -> " + data);
        }
        else if (leftregex.test(data)) { // Player Left
            console.log(getutcdate() + "Player Left -> " + data);
        }
        else { // chat
            console.log(getutcdate() + "Chat Relay -> " + data);
            data = data.replace(/\`/, '').replace(/^<(.+)><STEAM_0.+> (.+)/, '`$1`  $2').replace(/(\@mod?|\@admin?)/, '<@&' + config.modsrole + '>');
        }
        guild.channels.get(config.chatchannel).send(data);
    });
}

// Inicia o bot
client.on("ready", () => {
    // Loga no console
    console.log("Bot iniciado, há " + client.users.size + " usuários em " + client.channels.size + " salas com " + client.guilds.size + " canais.");

    // Define o "playing a game" (temporario)
    //client.user.setActivity("v0.45 Iniciando...");
    ServerStatus();
    setInterval(ServerStatus, 17 * 1000); // Starts a schedule to run every 15 seconds. Seems a safe delay.

    if (g_isSafe)
        FileWatch();

});

client.on("guildCreate", guild => {
    console.log(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
});

// Loga no console se o bot for removido do server
client.on("guildDelete", guild => {
    console.log("Bot removido de: " + guild.name + " (id: " + guild.id + ")");
});

// Procura por mensagens
client.on("message", async message => {
    // Ignora mensagens de outros bots
    if (message.author.bot)
        return;

    // Chat relay Discord --> Gameserver
    if (message.channel.id === config.chatchannel) {
        //console.log(message);
        const username = (message.member.nickname === null ? message.member.user.username : message.member.nickname);
        const usermsg = (message.content)
            .replace(/\`/g, '')
            .replace(/%/g, '%%')
            .replace(/<@(\d+)>/g, function (nm) { return '@' + message.guild.member(nm.replace(/<@(\d+)>/, '$1')).user.username; }) // User - Can't use $1 directly why
            .replace(/<@!(\d+)>/g, function (nm) { return '@' + message.guild.member(nm.replace(/<@!(\d+)>/, '$1')).user.username; }) // Nicks - Can't use $1 directly why
            .replace(/<#(\d+)>/g, function (cn) { return '#' + client.channels.get(cn.replace(/<#(\d+)>/, '$1')).name; }) // Channel names - CANT FUCKING USE $1 DIRECTLY WHY
            .replace(/<@&(\d+)>/g, function (rl) { return '@' + message.guild.roles.get(rl.replace(/<@&(\d+)>/g, '$1')).name; }) // Roles
            .replace(/<(:.+:)\d+>/g, '$1'); //custom emojis

		console.log(getutcdate() + "Chat Relay <- " + '(DISCORD) ' + username + ': ' + usermsg);
        fs.appendFile(g_chattosven, '(DISCORD) ' + username + ': ' + usermsg + '\n', function (err) { if (err) throw err; });
        return;
    }

    if (message.channel.id != config.commchannel) {
        return;
    }

    // Ignora mensagens sem prefixo
    if (message.content.indexOf(config.prefix) !== 0)
        return;

    // Separa comandos e argumentos
    // ex: !players R4to0 skpeter jairo tayklor
    // args = [ "R4to0", "skpeter", "jairo", "tayklor" ]
    // Assim como converter pra minusculo
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    //if ( ){}
    // Ping pong
    // Responde com "Pingando" e depois edita com o tempo de resposta em relação a mensagem anterior a edição
    if (command === "ping") {
        const msg = await message.channel.send("Pingando...");
        msg.edit("`" + (msg.createdTimestamp - message.createdTimestamp) + "ms`"); // Latencia da api: ${Math.round(client.ping)}
    }

    // comando pra exibir info de mapas (WIP)
    /*    if (command === "mapinfo") {
            var param = args.join(" ");
    
            if (!param)
                return message.reply("Informe um mapa.");
    
            //const msg = await message.channel.send("`Aguarde...`");
            const index = mapindex(param);
            if (index == null)
                //return msg.edit("`Informação indisponível`");
                return message.channel.send("`Informação indisponível`");
    
            // Se não tiver thumb, deixar em branco
            const mapthumb = (index === null) ? "" : "http://scmapdb.wdfiles.com/local--files/map:" + MapData[index].scmdbname + "/" + MapData[index].thumb;
            const embed = new Discord.RichEmbed()
                .setColor(0x00AE86) // cor da faixa na esquerda
                .setAuthor(MapData[index].author) // string e imagem antes do nome
                .setTitle(MapData[index].name) // max 256 caracteres
                .setURL("http://scmapdb.com/map:" + MapData[index].scmdbname) // url do titulo
                .setDescription(MapData[index].desc) // max 2048 caracteres
                .setThumbnail(mapthumb) // thumb lado direito superior
                .setFooter("Powered by scmapdb.com and Wikidot", "http://scmapdb.wdfiles.com/local--files/site:images/scmapdb.gif") // rodapé
                .setImage("http://scmapdb.wdfiles.com/local--files/map:" + MapData[index].scmdbname + "/" + MapData[index].mappic) // imagem que fica apos a descrição
                .setTimestamp() // assina com a data atual no rodapé
    
            //msg.edit({ embed }); // envia msg
            message.channel.send({embed});
        }*/

    // Se os comandos de chat forem !player ou !jogador
    if (command === "player" || command === "jogador") {

        // junta todos os argumentos numa unica string
        var param = args.join(" ");

        // Se sem argumento, não fazer nada
        if (!param)
            return message.reply("Informe um jogador (nome ou SteamID).");

        //console.log(message.guild.member(param.replace(/[<@!>]/g,"")).user.username);

        /*client.fetchUser(param.replace(/[<@!>]/g,""))
            .then(user => {
                console.log(user);
            }, rejection => {
            });*/


        // Selfping!!!
        if (DiscordIDRegex.test(param)) {
            param = message.guild.member(param.replace(/[<@!>]/g, "")).user.username; // .displayName ou .user.username
        }

        // shit
        var tmp;

        //var msg = await message.channel.send("`Buscando...`");

        // Consulta SQLITE
        // NOTA: Calcular posição no rank
        async.series([
            function (callback) {
                if (SteamIDRegex.test(param)) { //steamid
                    console.log(Date.now() + ": Inicia consulta SQLITE com STEAMID.");
                    db.get("SELECT steamid, name, ROUND(score,0) as pontos, deaths, ROUND(scoregain,0) as ultsganho, ROUND(deathgain,0) as ultdhs, geo, datapoints, datapointgain, strftime('%d/%m/%Y', seen) as ultvisto, lat, lon FROM stats WHERE steamid = \"" + param.replace("STEAM_", "") + "\" ORDER BY score DESC LIMIT 1", function (err, sqdata) {
                        tmp = sqdata;
                        if (!sqdata) return callback("nodata", null);
                        callback(err, sqdata);
                        console.log(Date.now() + ": Termina consulta SQLITE com STEAMID.");
                    });
                }
                else { // nome
                    console.log(Date.now() + ": Inicia consulta SQLITE com NOME.");
                    db.get("SELECT steamid, name, ROUND(score,0) as pontos, deaths, ROUND(scoregain,0) as ultsganho, ROUND(deathgain,0) as ultdhs, geo, datapoints, datapointgain, strftime('%d/%m/%Y', seen) as ultvisto, lat, lon FROM stats WHERE name LIKE \"%" + param + "%\" ORDER BY score DESC LIMIT 1", function (err, sqdata) {
                        tmp = sqdata;
                        if (!sqdata) return callback("nodata", null);
                        callback(err, sqdata);
                        console.log(Date.now() + ": Termina consulta SQLITE com NOME.");
                    });
                }
            },
            function (callback) { //Nota: precisa lidar com erros de api
                const sid = new SteamID("STEAM_" + tmp.steamid);
                console.log(Date.now() + ": Inicia consulta STEAMID SUMMARY.");
                steam.getUserSummary(sid.getSteamID64()).then(plrsum => {
                    callback(null, plrsum);
                    console.log(Date.now() + ": Retorna consulta STEAMID SUMMARY.");
                }).catch(function (e) {
                    console.log(Date.now() + ": Retorna consulta STEAMID SUMMARY com ERRO!");
                    return message.channel.send('`Steam API ' + e + '`');
                });
            },
            function (callback) { //Nota: precisa lidar com erros de api
                const sid = new SteamID("STEAM_" + tmp.steamid);
                console.log(Date.now() + ": Inicia consulta STEAMID BANS.");
                steam.getUserBans(sid.getSteamID64()).then(plrbans => {
                    callback(null, plrbans);
                    console.log(Date.now() + ": Retorna consulta STEAMID BANS.");
                }).catch(function (e) {
                    console.log(Date.now() + ": Retorna consulta STEAMID BANS com ERRO!");
                    return message.channel.send('`Steam API ' + e + '`');
                });
            }
        ],
            function (err, data) {
                //console.log(data);
                if (err === "nodata") {
                    console.log(Date.now() + ": SQLITE retorna resultado VAZIO.")
                    // return msg.edit("`Sem resultados`");
                    return message.channel.send("`Sem resultados`");
                }
                else if (err) {
                    console.log(Date.now() + ": SQLITE retorna ERRO.")
                    //return msg.edit("`Erro na consulta!!!`");
                    return message.channel.send("`Erro na consulta!!!`");
                }
                else {
                    console.log(Date.now() + ": Exibe resultado.")
                    const embed = new Discord.RichEmbed();
                    embed.setColor(0xfa4a4a) // cor da faixa na esquerda
                    embed.setTimestamp(fs.statSync(config.sqlitedb).mtime) // assina com a data atual no rodapé
                    embed.setThumbnail(data[1].avatar.large) // thumb lado direito superior
                    embed.addField("Nome", "[" + data[0].name + "](" + data[1].profileURL + ")", true)
                    embed.addField("País", ":flag_" + data[0].geo.toLowerCase() + ":", true)
                    embed.addField("Tempo no servidor", data[0].datapoints > 1 ? converttime(data[0].datapoints * 30) + (data[0].datapointgain > 1 ? " *(+" + converttime(data[0].datapointgain * 30) + ")*" : "") : "-", true)
                    embed.addField("Última vez visto", data[0].ultvisto === null ? "Desconhecido" : data[0].ultvisto, true)
                    if (data[0].pontos > 0 || data[0].deaths > 0) {
                        embed.addField("Pontos", data[0].pontos + (data[0].ultsganho > 0 ? " *(+" + data[0].ultsganho + ")*" : ""), true)
                        embed.addField("Mortes", data[0].deaths + (data[0].ultdhs > 0 ? " *(+" + data[0].ultdhs + ")*" : ""), true)
                        embed.addField("Relação pontos/mortes", (data[0].pontos / data[0].deaths).toFixed(2), true)
                        embed.addField("Steam ID", "STEAM_" + data[0].steamid, true)

                    }
                    embed.setFooter("Última atualização")
                    if (data[2].vacBanned) {
                        embed.addField("Banido por VAC", "Sim *(" + data[2].vacBans + ")*", true)
                        embed.addField("Último banimento VAC", converttime(data[2].daysSinceLastBan * 86400), true)
                    }
                    if (data[2].gameBans > 0) {
                        embed.addField("Banimento de jogo", "Sim *(" + data[2].gameBans + ")*", true)
                        embed.addField("Último banimento de jogo", "" + data[2].daysSinceLastBan + " dias atrás", true)
                    }
                    if (data[2].communityBanned) {
                        embed.addField("Banido da Comunidade Steam", "Sim", true)
                    }
                    if (data[2].economyBan == "banned") {
                        embed.addField("Banido de Trade", "Sim", true)

                    }
					//embed.setImage("https://maps.googleapis.com/maps/api/staticmap?size=360x80&scale=2&language=en&region=ps&center=" + data[0].lat + "," + data[0].lon +"&zoom=7") // imagem que fica apos a descrição
                    //msg.edit({ embed }); // envia msg
                    message.channel.send({ embed });
                }
            });
        return;
        //db.close();
    }

    if (command === "status") {
        //const msg = await message.channel.send("`Consultando...`");
        console.log(Date.now() + ": Inicia conexão com servidor.");
        sq.open(config.gameserverip, config.gameserverport);

        async.series([
            function (callback) {
                console.log(Date.now() + ": Inicia consulta Source Query SERVERINFO.");
                sq.getInfo(function (err, info) {
                    callback(err, info);
                    console.log(Date.now() + ": Retorna consulta Source Query SERVERINFO.");
                });
            },
            function (callback) {
                console.log(Date.now() + ": Inicia consulta Source Query PLAYERS.");
                sq.getPlayers(function (err, players) {
                    callback(err, players);
                    console.log(Date.now() + ": Retorna consulta Source Query PLAYERS.");
                });
            },
            function (callback) {
                console.log(Date.now() + ": Inicia consulta Source Query SERVERRULES.");
                sq.getRules(function (err, rules) {
                    callback(err, rules);
                    console.log(Date.now() + ": Retorna consulta Source Query SERVERRULES.");
                });
            },
        ],
            function (err, res) {
                // Encerra a conexão e fecha o socket (evita que fique várias portas de saída em uso)
                sq.close();
                console.log(Date.now() + ": Termina serverquery.");
                if (err != null) {
                    //return msg.edit("`Servidor indisponivel`");
                    return message.channel.send("`Servidor indisponivel`");
                }
                else {
                    //console.log(mapindex(res[0].map));
                    const index = mapindex(res[0].map);
                    const mapthumb = (index === null) ? "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/225840/1ef26a0b4dbabb81d8d1682ffd674bc3c71a313f_thumb.jpg" : "http://scmapdb.wdfiles.com/local--files/map:" + MapData[index].scmdbname + "/" + MapData[index].mappic;
                    const embed = new Discord.RichEmbed();
                    embed.setColor(0x0160ac); // line colour on the left
                    embed.setTimestamp(); // footer with current date
                    embed.setThumbnail(mapthumb); // thumb on upper right
                    embed.addField("Mapa atual", res[0].map, true);
                    embed.addField("Próximo mapa", res[2][17].value, true);
                    embed.addField("Jogadores", res[0].players + "/" + res[0].maxplayers, true);
                    embed.addField("IP", `${config.gameserverip}:${config.gameserverport}`, true);
                    embed.addField("Clique para conectar:", `steam://connect/${config.gameserverip}:${config.gameserverport}`);
                    if (res[1].length > 0) {
                        let jogadores = "";
                        for (let i = 0; i < res[1].length; i++) {
                            jogadores = jogadores + res[1][i].name + "\n";
                        }
                        embed.addField("Jogadores", jogadores, true);

                        let pontos = "";
                        for (let i = 0; i < res[1].length; i++) {
                            pontos = pontos + res[1][i].score + "\n";
                        }
                        embed.addField("Pontos", pontos, true);
                    }
                    else {
                        embed.addField("", `Não há jogadores no servidor no momento.`);
                    }
                    embed.setFooter("Consultado em");
                    message.channel.send({ embed });
                }
            });
    }

    if (command === "restart") {
        if (!message.member.roles.some(r => ["Admin", "Moderador"].includes(r.name)))
            return message.reply("Você não tem permissão para usar esse comando!");

        await message.reply(":ok_hand: Entendido, reiniciando...");
        console.log(Date.now() + ": Encerrando bot via !restart...");
        client.destroy();
        process.exit();
    }

    if (command === "hunger") {
        message.channel.send("", {
            file: "https://steemitimages.com/DQmNhVfJfhzWMPnxdUSd1MSpfy1ratLSX2NuNuAT9ooTD6L/FB_IMG_1525284327403.jpg"
        });
    }

	/*if (command === "getusername") {
        var param = args.join(" ");
        if (DiscordIDRegex.test(param)) {
            return message.channel.send("Discord username: " + message.guild.member(param.replace(/[<@!>]/g,"")).user.username); // .displayName ou .user.username
        }
    }*/

    /*if (command === "hehu") {
        return message.reply("hehu!");
    }*/

});

client.login(config.token);

// Catch CTRL+C
// https://stackoverflow.com/questions/10021373/what-is-the-windows-equivalent-of-process-onsigint-in-node-js
if (process.platform === "win32") {
    var rl = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on("SIGINT", function () {
        process.emit("SIGINT");
    });
}

process.on("SIGINT", function () {
    console.log("CTRL + C DETECTADO, ENCERRANDO...");
    client.destroy();
    process.exit();
});
