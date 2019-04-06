/**
 * Guts - A Discord bot made for HLDM-BR.NET.
 * 
 * Unloader module for Guts
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

const decache = require('decache');
const gc = require('expose-gc/function');
const multilang = require('multi-lang');

class ModuleUnloader {
    constructor(bot) {
        this.m_multilang = multilang(`./app/lang/unload.json`, bot.m_lang, false);

        this.m_command = 'unload';
        //this.m_aliases = ['', ''];
        this.m_description = this.m_multilang('ML_UNLOAD_DESCRIPTION');
        this.m_args = true;
        this.m_guildonly = true;
        this.m_hidden = true;
        this.m_usage = this.m_multilang('ML_UNLOAD_USAGE');
        //this.m_cooldown = 0;
        this.m_owneronly = true;
        this.m_permissions = ['ADMINISTRATOR'];
        //this.m_allowedroles = [];
        //this.m_denyroles = [];
    }
    Init() { }

    async execute(msg, args) {
        args = args.join(" ");

        if (args === "load" | args === "unload" | args === "reload")
            return msg.channel.send(this.m_multilang('ML_UNLOAD_NOTSUPPORTED'));

        if (msg.client.collection.has(args)) {
            await this.UnloadModule(msg, args);
            return msg.channel.send(`${this.m_multilang('ML_UNLOAD_UNLOADED', { filename: args })}`)
        }
        else {
            return msg.channel.send(`${this.m_multilang('ML_UNLOAD_NOTLOADED', { filename: args })}`)
        }
    }

    async UnloadModule(msg, args) {
        let victim = msg.client.collection.get(args)
        victim.Unload(); // TODO: check if function exists
        msg.client.collection.set(args, null);
        msg.client.collection.delete(args);
        decache(`${this.m_moduledir}/${args}.js`); // delete from node require cache
        gc(); // force garbage collector to run
    }

}

module.exports = ModuleUnloader;