// Não mexa abaixo a não ser que você saiba o que está fazendo

// Bibliotecas
const Discord = require("discord.js");
const sqlite3 = require("sqlite3");
const SteamID = require("steamid");
const request = require("request");
const SteamAPI = require("steamapi");           // https://www.npmjs.com/package/steamapi
const SourceQuery = require('sourcequery');     // https://www.npmjs.com/package/sourcequery
const async = require('async');

const config = require("./config.json")
const client = new Discord.Client();
const db = new sqlite3.Database(config.sqlitedb);
const steam = new SteamAPI(config.steamapikey); // https://steamcommunity.com/dev/apikey
const sq = new SourceQuery(config.gstimeout);

const SteamIDRegex = /^STEAM_(0:[01]:[0-9]+)$/;
const IDRegex = /^0:[01]:[0-9]+$/;

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

function mapindex(map){
    var index = MapData.findIndex((maparr) => maparr.mapname === map);
    if (index == -1){
        return null;
    }
    else {
        return index;
    }
}



// Inicia o bot
client.on("ready", () => {
    // Loga no console
    console.log("Bot iniciado, há " + client.users.size + " usuários em " + client.channels.size + " salas com " + client.guilds.size + " canais.");

    // Define o "playing a game"
    client.user.setActivity("Digite !ajuda");

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

    // Ignora mensagens sem prefixo
    if (message.content.indexOf(config.prefix) !== 0)
        return;

    // Separa comandos e argumentos
    // ex: !players R4to0 skpeter jairo tayklor
    // args = [ "R4to0", "skpeter", "jairo", "tayklor" ]
    // Assim como converter pra minusculo
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

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
        var mapthumb;
        const index = mapindex(param);
        if (index == null)
            return msg.edit("`Informação indisponível`");

        // Se não tiver thumb, deixar em branco
        if (MapData[index].thumb === ''){
            mapthumb = ""
        }
        else {
            mapthumb = "http://scmapdb.wdfiles.com/local--files/map:" + MapData[index].scmdbname + "/" + MapData[index].thumb;
        }
        
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

        //.addField("This is a field title, it can hold 256 characters", "This is a field value, it can hold 2048 characters.")
        //.addField("Inline Field", "They can also be inline.", true)
        //.addBlankField(true)
        //.addField("Inline Field 3", "You can have a maximum of 25 fields.", true);

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
        var sid, sqldata, sumdata, bandata;

        var msg = await message.channel.send("`Consultando banco de dados...`");

        // Consulta SQLITE
        if (SteamIDRegex.test(param)) // testa se é uma steamid
        {
            console.log(Date.now() + ": STEAMID informado.")
            var consulta = function (callback) {
                console.log(Date.now() + ": Inicia consulta SQLITE com STEAMID.")
                db.get("SELECT steamid,name,ROUND(score,0) as pontos,geo,deaths FROM stats WHERE steamid = \"" + param.replace("STEAM_", "") + "\" ORDER BY score DESC LIMIT 1", function (err, res) {
                    callback(err, res);
                });
            };
        }
        else {
            console.log(Date.now() + ": NOME informado.")
            var consulta = function (callback) {
                console.log(Date.now() + ": Inicia consulta SQLITE com NOME.")
                db.get("SELECT steamid,name,ROUND(score,0) as pontos,geo,deaths FROM stats WHERE name LIKE \"%" + param + "%\" ORDER BY score DESC LIMIT 1", function (err, res) {
                    callback(err, res);
                });
            };
        }

        consulta(function (err, res) {
            if (err) {
                console.log(Date.now() + ": SQLITE retorna ERRO.")
                return msg.edit("`ERRO NA CONSULTA!!!`");
            }
            else if (res == null) {
                console.log(Date.now() + ": SQLITE retorna resultado VAZIO.")
                return msg.edit("`Sem resultados`");
            }
            else {
                console.log(Date.now() + ": SQLITE retorna resultado.")
                sqldata = res;
                msg.edit("SteamID: " + res.steamid + ". Pontos: " + res.pontos);
                steamdata();
            }
        });

        async function steamdata() {
            sid = new SteamID("STEAM_" + sqldata.steamid);
            console.log(Date.now() + ": Inicia consulta STEAMID SUMMARY.")
            sumdata = await steam.getUserSummary(sid.getSteamID64()).then(summary => {
                console.log(Date.now() + ": Retorna consulta STEAMID SUMMARY.")
                return { 
                    avatar: summary.avatar.large,
                    created: summary.created,
                    steamname: summary.nickname
                };
            });
        }

        async function banfetch() {
            sid = new SteamID("STEAM_" + sqldata.steamid);
            console.log(Date.now() + ": Inicia consulta STEAMID BAN.")
            bandata = await steam.getUserBans(sid.getSteamID64()).then(baninfo => {
                console.log(Date.now() + ": Retorna consulta STEAMID BAN.")
                return {
                    vacBans: baninfo.vacBans,
                    daysSinceLastBan: baninfo.daysSinceLastBan,
                    communityBanned: baninfo.communityBanned,
                    gameBans: baninfo.gameBans
                };
            });
        }


        // Consulta Steam API
        //msg.edit( "`Consultando Steam API...`" );
        //const sid = new SteamID( param );

        /*var usersum = steam.getUserSummary( sid.getSteamID64() ).then( summary =>
        {
            return { 
                avatar: summary.avatar.large,
                created: summary.created,
                steamname: summary.nickname
            };
        });
        var userbans = steam.getUserBans( sid.getSteamID64() ).then( baninfo =>
        {
            return {
                vacBans: baninfo.vacBans,
                daysSinceLastBan: baninfo.daysSinceLastBan,
                communityBanned: baninfo.communityBanned,
                gameBans: baninfo.gameBans
            };
        });*/

        //console.log( usersum );
        //console.log( userbans );

        //message.channel.send( row.nane + ": " );
        //console.log(row.steamid + ": " + row.pontos);

        //return msg.edit( "SteamID: " + row.steamid + ". Pontos: " + row.pontos );
        return;
        //}); // termino sqlite
        //db.close();
    }

    if (command === "status") {
        const msg = await message.channel.send("`Aguarde...`");
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
                        for (i = 0; i < res[1].length; i++){
                            jogadores = jogadores + res[1][i].name + "\n";
                            //console.log(res[1][i].name);
                        }
                }
                //console.log(mapindex(res[0].map));
                const index = mapindex(res[0].map);
                var mapthumb;
                if (index == null)
                {
                    mapthumb = "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/225840/1ef26a0b4dbabb81d8d1682ffd674bc3c71a313f_thumb.jpg";
                }
                else {
                    mapthumb = "http://scmapdb.wdfiles.com/local--files/map:" + MapData[index].scmdbname + "/" + MapData[index].mappic;
                }
                const embed = new Discord.RichEmbed()
                    .setColor(0x00AE86) // cor da faixa na esquerda
                    .setTimestamp() // assina com a data atual no rodapé
                    .setThumbnail(mapthumb) // thumb lado direito superior
                    .addField("Mapa", res[0].map, true) // + "\n(próximo: " + res[2][17].value + ")"
                    .addField("Jogadores", res[0].players + "/" + res[0].maxplayers, true)
                    .addField("Próximo", res[2][17].value, true)
                    .addField("IP", "[" + config.gameserverip + ":" + config.gameserverport + "](steam://connect/" + config.gameserverip + ":" + config.gameserverport + ")", true)
                    .addField("Jogadores no servidor", jogadores)
                    .setFooter("Powered by Steam")

                msg.edit({ embed }); // envia msg
            }

        });
    }

    if (command === "playagame") {

    }


});

client.login(config.token);