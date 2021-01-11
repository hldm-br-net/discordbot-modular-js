# Multi-purpose bot made for HLDM-BR.NET community.

Yet another modular discord bot made in NodeJS, written for use with HLDM-BR.NET servers.


Feel free to use as a reference for any other purpose.

## Required external dependencies
Base:
- [discord.js](https://www.npmjs.com/package/discord.js)
- [emoji-to-short-name](https://www.npmjs.com/package/emoji-to-short-name)
- [multi-lang](https://www.npmjs.com/package/multi-lang)

Modules:
- player.js: [better-sqlite3](https://www.npmjs.com/package/better-sqlite3), [steamapi](https://www.npmjs.com/package/steamapi), [steamid](https://www.npmjs.com/package/steamid)
- tts.js: [fluent-ffmpeg](https://www.npmjs.com/package/fluent-ffmpeg), [request-promise-native](https://www.npmjs.com/package/request-promise-native), [request](https://www.npmjs.com/package/request), [stream-buffers](https://www.npmjs.com/package/stream-buffers)


- load.js, ping.js, reload.js, unload.js: No external dependencies required


## Included commands/modules
 - load.js/unload.js/reload.js: Loading/Unloading/Reloading of modules on the fly with "!load filename", "!unload filename" and "!reload filename" commands. This is also known as "Hot-module reload".
 - ping.js: Ping/pong to test latency between the bot and Discord gateway.
 - player.js: To be used with @incognico's [svenstats](https://github.com/incognico/svenstats) log parser for Sven Co-op
 - tts.js: Wrapper for @TETTYS' [SAPI4](https://github.com/TETYYS/SAPI4) server.

#
`
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`
