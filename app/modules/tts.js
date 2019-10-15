/**
 * A Discord bot made for HLDM-BR.NET.
 * 
 * SAPI4 module, for use with TETYYS's SAPI4 web interface https://github.com/TETYYS/SAPI4
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
let ffmpeg = require('fluent-ffmpeg');
let multilang = require('multi-lang');
let rp = require('request-promise-native');
let streamBuffers = require('stream-buffers');

// Utils
const utils = require('../utils/utils.js');

class sapi4 {
    constructor(bot) {
        this.bot = bot;

        this.multilang = multilang(`./app/lang/tts.json`, bot.lang, false);

        this.config = require(`../settings/tts.json`);

        this.command = 'tts';
        this.aliases = [];
        this.description = this.multilang('ML_TTS_DESCRIPTION');
        this.args = true;
        this.guildonly = true;
        this.hidden = false;
        this.usage = this.multilang('ML_TTS_USAGE');
        this.owneronly = false;
        this.cooldown = 5;
        this.permissions = this.config.permissions;
        this.allowedroles = this.config.allowedroles;
        this.denyroles = this.config.denyroles;

        this.voicelist = this.config.voices;
        this.apiurl = this.config.apiurl;
        this.reactyes = this.config.reactyes;
        this.reactno = this.config.reactno;

        this.queuelist = [];

        //TODO:
        // Queue
        // Retry

    }
    Init() { }
    Unload() { }

    async execute(msg, args) {
        // We need ATTACHMENT permission
        if (msg.channel.type !== "dm" && !msg.channel.permissionsFor(this.bot.bot.user).has("ATTACH_FILES")) {
            return msg.channel.send(this.multilang('ML_TTS_NOATTACHPERM'));
        }

        let voice = args[0];
        let voicedata = this.voicelist.find(data => data.shortname === voice);

        if (!voicedata) {
            msg.react(this.reactno).catch(() => { });
            return msg.channel.send(this.multilang('ML_TTS_NOTFOUND', { voice: voice }));
        }

        args.shift(); // remove voice param

        let speed = voicedata.defSpeed;
        let pitch = voicedata.defPitch;
        if (Number.isInteger(parseInt(args[0]))) {
            if (args[0] < voicedata.minSpeed || args[0] > voicedata.maxSpeed) {
                msg.react(this.reactno).catch(() => { });
                return msg.channel.send(this.multilang('ML_TTS_INVALIDSPEED', { max: voicedata.maxSpeed, min: voicedata.minSpeed }));
            }
            speed = args[0];
            args.shift();

            // pitch
            if (Number.isInteger(parseInt(args[0]))) {
                if (args[0] < voicedata.minPitch || args[0] > voicedata.maxPitch) {
                    msg.react(this.reactno).catch(() => { });
                    return msg.channel.send(this.multilang('ML_TTS_INVALIDPITCH', { max: voicedata.maxPitch, min: voicedata.minPitch }));
                }
                pitch = args[0];
                args.shift();
            }
        }


        let text = args.join(" "); // the rest is text

        if (!text) {
            msg.react(this.reactno).catch(() => { });
            return msg.channel.send(this.multilang('ML_TTS_NOTEXT'));
        }

        this.SayTTS(msg, voice, voicedata.name, speed, pitch, text);

    }

    async SayTTS(msg, shortname, voice, speed, pitch, text) {
        pitch = parseInt(pitch);
        speed = parseInt(speed);

        let url = `${this.apiurl}/SAPI4?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}&pitch=${pitch}&speed=${speed}`;

        if (url.length > 4088) {
            msg.react(this.reactno).catch(() => { });
            return msg.channel.send(this.multilang('ML_TTS_TEXTTOOLONG'));
        }

        utils.printmsg(`Requesting TTS URL: ${url}`, 2);
        let filename = `${shortname}-${utils.GetTimeMS()}`;

        let waitmsg = await msg.channel.send(this.multilang('ML_TTS_PROCESSING'));

        //let wav = null;
        let inputStream = new streamBuffers.ReadableStreamBuffer();

        try {
            // Send right away without saving to disk
            //wav = await rp(url, { encoding: null });
            //await msg.channel.send("", { files: [{ attachment: wav, name: `${filename}.wav` }] });

            // TODO: Move this out of async/await as it can be converted to be used while being downloaded (ffmpeg stream)
            inputStream.put(await rp(url, { encoding: null }));
            msg.react(this.reactyes).catch(() => { });

            inputStream.stop();
            waitmsg.edit(this.multilang('ML_TTS_CONVERTING'));

            // Possible race condition here
            this.ConvertAudio(inputStream).then(ogg => {
                waitmsg.edit(this.multilang('ML_TTS_UPLOADING'));
                msg.channel.send("", { files: [{ attachment: ogg.getContents(), name: `${filename}.ogg` }] }).then(() => waitmsg.delete() );
            });

            //wav = null;
            inputStream = null;
			
        }
        catch (error) {
            msg.channel.send(this.multilang('ML_TTS_API_ERROR'));
            inputStream = null;
            waitmsg.delete();
            utils.printmsg(error, 3);
            return;
        }
    }

    ConvertAudio(inputdata) {
        return new Promise((resolve, reject) => {
            let outputStream = new streamBuffers.WritableStreamBuffer();

            let ffmpgcmd = ffmpeg(inputdata)
                .inputFormat('wav');
            ffmpgcmd
                .format('ogg')
                .on('start', (commandLine) => {
                    utils.printmsg(`[TTS] Spawned ffmpeg with command:  ${commandLine}`, 2);
                })
                .on('progress', (progress) => {
                    utils.printmsg(`[TTS] ${JSON.stringify(progress)}`, 3); // debug
                })
                .on('error', (err) => {
                    utils.printmsg(`[TTS] ffmpeg error: ${err.message}`, 2);
                    inputdata = null;
                    outputStream = null;
                    reject(null);
                })
                .on('end', () => {
                    utils.printmsg('[TTS] ffmpeg finished');
                    inputdata = null;
                    outputStream.end();
                    resolve(outputStream);
                    outputStream = null;
                })
                .pipe(outputStream, {
                    end: true
                });
        });
    }
}

module.exports = sapi4;
