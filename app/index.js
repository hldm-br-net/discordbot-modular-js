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

// Static module imports
const path = require('path');
const readline = require('readline');

// Globals
global.g_basedir = path.resolve(__dirname);
global.g_issafe = false;

// Bot instance
const GutsBot = require('./core.js');
let BotInstance = new GutsBot();

// Send unhandled promise error messages over PM
process.on("unhandledRejection", err => {
    console.error(`Unhandled promise rejection!\n${err.stack}`);
    try {
        if (g_issafe) BotInstance.bot.users.get(BotInstance.config.owneruid).send(err.stack); // Send stack to owner
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
    g_issafe = false;
    console.log("Killing main class instance...");
    try {
        (async () => {
            await BotInstance.Destroy().then(BotInstance = null);
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
