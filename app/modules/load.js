/**
 * Discord bot made for HLDM-BR.NET.
 * 
 * Loader module
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

const multilang = require('multi-lang');

// Utils
const utils = require('../utils/utils.js');

module.exports = class ModuleLoader {
    constructor(bot) {
        this.multilang = multilang(`./app/lang/load.json`, bot.lang, false);
        this.bot = bot
        this.moduledir = bot.moduledir;

        this.command = 'load';
        //this.aliases = ['', ''];
        this.description = this.multilang('ML_LOAD_DESCRIPTION');
        this.args = true;
        this.guildonly = true;
        this.hidden = true;
        this.usage = this.multilang('ML_LOAD_USAGE');
        //this.cooldown = 0;
        this.owneronly = true;
        this.permissions = ['ADMINISTRATOR'];
        //this.allowedroles = [];
        //this.denyroles = [];
    }
    Init() { }
    Unload() { }

    async execute(msg, args) {
        args = args.join(" ");

        if (msg.client.collection.has(args))
            return msg.channel.send(`${this.multilang('ML_LOAD_ALREADYLOADED', { filename: args })}`);

        try {
            await this.LoadModule(msg, args);
            return msg.channel.send(`${this.multilang('ML_LOAD_LOADED', { filename: args })}`);
        } catch (error) {
            utils.printmsg(error, 3);
            return msg.channel.send(`${this.multilang('ML_LOAD_FAILED', { filename: args })}`);
        }
    }

    async LoadModule(msg, args) {
        // Make sure module is not cached
        delete require.cache[require.resolve(`${this.moduledir}/${args}.js`)];
        //gc(); // force garbage collector to run

        let loadfile = require(`${this.moduledir}/${args}.js`);
        let object = new loadfile(this.bot);

        object.Init(); // call setup

        msg.client.collection.set(args, object);

        loadfile = null;
        object = null;
    }
}
