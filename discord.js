/**
 * Guts - Discord bot made specially for HLDM-BR.NET by Rafael "R4to0" Alves.
 * Based on 'gus.pl' by incognico.
 * All rights reserved.
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

// Bibliotecas
const Discord = require('discord.js');          // https://www.npmjs.com/package/discord.js
const sqlite3 = require('sqlite3');             // https://www.npmjs.com/package/sqlite3
const SteamID = require('steamid');             // https://www.npmjs.com/package/steamid
const SteamAPI = require('steamapi');           // https://www.npmjs.com/package/steamapi
const SourceQuery = require('sourcequery');     // https://www.npmjs.com/package/sourcequery
const async = require('async');                 // https://www.npmjs.com/package/async
const fs = require('fs');
//const isIp = require('is-ip');                  // https://www.npmjs.com/package/is-ip

const config = require("./config.json")
const client = new Discord.Client();
const db = new sqlite3.Database(config.sqlitedb);
const steam = new SteamAPI(config.steamapikey); // https://steamcommunity.com/dev/apikey
const sq = new SourceQuery(config.gstimeout);

// SteamID Regex
const SteamIDRegex = /^STEAM_(0:[01]:[0-9]+)$/;

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

/**
 * Returns index for a map from the above array.
 * 
 * @param {string} map Map name
 * @returns {number} int of the map array, or null if map does not exist in the array.
 */
function mapindex(map) {
    var index = MapData.findIndex((maparr) => maparr.mapname === map);
    if (index == -1) {
        return null;
    }
    else {
        return index;
    }
}

/**
 * Returns years, days, hours, mins and secs from int value.
 * Does not display if result is 0.
 * @param {number} value Time in seconds.
 * @returns {string} Time in years, days, hours, mins and secs where each value is > 0.
 */
function converttime(value) {

    const sec = Math.floor(value % 60);
    const min = Math.floor((value % 3600) / 60);
    const hrs = Math.floor((value % 86400) / 3600);
    const dys = Math.floor((value % (86400 * 30)) / 86400);
    const yrs = Math.floor((value / 31536000));
    
    const yShow = yrs > 0 ? yrs + (yrs == 1 ? "a " : "a ") : "";
    const dShow = dys > 0 ? dys + (dys == 1 ? "d " : "d ") : "";
    const hShow = hrs > 0 ? hrs + (hrs == 1 ? "h " : "h ") : "";
    const mShow = min > 0 ? min + (min == 1 ? "m" : "m") : "";

    return yShow + dShow + hShow + mShow; 
}

// Inicia o bot
client.on("ready", () => {
    // Loga no console
    console.log("Bot iniciado, há " + client.users.size + " usuários em " + client.channels.size + " salas com " + client.guilds.size + " canais.");

    // Define o "playing a game" (temporario)
    client.user.setActivity("Digite !ajuda");

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
    if (command === "mapinfo") {
        var param = args.join(" ");

        if (!param)
            return message.reply("Informe um mapa.");

        const msg = await message.channel.send("`Aguarde...`");
        const index = mapindex(param);
        if (index == null)
            return msg.edit("`Informação indisponível`");

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

        msg.edit({ embed }); // envia msg
    }

    // Se os comandos de chat forem !player ou !jogador
    if (command === "player" || command === "jogador") {

        // junta todos os argumentos numa unica string
        var param = args.join(" ");

        // Se sem argumento, não fazer nada
        if (!param)
            return message.reply("Informe um jogador (nome ou SteamID).");

        // shit
        var tmp;

        var msg = await message.channel.send("`Buscando...`");

        // Consulta SQLITE
        // NOTA: Calcular posição no rank
        async.series([
            function (callback) {
                if (SteamIDRegex.test(param)) { //steamid
                    console.log(Date.now() + ": Inicia consulta SQLITE com STEAMID.");
                    db.get("SELECT steamid, name, ROUND(score,0) as pontos, deaths, ROUND(scoregain,0) as ultsganho, ROUND(deathgain,0) as ultdhs, geo, datapoints, datapointgain, strftime('%d/%m/%Y', seen) as ultvisto FROM stats WHERE steamid = \"" + param.replace("STEAM_", "") + "\" ORDER BY score DESC LIMIT 1", function (err, sqdata) {
                        tmp = sqdata;
                        if (!sqdata) return callback("nodata", null);
                        callback(err, sqdata);
                        console.log(Date.now() + ": Termina consulta SQLITE com STEAMID.");
                    });
                }
                else { // nome
                    console.log(Date.now() + ": Inicia consulta SQLITE com NOME.");
                    db.get("SELECT steamid, name, ROUND(score,0) as pontos, deaths, ROUND(scoregain,0) as ultsganho, ROUND(deathgain,0) as ultdhs, geo, datapoints, datapointgain, strftime('%d/%m/%Y', seen) as ultvisto FROM stats WHERE name LIKE \"%" + param + "%\" ORDER BY score DESC LIMIT 1", function (err, sqdata) {
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
                });
            },
            function (callback) { //Nota: precisa lidar com erros de api
                const sid = new SteamID("STEAM_" + tmp.steamid);
                console.log(Date.now() + ": Inicia consulta STEAMID BANS.");
                steam.getUserBans(sid.getSteamID64()).then(plrbans => {
                    callback(null, plrbans);
                    console.log(Date.now() + ": Retorna consulta STEAMID BANS.");
                });
            }
        ],
        function (err, data) {
            //console.log(data);
            if (err === "nodata") {
                console.log(Date.now() + ": SQLITE retorna resultado VAZIO.")
                return msg.edit("`Sem resultados`");
            }
            else if (err) {
                console.log(Date.now() + ": SQLITE retorna ERRO.")
                return msg.edit("`Erro na consulta!!!`");
            }
            else {
                console.log(Date.now() + ": Exibe resultado.")
                const embed = new Discord.RichEmbed();
                    embed.setColor(0x00AE86) // cor da faixa na esquerda
                    embed.setTimestamp(fs.statSync(config.sqlitedb).mtime) // assina com a data atual no rodapé
                    embed.setThumbnail(data[1].avatar.large) // thumb lado direito superior
                    embed.addField("Nome", "[" + data[0].name + "](" + data[1].profileURL + ")", true)
                    embed.addField("País", ":flag_" + data[0].geo.toLowerCase() + ":", true)
                    embed.addField("Tempo no servidor", data[0].datapoints*30 > 0 ? converttime(data[0].datapoints*30) + (data[0].datapointgain*30 > 0 ? " *(+"+  converttime(data[0].datapointgain*30) + ")*" : "") : "-", true)
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
                        embed.addField("Último banimento VAC", converttime(data[2].daysSinceLastBan*86400), true)
                    }
                    if (data[2].communityBanned) {
                        embed.addField("Banido da Comunidade Steam", "Sim", true)
                    }
                    if (data[2].economyBan == "banned"){
                        embed.addField("Banido de Trade", "Sim", true)

                    }
                msg.edit({ embed }); // envia msg
            }
        });
        return;
        //db.close();
    }

    if (command === "status") {
        const msg = await message.channel.send("`Consultando...`");
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
            console.log(Date.now() + ": Termina serverquery.");
            if (err != null) {
                return msg.edit("`Servidor indisponivel`");
            }
            else {
                var jogadores = "Não há jogadores no servidor.";
                if (res[1].length > 0) {
                    jogadores = "";
                    for (i = 0; i < res[1].length; i++) {
                        jogadores = jogadores + res[1][i].name + "\n";
                    }
                }
                //console.log(mapindex(res[0].map));
                const index = mapindex(res[0].map);
                const mapthumb = (index === null) ? "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/225840/1ef26a0b4dbabb81d8d1682ffd674bc3c71a313f_thumb.jpg" : "http://scmapdb.wdfiles.com/local--files/map:" + MapData[index].scmdbname + "/" + MapData[index].mappic;
                const embed = new Discord.RichEmbed()
                    .setColor(0x00AE86) // cor da faixa na esquerda
                    .setTimestamp() // assina com a data atual no rodapé
                    .setThumbnail(mapthumb) // thumb lado direito superior
                    .addField("Mapa", res[0].map, true) // + "\n(próximo: " + res[2][17].value + ")"
                    .addField("Jogadores", res[0].players + "/" + res[0].maxplayers, true)
                    .addField("Próximo", res[2][17].value, true)
                    .addField("IP", "[" + config.gameserverip + ":" + config.gameserverport + "](steam://connect/" + config.gameserverip + ":" + config.gameserverport + ")", true)
                    .addField("Jogadores no servidor", jogadores)
                    .setFooter("Última atualização")
                msg.edit({ embed }); // envia msg
            }
        });
    }

    if (command === "hehu") {
        return message.reply("hehu!");
    }


});

client.login(config.token);