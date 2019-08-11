"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var path = __importStar(require("path"));
var fs = __importStar(require("fs"));
var net = __importStar(require("net"));
var irc_1 = require("irc");
var fs_promise_1 = require("./fs-promise");
//import { promises as fsp } from 'fs'; // experimental ...
var ircXdccEvents = __importStar(require("./irc-xdcc-events"));
var irc_xdcc_transfer_1 = require("./irc-xdcc-transfer");
var irc_xdcc_options_1 = require("./irc-xdcc-options");
var irc_xdcc_transfer_state_1 = require("./irc-xdcc-transfer-state");
var irc_xdcc_message_1 = require("./irc-xdcc-message");
var converter_1 = require("./converter");
var version_1 = require("./version");
var XdccClient = /** @class */ (function (_super) {
    __extends(XdccClient, _super);
    function XdccClient(server, nick, opt) {
        var _this = this;
        var defaultOptions = new irc_xdcc_options_1.XdccOptions();
        var options = __assign({}, defaultOptions, opt);
        // create destination directory
        fs.mkdir(options.destPath, function () { });
        _this = _super.call(this, server, nick, options) || this;
        _this.isConnected = false;
        _this.server = server;
        _this.options = options;
        _this.transferPool = [];
        _this.lastIndex = 0;
        _this.on(ircXdccEvents.ircRegistered, _this.registeredHandler)
            .on(ircXdccEvents.ircCtcpVersion, _this.versionHandler)
            .on(ircXdccEvents.ircCtcpPrivmsg, _this.privCtcpHandler)
            .on(ircXdccEvents.ircNotice, _this.noticeHandler)
            .on(ircXdccEvents.ircQuit, _this.disconnectedHandler)
            .on(ircXdccEvents.ircKill, _this.disconnectedHandler);
        if (options.joinTopicChans) {
            _this.on(ircXdccEvents.ircTopic, _this.topicHandler);
        }
        return _this;
    }
    /**
     * Adds a transfer to the pool based on the provided xdcc pack info
     * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
     */
    XdccClient.prototype.addTransfer = function (packInfo) {
        var _this = this;
        if (!packInfo.botNick) {
            this.emit(ircXdccEvents.xdccError, 'botNick not provided');
            return Promise.reject({ code: ircXdccEvents.xdccError, message: 'botNick not provided' });
        }
        if (!packInfo.packId) {
            this.emit(ircXdccEvents.xdccError, 'packId not provided');
            return Promise.reject({ code: ircXdccEvents.xdccError, message: 'packId not provided' });
        }
        packInfo.server = this.server;
        return this.search(packInfo)
            .then(function (transfers) {
            if (transfers.length) {
                return Promise.reject({ code: ircXdccEvents.xdccError, message: 'required pack already in pool', id: transfers[0].transferId });
            }
            return _this.createTransfer(packInfo);
        })
            .then(function (transfer) {
            _this.emit(ircXdccEvents.xdccCreated, transfer);
            return _this.start(transfer);
        })
            .catch(function (err) { return _this.emit(ircXdccEvents.xdccError, err); });
    };
    /**
     * Cancels the provided transfer
     * @param {XdccTransfer} xdccTransfer transfer instance
     */
    XdccClient.prototype.cancelTransfer = function (xdccTransfer) {
        var _this = this;
        if (xdccTransfer.transferId) {
            return this.cancelTransferById(xdccTransfer.transferId);
        }
        return this.search(xdccTransfer)
            .then(function (transfers) {
            if (!transfers || !transfers.length) {
                return Promise.reject("Unable to remove the specified transfer, not found.");
            }
            return _this.cancelTransferById(transfers[0].transferId);
        });
    };
    /**
     * Cancels the transfer matching the provided xdcc pack info
     * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
     */
    XdccClient.prototype.cancelTransferByInfo = function (packInfo) {
        var _this = this;
        return this.search({ botNick: packInfo.botNick, packId: packInfo.packId })
            .then(function (transfers) {
            if (!transfers || !transfers.length) {
                return Promise.reject("Unable to remove the specified transfer, not found.");
            }
            return _this.cancelTransferById(transfers[0].transferId);
        });
    };
    /**
     * Cancels the transfer at the specified index in the transfer pool
     * @param {number} transferId transfer pool index
     */
    XdccClient.prototype.cancelTransferById = function (transferId) {
        var _this = this;
        return this.search({ transferId: transferId })
            .then(function (transfers) {
            if (!transfers || !transfers.length) {
                return Promise.reject("Unable to remove transfer with id " + transferId + ", not found.");
            }
            _this.cancel(transfers[0]);
            return Promise.resolve(transfers[0]);
        });
    };
    /**
     * Returns the list of transfers
     */
    XdccClient.prototype.listTransfers = function () {
        return Promise.resolve(this.transferPool);
    };
    /**
     * Removes the provided transfer instance from the list
     * @param {XdccTransfer} xdccTransfer transfer instance
     */
    XdccClient.prototype.removeTransfer = function (xdccTransfer) {
        var _this = this;
        if (xdccTransfer.transferId) {
            return this.removeTransferById(xdccTransfer.transferId);
        }
        return this.search(xdccTransfer)
            .then(function (transfers) {
            if (!transfers || !transfers.length) {
                return Promise.reject("Unable to remove the specified transfer, not found.");
            }
            return _this.removeTransferById(transfers[0].transferId);
        });
    };
    /**
     * Removes the transfer at the specified index in the transfer pool
     * @param {number} transferId transfer pool index
     */
    XdccClient.prototype.removeTransferById = function (transferId) {
        var _this = this;
        return this.cancelTransferById(transferId)
            .then(function (transfer) {
            var index = _this.transferPool.indexOf(transfer);
            _this.transferPool.splice(index, 1);
            _this.emit(ircXdccEvents.xdccRemoved, transfer);
            return Promise.resolve(transfer);
        });
    };
    /**
     * Disconnects the IRC client
     * @param message disconnection message
     * @param callback function called after being disconnected
     */
    XdccClient.prototype.disconnect = function (message, callback) {
        var _this = this;
        message = message || version_1.version;
        this.emit(ircXdccEvents.ircQuit, this.nick, message, Object.keys(this.chans), null);
        this.clear()
            .catch(function (err) { return _this.emit(ircXdccEvents.ircError, err); })
            .then(function () { return irc_1.Client.disconnect.call(_this, message, callback); });
    };
    /**
     * Handles when the client is fully registered on the IRC network
     * @param {string} message registration message
     */
    XdccClient.prototype.registeredHandler = function (message) {
        var _this = this;
        var channelRejoinedQueue = this.options.channels.map(function (chan) { return new Promise(function (resolve, reject) {
            _this.once(ircXdccEvents.ircJoin + chan.toLowerCase(), function (nick, message) {
                if (nick == _this.nick) {
                    resolve(chan);
                }
            });
        }); });
        Promise.all(channelRejoinedQueue)
            .then(function (channels) {
            _this.isConnected = true;
            _this.emit(ircXdccEvents.ircConnected, channels);
            /* Used .once instead of .on, no need to remove the listeners anymore
            this.options.channels.forEach((chan) => {
                this.removeAllListeners(ircXdccEvents.ircJoin+chan.toLowerCase());
            });*/
            return _this.resume();
        })
            .catch(function (err) { return _this.emit(ircXdccEvents.ircError, err); });
    };
    /**
     * Handles CTCP Version messages
     * @param {string} from CTCP emitter
     * @param {string} to CTCP recipient
     * @param {string} message raw CTCP message
     */
    XdccClient.prototype.versionHandler = function (from, to, message) {
        this.ctcp(from, 'normal', 'VERSION ' + version_1.version);
    };
    /**
     * Handles CTCP PrivMsg messages
     * @param {string} from CTCP emitter
     * @param {string} to CTCP recipient
     * @param {string} text CTCP content
     * @param {string} message raw CTCP message
     */
    XdccClient.prototype.privCtcpHandler = function (from, to, text, message) {
        var _this = this;
        if (to !== this.nick
            || !text
            || text.substr(0, 4) !== 'DCC ') {
            this.emit(ircXdccEvents.xdccError, { error: 'not a DCC message', message: message });
            return;
        }
        var parsedMessage = text.match(this.options.dccParser);
        if (!parsedMessage || !parsedMessage.length) {
            this.emit(ircXdccEvents.xdccError, { error: 'unable to parse DCC message', message: message });
            return;
        }
        var xdccMessage = new irc_xdcc_message_1.XdccMessage();
        xdccMessage.sender = from;
        xdccMessage.target = to;
        xdccMessage.message = text;
        xdccMessage.params = parsedMessage;
        // Delay handling so the notice with filename can be parsed... (?)
        setTimeout(function () {
            return _this.search({
                botNick: xdccMessage.sender,
                fileName: xdccMessage.params[2]
            })
                .then(function (transfers) {
                if (transfers.length) {
                    if (transfers[0].state === irc_xdcc_transfer_state_1.XdccTransferState.finished) {
                        return Promise.reject('transfer already finished');
                    }
                    return Promise.resolve(transfers[0]);
                }
                else if (!_this.options.acceptUnpooled) {
                    return Promise.reject('unintended transfer');
                }
                return _this.createTransfer({ botNick: xdccMessage.sender, packId: -1 });
            })
                .then(function (transfer) {
                var separator = path.sep.replace('\\\\', '\\');
                transfer.sender = xdccMessage.sender;
                transfer.target = xdccMessage.target;
                transfer.message = xdccMessage.message;
                transfer.params = xdccMessage.params;
                transfer.lastCommand = xdccMessage.params[1].toUpperCase();
                if (transfer.lastCommand === 'SEND') {
                    transfer.fileName = xdccMessage.params[2];
                    transfer.location = _this.options.destPath
                        + (_this.options.destPath.substr(-1, 1) === separator ? '' : separator)
                        + transfer.fileName;
                    transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.started;
                    transfer.ip = converter_1.converter.intToIp(xdccMessage.params[3]);
                    transfer.port = parseInt(xdccMessage.params[4], 10);
                    transfer.fileSize = parseInt(xdccMessage.params[5], 10);
                    return _this.validateTransferDestination(transfer);
                }
                else if (transfer.lastCommand === 'ACCEPT'
                    && transfer.fileName === xdccMessage.params[2]
                    && transfer.port === parseInt(xdccMessage.params[3], 10)
                    && transfer.resumePosition === parseInt(xdccMessage.params[4], 10)) {
                    return Promise.resolve(transfer);
                }
                else {
                    return Promise.reject("unknown/invalid command '" + transfer.lastCommand + "'");
                }
            })
                .then(_this.downloadFile.bind(_this))
                .catch(function (err) { return _this.emit(ircXdccEvents.xdccError, err); });
        }, 2000);
    };
    /**
     * Handles notice messages
     * @param {string} from notice emitter
     * @param {string} to notice recipient
     * @param {string} text notice content
     * @param {string} message raw notice message
     */
    XdccClient.prototype.noticeHandler = function (from, to, text, message) {
        var _this = this;
        var dccSendMessage = text.match(this.options.sendParser);
        var dccQueuedMessage = text.match(this.options.queuedParser);
        if (dccSendMessage || dccQueuedMessage) {
            var packId = dccSendMessage ? dccSendMessage[3] : dccQueuedMessage[1];
            var fileName_1 = dccSendMessage ? dccSendMessage[4] : dccQueuedMessage[2];
            var isQueued_1 = false;
            this.search({ botNick: from, packId: packId })
                .then(function (transfers) {
                // The should be only one...
                transfers.forEach(function (transfer) {
                    transfer.fileName = fileName_1;
                    if (isQueued_1) {
                        transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.queued;
                        _this.emit(ircXdccEvents.xdccQueued, transfer);
                    }
                });
            })
                .catch(function (err) { return _this.emit(ircXdccEvents.xdccError, err); });
        }
    };
    /**
     * Handles a disconnection
     * @param {string} nick disconnected nick
     * @param {string} reason disconnection reason
     * @param {string} channels emitting channels
     * @param {string} message raw disconnection message
     */
    XdccClient.prototype.disconnectedHandler = function (nick, reason, channels, message) {
        if (nick == this.nick) {
            this.isConnected = false;
        }
    };
    /**
     * Handles topic messages (auto join channels mentioned in topics)
     * @param {string} channel channel emitting the topic
     * @param {string} topic topic content
     * @param {string|null} nick topic's author
     * @param {string} message raw topic message
     */
    XdccClient.prototype.topicHandler = function (channel, topic, nick, message) {
        var _this = this;
        topic
            .split(' ')
            .filter(function (part) { return part[0] == '#'; })
            .forEach(function (chan) {
            _this.join(chan);
        });
    };
    /**
     * Resume pooled transfers
     */
    XdccClient.prototype.resume = function () {
        var _this = this;
        return this.search({ state: irc_xdcc_transfer_state_1.XdccTransferState.pending })
            .then(function (transfers) { return Promise.all(transfers.map(function (transfer) { return _this.start(transfer); })); });
    };
    /**
     * Cancels all transfers
     */
    XdccClient.prototype.clear = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.transferPool.forEach(function (transfer) { return _this.cancel(transfer); });
            return resolve();
        });
    };
    /**
     * Searches matching transfers
     * @param {XdccTransfer} xdccTransfer the transfer info to filter the pool with
     */
    XdccClient.prototype.search = function (needle) {
        return Promise.resolve(this.transferPool.filter(function (transfer) {
            var isMatch = true;
            Object.keys(needle).forEach(function (key) {
                if (needle.hasOwnProperty(key) && (!transfer.hasOwnProperty(key)
                    || transfer[key] !== needle[key])) {
                    isMatch = false;
                }
            });
            return isMatch;
        }));
    };
    /**
     * Creates a transfer instance based on the specified xdcc pack info
     * @param packInfo
     */
    XdccClient.prototype.createTransfer = function (packInfo) {
        var transfer = new irc_xdcc_transfer_1.XdccTransfer(packInfo);
        this.lastIndex++;
        transfer.transferId = this.lastIndex;
        this.transferPool.push(transfer);
        return Promise.resolve(transfer);
    };
    /**
     * Verifies if the destination file already exists and/or needs to be resume for the specified transfer
     * @param {XdccTransfer} transfer the transfer to verify
     */
    XdccClient.prototype.validateTransferDestination = function (transfer) {
        var _this = this;
        var partLocation = transfer.location + '.part';
        return fs_promise_1.statP(transfer.location)
            .then(function (stats) {
            if (stats.isFile() && stats.size === transfer.fileSize) {
                return Promise.reject('file with the same size already exists');
            }
            return fs_promise_1.statP(partLocation);
        })
            .catch(function (err) {
            return fs_promise_1.statP(partLocation);
        })
            .then(function (stats) {
            if (stats.isFile() && stats.size === transfer.fileSize) {
                return fs_promise_1.renameP(partLocation, transfer.location)
                    .then(function () { return Promise.reject('file with the same size already exists'); });
            }
            else if (!stats.size) {
                return Promise.resolve(transfer);
            }
            else if (_this.options.resume) {
                transfer.resumePosition = stats.size;
                _this.ctcp(transfer.botNick, 'privmsg', "DCC RESUME " + transfer.fileName + " " + transfer.port + " " + transfer.resumePosition);
                return Promise.reject('transfer should be resumed');
            }
            else {
                return fs_promise_1.unlinkP(partLocation)
                    .then(function () { return Promise.resolve(transfer); });
            }
        })
            .catch(function (err) {
            return Promise.resolve(transfer);
        });
    };
    /**
     * Downloads the file from the serving bot fro the specified transfer
     * @param {XdccTransfer} transfer the transfer to download
     */
    XdccClient.prototype.downloadFile = function (transfer) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.finished || transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.cancelled) {
                return reject('transfer aborted: transfer already finished or cancelled');
            }
            var partLocation = transfer.location + '.part';
            var writeStream = fs.createWriteStream(partLocation, { flags: 'a' });
            var sendBuffer = Buffer.alloc(4);
            var received = transfer.resumePosition || 0;
            var ack = transfer.resumePosition || 0;
            var socket;
            if (_this.options.closeConnectionOnDisconnect) {
                var disconnectedHandler = function (nick, reason, channels, message) {
                    if (nick === _this.nick) {
                        writeStream.end();
                        socket && socket.destroy();
                        transfer.error = 'transfer aborted: irc client disconnected';
                        return reject('transfer aborted: irc client disconnected');
                    }
                };
                _this.once('quit', disconnectedHandler);
                _this.once('kill', disconnectedHandler);
            }
            writeStream.on('open', function () {
                socket = net.createConnection(transfer.port, transfer.ip, function () {
                    transfer.progressIntervalId = setInterval(function () {
                        _this.emit(ircXdccEvents.xdccProgress, transfer, received);
                    }, _this.options.progressInterval * 1000);
                    transfer.startedAt = process.hrtime();
                    _this.emit(ircXdccEvents.xdccConnect, transfer);
                });
                socket.on('data', function (data) {
                    var totalReceived = received + data.length;
                    var progress = totalReceived - transfer.resumePosition;
                    var timeDelta = process.hrtime(transfer.startedAt);
                    var secondsDelta = (timeDelta[0] * 1e9 + timeDelta[1]) / 1e9;
                    var percents = totalReceived / transfer.fileSize * 100;
                    var speed = progress / secondsDelta;
                    received = totalReceived;
                    transfer.receivedBytes = received;
                    transfer.progress = percents;
                    transfer.speed = speed;
                    ack += data.length;
                    while (ack > 0xFFFFFFFF) {
                        ack -= 0xFFFFFFFF;
                    }
                    sendBuffer.writeUInt32BE(ack, 0);
                    socket.write(sendBuffer);
                    writeStream.write(data);
                });
                socket.on('end', function () {
                    var duration = transfer.startedAt ? process.hrtime(transfer.startedAt) : [0, 0];
                    var secondsDelta = (duration[0] * 1e9 + duration[1]) / 1e9;
                    var speed = transfer.fileSize / secondsDelta;
                    transfer.duration = duration;
                    transfer.speed = speed;
                    writeStream.end();
                    socket.destroy();
                    // Connection closed
                    if (received == transfer.fileSize) {
                        // download complete
                        fs_promise_1.renameP(transfer.location + '.part', transfer.location)
                            .then(function () {
                            transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.finished;
                            if (transfer.progressIntervalId) {
                                clearInterval(transfer.progressIntervalId);
                                transfer.progressIntervalId = null;
                            }
                            _this.emit(ircXdccEvents.xdccComplete, transfer);
                            resolve(transfer);
                        })
                            .catch(function (err) {
                            transfer.error = err;
                            reject(transfer);
                        });
                    }
                    else if (received != transfer.fileSize && transfer.state !== irc_xdcc_transfer_state_1.XdccTransferState.finished) {
                        // download incomplete
                        transfer.error = 'server unexpected closed connection';
                        _this.emit(ircXdccEvents.xdccDlError, transfer);
                        reject(transfer);
                    }
                    else if (received != transfer.fileSize && transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.finished) {
                        // download aborted
                        transfer.error = 'server closed connection, download canceled';
                        _this.emit(ircXdccEvents.xdccDlError, transfer);
                        reject(transfer);
                    }
                });
                socket.on('error', function (err) {
                    transfer.duration = transfer.startedAt ? process.hrtime(transfer.startedAt) : [0, 0];
                    // Close writeStream
                    writeStream.end();
                    transfer.error = err;
                    // Send error message
                    _this.emit(ircXdccEvents.xdccDlError, transfer);
                    // Destroy the connection
                    socket.destroy();
                    reject(transfer);
                });
                _this.emit(ircXdccEvents.xdccStarted, transfer);
            });
            writeStream.on('error', function (err) {
                writeStream.end();
                socket && socket.destroy();
                transfer.error = err;
                _this.emit(ircXdccEvents.xdccDlError, transfer);
                reject("write stream error: " + err.toString());
            });
        });
    };
    /**
     * Sends the start signal to the server bot for the specified transfer
     * @param {XdccTransfer} transfer the transfer to start
     */
    XdccClient.prototype.start = function (transfer) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var s = function () {
                _this[_this.options.method](transfer.botNick, _this.options.sendCommand + ' ' + transfer.packId);
                transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.requested;
                _this.emit(ircXdccEvents.xdccRequested, transfer);
                return resolve(transfer);
            };
            if (_this.isConnected) {
                s();
            }
            else {
                _this.once(ircXdccEvents.ircConnected, s);
            }
        });
    };
    /**
     * Sends the cancel signal to server bot for the specified transfer
     * @param {XdccTransfer} transfer teh transfer to cancel
     */
    XdccClient.prototype.cancel = function (transfer) {
        if (transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.cancelled || transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.finished) {
            return Promise.resolve(transfer);
        }
        if (transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.queued) {
            this[this.options.method](transfer.botNick || transfer.sender, this.options.cancelCommand);
        }
        else {
            this[this.options.method](transfer.botNick || transfer.sender, this.options.removeCommand + ' ' + transfer.packId);
        }
        transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.cancelled;
        if (transfer.progressIntervalId) {
            clearInterval(transfer.progressIntervalId);
            transfer.progressIntervalId = null;
        }
        this.emit(ircXdccEvents.xdccCanceled, transfer);
        return Promise.resolve(transfer);
    };
    return XdccClient;
}(irc_1.Client));
exports.XdccClient = XdccClient;
//# sourceMappingURL=irc-xdcc-2.js.map