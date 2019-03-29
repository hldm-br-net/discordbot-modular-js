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

const config = require(`../settings/bot.json`);

/**
* Return years, months, days, hours, mins and secs from int value.
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
const FormatTime = seconds => {
    const sec = Math.floor(seconds % 60);
    const min = Math.floor((seconds % 3600) / 60);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const dys = Math.floor((seconds % 2592000) / 86400);
    const mts = Math.floor((seconds % 31104000) / 2592000);
    const yrs = Math.floor((seconds / 31536000));

    const yShow = yrs > 0 ? yrs + (yrs == 1 ? "A " : "A ") : "";
    const MShow = mts > 0 ? mts + (mts == 1 ? "M " : "M ") : "";
    const dShow = dys > 0 ? dys + (dys == 1 ? "D " : "D ") : "";
    const hShow = hrs > 0 ? hrs + (hrs == 1 ? "h " : "h ") : "";
    const mShow = min > 0 ? min + (min == 1 ? "m" : "m") : "";

    return yShow + MShow + dShow + hShow + mShow;
}

/**
 * Return current local date in ISO format
 * 
 * @returns {string} Current date in YYYY-MM-DD HH:MM:SS
 */
const GetLocalDate = () => {
    const date = new Date();
    var ten = function (i) {
        return (i < 10 ? '0' : '') + i;
    },
        YYYY = date.getFullYear(),
        MM = ten(date.getMonth() + 1),
        DD = ten(date.getDate()),
        HH = ten(date.getHours()),
        II = ten(date.getMinutes()),
        SS = ten(date.getSeconds());
    return YYYY + '-' + MM + '-' + DD + ' ' + HH + ':' + II + ':' + SS;
}

/**
 * Returns time in milliseconds
 * 
 * @returns {number} Time in milliseconds.
 */
const GetTimeMS = () => {
    return (new Date()).getTime();
}

/**
 * Returns Unix timestamp.
 * 
 * @returns {number} Unix time.
 */
const GetUnixTime = () => {
    return Math.round((new Date()).getTime() / 1000);
}

/**
 * Prints debug message in the console for basic debugging
 * 0 = silent
 * 1 = default
 * 2 = info
 * >=3 = debug
 * 
 * @param {string} printmsg Message to print
 * @param {number} level Message level
 */
const printmsg = (msg, level = 1) => {
    // If 0 do nothing (silent)
    if (!config.verbose) return;

    // If level is not specified, threat as level 1.
    if (!level || level === 1 && config.verbose >= 1)
        console.log(`${GetLocalDate()}: ${msg}`);

    // Level 2 (Info)
    if (level === 2 && config.verbose >= 2)
        console.log(`${GetLocalDate()}: (INFO) ${msg}`);

    // Level 3 (Debug)
    if (level >= 3 && config.verbose >= 3)
        console.log(msg);
}

/**
 * Simulates the sleep command from Unix
 * 
 * @param {number} sec 
 */
const sleep = async (sec) => {
    return new Promise(resolve => {
        setTimeout(resolve, sec * 1000);
    });
};

module.exports = {
    FormatTime,
    GetLocalDate,
    GetTimeMS,
    GetUnixTime,
    printmsg,
    sleep
}

