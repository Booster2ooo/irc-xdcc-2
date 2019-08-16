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
var irc_xdcc_events_1 = require("./irc-xdcc-events");
var irc_xdcc_transfer_1 = require("./irc-xdcc-transfer");
var irc_xdcc_client_options_1 = require("./irc-xdcc-client-options");
var irc_xdcc_transfer_state_1 = require("./irc-xdcc-transfer-state");
var irc_xdcc_message_1 = require("./irc-xdcc-message");
var converter_1 = require("./converter");
var version_1 = require("./version");
var irc_xdcc_error_1 = require("./irc-xdcc-error");
/**
 * Class representing an irc client with XDCC capabilities.
 * @extends irc.Client
 */
var XdccClient = /** @class */ (function (_super) {
    __extends(XdccClient, _super);
    function XdccClient(opt) {
        var _this = this;
        var defaultOptions = new irc_xdcc_client_options_1.XdccClientOptions();
        var options = __assign({}, defaultOptions, opt);
        // create destination directory
        fs.mkdir(options.destPath, function () { });
        switch (options.method.toLowerCase()) {
            case 'say':
            case 'msg':
                options.method = 'say';
                break;
            case 'ctcp':
                options.method = 'ctcp';
                break;
            default:
                options.method = 'say';
                break;
        }
        _this = _super.call(this, options.server, options.nick, options) || this;
        _this.isConnected = false;
        _this.server = options.server;
        _this.options = options;
        _this.transferPool = [];
        _this.lastIndex = 0;
        _this.on(irc_xdcc_events_1.XdccEvents.ircRegistered, _this.registeredHandler)
            .on(irc_xdcc_events_1.XdccEvents.ircCtcpVersion, _this.versionHandler)
            .on(irc_xdcc_events_1.XdccEvents.ircCtcpPrivmsg, _this.privCtcpHandler)
            .on(irc_xdcc_events_1.XdccEvents.ircNotice, _this.noticeHandler)
            .on(irc_xdcc_events_1.XdccEvents.ircQuit, _this.disconnectedHandler)
            .on(irc_xdcc_events_1.XdccEvents.ircKill, _this.disconnectedHandler)
            .on(irc_xdcc_events_1.XdccEvents.ircError, _this.errorHandler);
        if (options.joinTopicChans) {
            _this.on(irc_xdcc_events_1.XdccEvents.ircTopic, _this.topicHandler);
        }
        return _this;
    }
    /**
     * Adds a transfer to the pool based on the provided xdcc pack info
     * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
     * @returns {Promise<XdccTransfer} A promise for the addedd XDCC transfer
     */
    XdccClient.prototype.addTransfer = function (packInfo) {
        var _this = this;
        if (!packInfo.botNick) {
            var error = new irc_xdcc_error_1.XdccError('addTransfer', 'botNick not provided', packInfo);
            this.emit(irc_xdcc_events_1.XdccEvents.xdccError, error);
            return Promise.reject(error);
        }
        if (!packInfo.packId) {
            var error = new irc_xdcc_error_1.XdccError('addTransfer', 'packId not provided', packInfo);
            this.emit(irc_xdcc_events_1.XdccEvents.xdccError, error);
            return Promise.reject(error);
        }
        packInfo.server = this.server;
        return this.search(packInfo)
            .then(function (transfers) {
            if (transfers.length) {
                return Promise.reject(new irc_xdcc_error_1.XdccError('addTransfer', "required pack already in pool with id '" + transfers[0].transferId + "'", packInfo));
            }
            return _this.createTransfer(packInfo);
        })
            .then(function (transfer) {
            _this.emit(irc_xdcc_events_1.XdccEvents.xdccCreated, transfer);
            return _this.start(transfer);
        })
            .catch(function (err) {
            if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                var xdccError = new irc_xdcc_error_1.XdccError('addTransfer', 'unhandled error', packInfo, err);
                _this.emit(irc_xdcc_events_1.XdccEvents.xdccError, xdccError);
                return Promise.reject(xdccError);
            }
            else {
                _this.emit(irc_xdcc_events_1.XdccEvents.xdccError, err);
                return Promise.reject(err);
            }
        });
    };
    /**
     * Cancels the provided transfer
     * @param {XdccTransfer} xdccTransfer transfer instance
     * @returns {Promise<XdccTransfer} A promise for the canceled XDCC transfer
     */
    XdccClient.prototype.cancelTransfer = function (xdccTransfer) {
        var _this = this;
        if (xdccTransfer.transferId) {
            return this.cancelTransferById(xdccTransfer.transferId);
        }
        return this.search(xdccTransfer)
            .then(function (transfers) {
            if (!transfers || !transfers.length) {
                return Promise.reject(new irc_xdcc_error_1.XdccError('cancelTransfer', "Unable to cancel the specified transfer, not found.", xdccTransfer));
            }
            return _this.cancelTransferById(transfers[0].transferId);
        });
    };
    /**
     * Cancels the transfer matching the provided xdcc pack info
     * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
     * @returns {Promise<XdccTransfer} A promise for the canceled XDCC transfer
     */
    XdccClient.prototype.cancelTransferByInfo = function (packInfo) {
        var _this = this;
        return this.search({ botNick: packInfo.botNick, packId: packInfo.packId })
            .then(function (transfers) {
            if (!transfers || !transfers.length) {
                return Promise.reject(new irc_xdcc_error_1.XdccError('cancelTransferByInfo', "Unable to cancel the specified transfer, not found.", packInfo));
            }
            return _this.cancelTransferById(transfers[0].transferId);
        });
    };
    /**
     * Cancels the transfer at the specified index in the transfer pool
     * @param {number} transferId transfer pool index
     * @returns {Promise<XdccTransfer} A promise for the canceled XDCC transfer
     */
    XdccClient.prototype.cancelTransferById = function (transferId) {
        var _this = this;
        return this.search({ transferId: transferId })
            .then(function (transfers) {
            if (!transfers || !transfers.length) {
                return Promise.reject(new irc_xdcc_error_1.XdccError('cancelTransferById', "Unable to remove cancel with id " + transferId + ", not found."));
            }
            _this.cancel(transfers[0]);
            return Promise.resolve(transfers[0]);
        });
    };
    /**
     * Returns the list of transfers
     * @returns {XdccTransfer} A promise for the list of transfers in the pool
     */
    XdccClient.prototype.listTransfers = function () {
        return Promise.resolve(this.transferPool);
    };
    /**
     * Removes the provided transfer instance from the list
     * @param {XdccTransfer} xdccTransfer The transfer instance
     * @returns {Promise<XdccTransfer} A promise for the removed XDCC transfer
     */
    XdccClient.prototype.removeTransfer = function (xdccTransfer) {
        var _this = this;
        if (xdccTransfer.transferId) {
            return this.removeTransferById(xdccTransfer.transferId);
        }
        return this.search(xdccTransfer)
            .then(function (transfers) {
            if (!transfers || !transfers.length) {
                return Promise.reject(new irc_xdcc_error_1.XdccError('removeTransfer', "Unable to remove the specified transfer, not found.", xdccTransfer));
            }
            return _this.removeTransferById(transfers[0].transferId);
        });
    };
    /**
     * Removes the transfer at the specified index in the transfer pool
     * @param {number} transferId The transfer pool index
     * @returns {Promise<XdccTransfer} A promise for the removed XDCC transfer
     */
    XdccClient.prototype.removeTransferById = function (transferId) {
        var _this = this;
        return this.cancelTransferById(transferId)
            .then(function (transfer) {
            var index = _this.transferPool.indexOf(transfer);
            _this.transferPool.splice(index, 1);
            _this.emit(irc_xdcc_events_1.XdccEvents.xdccRemoved, transfer);
            return Promise.resolve(transfer);
        });
    };
    /**
     * Disconnects the IRC client and clears the transfer pool
     * @param message The disconnection message
     * @param callback The function called after being disconnected
     */
    XdccClient.prototype.disconnect = function (message, callback) {
        var _this = this;
        message = message || version_1.version;
        this.emit(irc_xdcc_events_1.XdccEvents.ircQuit, this.nick, message, Object.keys(this.chans), null);
        this.clear()
            .catch(function (err) { return _this.emit(irc_xdcc_events_1.XdccEvents.ircError, err); })
            .then(function () { return irc_1.Client.prototype.disconnect.call(_this, message, callback); });
    };
    /**
     * Handles when the client is fully registered on the IRC network
     * @param {string} message The registration message
     */
    XdccClient.prototype.registeredHandler = function (message) {
        var _this = this;
        var channelRejoinedQueue = this.options.channels.map(function (chan) { return new Promise(function (resolve, reject) {
            _this.once(irc_xdcc_events_1.XdccEvents.ircJoin + chan.toLowerCase(), function (nick, message) {
                if (nick == _this.nick) {
                    resolve(chan);
                }
            });
        }); });
        Promise.all(channelRejoinedQueue)
            .then(function (channels) {
            _this.isConnected = true;
            _this.emit(irc_xdcc_events_1.XdccEvents.ircConnected, channels);
            /* Used .once instead of .on, no need to remove the listeners anymore
            this.options.channels.forEach((chan) => {
                this.removeAllListeners(XdccEvents.ircJoin+chan.toLowerCase());
            });*/
            return _this.resume();
        })
            .catch(function (err) {
            if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                var xdccError = new irc_xdcc_error_1.XdccError('registeredHandler', 'unhandled error', null, err, message);
                _this.emit(irc_xdcc_events_1.XdccEvents.xdccError, xdccError);
            }
            else {
                _this.emit(irc_xdcc_events_1.XdccEvents.xdccError, err);
            }
        });
    };
    /**
     * Handles CTCP Version messages
     * @param {string} from The CTCP emitter
     * @param {string} to The CTCP recipient
     * @param {string} message The raw CTCP message
     */
    XdccClient.prototype.versionHandler = function (from, to, message) {
        this.ctcp(from, 'normal', 'VERSION ' + version_1.version);
    };
    /**
     * Handles CTCP PrivMsg messages
     * @param {string} from The CTCP emitter
     * @param {string} to The CTCP recipient
     * @param {string} text The CTCP content
     * @param {string} message The raw CTCP message
     */
    XdccClient.prototype.privCtcpHandler = function (from, to, text, message) {
        var _this = this;
        if (to !== this.nick
            || !text
            || text.substr(0, 4) !== 'DCC ') {
            this.emit(irc_xdcc_events_1.XdccEvents.xdccError, new irc_xdcc_error_1.XdccError('privCtcpHandler', 'not a DCC message', null, null, message));
            return;
        }
        var parsedMessage = text.match(this.options.dccParser);
        if (!parsedMessage || !parsedMessage.length) {
            this.emit(irc_xdcc_events_1.XdccEvents.xdccError, new irc_xdcc_error_1.XdccError('privCtcpHandler', 'unable to parse DCC message', null, null, message));
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
                    if (transfers[0].state === irc_xdcc_transfer_state_1.XdccTransferState.completed) {
                        return Promise.reject(new irc_xdcc_error_1.XdccError('privCtcpHandler', 'transfer already completed', transfers[0], null, xdccMessage));
                    }
                    return Promise.resolve(transfers[0]);
                }
                else if (!_this.options.acceptUnpooled) {
                    return Promise.reject(new irc_xdcc_error_1.XdccError('privCtcpHandler', 'unintended transfer', null, null, xdccMessage));
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
                    return Promise.reject(new irc_xdcc_error_1.XdccError('privCtcpHandler', "unknown/invalid command '" + transfer.lastCommand + "'", transfer, null, xdccMessage));
                }
            })
                .then(_this.downloadFile.bind(_this))
                .catch(function (err) {
                if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                    var xdccError = new irc_xdcc_error_1.XdccError('privCtcpHandler', 'unhandled error', null, err, message);
                    _this.emit(irc_xdcc_events_1.XdccEvents.xdccError, xdccError);
                }
                else {
                    _this.emit(irc_xdcc_events_1.XdccEvents.xdccError, err);
                }
            });
        }, 2000);
    };
    /**
     * Handles notice messages
     * @param {string} from The notice emitter
     * @param {string} to The notice recipient
     * @param {string} text The notice content
     * @param {string} message The raw notice message
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
                        _this.emit(irc_xdcc_events_1.XdccEvents.xdccQueued, transfer);
                    }
                });
            })
                .catch(function (err) {
                if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                    var xdccError = new irc_xdcc_error_1.XdccError('noticeHandler', 'unhandled error', null, err, message);
                    _this.emit(irc_xdcc_events_1.XdccEvents.xdccError, xdccError);
                }
                else {
                    _this.emit(irc_xdcc_events_1.XdccEvents.xdccError, err);
                }
            });
        }
    };
    /**
     * Handles a disconnection
     * @param {string} nick The disconnected nick
     * @param {string} reason The disconnection reason
     * @param {string} channels The emitting channels
     * @param {string} message The raw disconnection message
     */
    XdccClient.prototype.disconnectedHandler = function (nick, reason, channels, message) {
        if (nick == this.nick) {
            this.isConnected = false;
        }
    };
    /**
     * Handles topic messages (auto join channels mentioned in topics)
     * @param {string} channel The channel emitting the topic
     * @param {string} topic The topic content
     * @param {string|null} nick The topic's author
     * @param {string} message The raw topic message
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
     * Handles error messages
     * @param {string} message The raw error message
     */
    XdccClient.prototype.errorHandler = function (message) {
        var _this = this;
        if (message.command === 'err_bannedfromchan') {
            this.search({ channel: message.args[1] })
                .then(function (transfers) {
                transfers.forEach(function (transfer) {
                    transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.canceled;
                    transfer.error = message;
                    _this.emit(irc_xdcc_events_1.XdccEvents.xdccCanceled, transfer);
                });
            })
                .catch(function (err) {
                if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                    var xdccError = new irc_xdcc_error_1.XdccError('errorHandler', 'unhandled error', null, err, message);
                    _this.emit(irc_xdcc_events_1.XdccEvents.xdccError, xdccError);
                }
                else {
                    _this.emit(irc_xdcc_events_1.XdccEvents.xdccError, err);
                }
            });
        }
    };
    /**
     * Resume pooled transfers
     * @returns {XdccTransfer} The resumed XDCC transfers
     */
    XdccClient.prototype.resume = function () {
        var _this = this;
        return Promise.all(this.transferPool.map(function (transfer) { return _this.start(transfer); }));
    };
    /**
     * Cancels all transfers and clears the pool
     * @returns {Promise<void>} An empty promise
     */
    XdccClient.prototype.clear = function () {
        var _this = this;
        return Promise.all(this.transferPool.map(function (transfer) { return _this.removeTransferById(transfer.transferId); }));
    };
    /**
     * Searches matching transfers
     * @param {XdccTransfer} xdccTransfer The transfer info to filter the pool with
     * @returns {Promise<XdccTransfer[]>} A promise for matching XDCC transfers
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
     * @returns {Promise<XdccTransfer[]>} The created XDCC transfers
     */
    XdccClient.prototype.createTransfer = function (packInfo) {
        var transfer = new irc_xdcc_transfer_1.XdccTransfer(packInfo);
        transfer.server = this.server;
        this.lastIndex++;
        transfer.transferId = this.lastIndex;
        this.transferPool.push(transfer);
        return Promise.resolve(transfer);
    };
    /**
     * Verifies if the destination file already exists and/or needs to be resume for the specified transfer
     * @param {XdccTransfer} transfer The transfer to verify
     * @returns {Promise<XdccTransfer[]>} The inputed XDCC transfers
     */
    XdccClient.prototype.validateTransferDestination = function (transfer) {
        var _this = this;
        var partLocation = transfer.location + '.part';
        return fs_promise_1.statP(transfer.location)
            .catch(function (err) {
            return Promise.resolve(new fs.Stats());
        })
            .then(function (stats) {
            if (stats.isFile() && stats.size === transfer.fileSize) {
                transfer.error = 'file with the same size already exists';
                transfer.progress = 100;
                _this.cancel(transfer);
                return Promise.reject(new irc_xdcc_error_1.XdccError('validateTransferDestination', transfer.error, transfer));
            }
            return fs_promise_1.statP(partLocation)
                .catch(function (err) {
                return Promise.resolve(new fs.Stats());
            });
        })
            .then(function (stats) {
            if (stats.isFile() && stats.size === transfer.fileSize) {
                return fs_promise_1.renameP(partLocation, transfer.location)
                    .then(function () {
                    transfer.error = 'file with the same size already exists';
                    transfer.progress = 100;
                    _this.cancel(transfer);
                    return Promise.reject(new irc_xdcc_error_1.XdccError('validateTransferDestination', transfer.error, transfer));
                });
            }
            else if (!stats.size) {
                return Promise.resolve(transfer);
            }
            else if (_this.options.resume) {
                transfer.resumePosition = stats.size;
                _this.ctcp(transfer.botNick, 'privmsg', "DCC RESUME " + transfer.fileName + " " + transfer.port + " " + transfer.resumePosition);
                return Promise.reject(new irc_xdcc_error_1.XdccError('validateTransferDestination', 'transfer should be resumed', transfer));
            }
            else {
                return fs_promise_1.unlinkP(partLocation)
                    .then(function () { return Promise.resolve(transfer); });
            }
        });
    };
    /**
     * Downloads the file from the serving bot fro the specified transfer
     * @param {XdccTransfer} transfer The transfer to download
     * @returns {Promise<XdccTransfer[]>} The inputed XDCC transfers
     */
    XdccClient.prototype.downloadFile = function (transfer) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.completed || transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.canceled) {
                return reject(new irc_xdcc_error_1.XdccError('downloadFile', 'transfer aborted: transfer already completed or canceled', transfer));
            }
            var partLocation = transfer.location + '.part';
            var writeStream = fs.createWriteStream(partLocation, { flags: 'a' });
            var sendBuffer = Buffer.alloc(4);
            var received = transfer.resumePosition || 0;
            var ack = transfer.resumePosition || 0;
            var socket;
            var internalDisconnectedHandler = function (nick, reason, channels, message) {
                if (nick === _this.nick) {
                    writeStream.end();
                    socket && socket.destroy();
                    transfer.error = 'transfer aborted: irc client disconnected';
                    return reject(new irc_xdcc_error_1.XdccError('downloadFile', transfer.error, transfer));
                }
            };
            if (_this.options.closeConnectionOnCompleted) {
                _this.once(irc_xdcc_events_1.XdccEvents.ircQuit, internalDisconnectedHandler);
                _this.once(irc_xdcc_events_1.XdccEvents.ircKill, internalDisconnectedHandler);
            }
            writeStream.on('open', function () {
                socket = net.createConnection(transfer.port, transfer.ip, function () {
                    transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.started;
                    _this.emit(irc_xdcc_events_1.XdccEvents.xdccStarted, transfer);
                    transfer.progressIntervalId = setInterval(function () {
                        _this.emit(irc_xdcc_events_1.XdccEvents.xdccProgressed, transfer, received);
                    }, _this.options.progressInterval * 1000);
                    transfer.startedAt = process.hrtime();
                    _this.emit(irc_xdcc_events_1.XdccEvents.xdccConnected, transfer);
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
                var socketEndHandler = function (socketError) {
                    var duration = transfer.startedAt ? process.hrtime(transfer.startedAt) : [0, 0];
                    var secondsDelta = (duration[0] * 1e9 + duration[1]) / 1e9;
                    var speed = transfer.fileSize / secondsDelta;
                    transfer.duration = duration;
                    transfer.speed = speed;
                    writeStream.end();
                    socket.destroy();
                    if (transfer.progressIntervalId) {
                        clearInterval(transfer.progressIntervalId);
                        transfer.progressIntervalId = null;
                    }
                    if (_this.options.closeConnectionOnCompleted) {
                        if (_this.rawListeners(irc_xdcc_events_1.XdccEvents.ircQuit).indexOf(internalDisconnectedHandler) > -1) {
                            _this.removeListener(irc_xdcc_events_1.XdccEvents.ircQuit, internalDisconnectedHandler);
                        }
                        if (_this.rawListeners(irc_xdcc_events_1.XdccEvents.ircKill).indexOf(internalDisconnectedHandler) > -1) {
                            _this.removeListener(irc_xdcc_events_1.XdccEvents.ircKill, internalDisconnectedHandler);
                        }
                    }
                    // Connection closed
                    if (received == transfer.fileSize) {
                        // download completed
                        fs_promise_1.renameP(transfer.location + '.part', transfer.location)
                            .then(function () {
                            transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.completed;
                            _this.emit(irc_xdcc_events_1.XdccEvents.xdccCompleted, transfer);
                            resolve(transfer);
                        })
                            .catch(function (err) {
                            transfer.error = err;
                            reject(transfer);
                        });
                    }
                    else if (received != transfer.fileSize && transfer.state !== irc_xdcc_transfer_state_1.XdccTransferState.completed) {
                        // download incomplete
                        transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.canceled; // create a "failed" status?
                        if (!socketError) {
                            transfer.error = 'server unexpected closed connection';
                        }
                        else {
                            transfer.error = socketError;
                        }
                        var xdccError = new irc_xdcc_error_1.XdccError('downloadFile', transfer.error, transfer);
                        _this.emit(irc_xdcc_events_1.XdccEvents.xdccDlError, xdccError);
                        reject(xdccError);
                    }
                    else if (received != transfer.fileSize && transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.completed) {
                        // download aborted
                        transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.canceled; // create a "failed" status?
                        if (!socketError) {
                            transfer.error = 'server closed connection, download canceled';
                        }
                        else {
                            transfer.error = socketError;
                        }
                        var xdccError = new irc_xdcc_error_1.XdccError('downloadFile', transfer.error, transfer);
                        _this.emit(irc_xdcc_events_1.XdccEvents.xdccDlError, xdccError);
                        reject(xdccError);
                    }
                };
                socket.on('end', socketEndHandler);
                socket.on('error', socketEndHandler);
            });
            writeStream.on('error', function (err) {
                writeStream.end();
                socket && socket.destroy();
                transfer.error = "write stream error: " + err.toString();
                var xdccError = new irc_xdcc_error_1.XdccError('downloadFile', transfer.error, transfer, err);
                _this.emit(irc_xdcc_events_1.XdccEvents.xdccDlError, xdccError);
                reject(xdccError);
            });
        });
    };
    /**
     * Joins the channel assigned to the transfer if required
     * @param transfer The transfer to join the channel for
     * @returns {Promise<XdccTransfer[]>} A promise for the transfer the channel has been joined for
     */
    XdccClient.prototype.joinTransferChannel = function (transfer) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!transfer.channel) {
                return resolve(transfer);
            }
            if (Object.keys(_this.chans).map(function (chan) { return chan.toLowerCase(); }).indexOf(transfer.channel.toLowerCase()) > -1) {
                return resolve(transfer);
            }
            var internalJoinHandler = function (nick, message) {
                _this.removeListener(irc_xdcc_events_1.XdccEvents.ircError, interalErrorHandler);
                resolve(transfer);
            };
            var interalErrorHandler = function (message) {
                if (message.command == 'err_bannedfromchan' && message.args[1].toLowerCase() === transfer.channel.toLowerCase()) {
                    _this.removeListener(irc_xdcc_events_1.XdccEvents.ircJoin + transfer.channel, internalJoinHandler);
                    _this.removeListener(irc_xdcc_events_1.XdccEvents.ircError, interalErrorHandler);
                    transfer.error = 'banned from channel';
                    var xdccError = new irc_xdcc_error_1.XdccError('joinTransferChannel', transfer.error, transfer, null, message);
                    reject(xdccError);
                }
            };
            _this.once(irc_xdcc_events_1.XdccEvents.ircJoin + transfer.channel, internalJoinHandler);
            _this.on(irc_xdcc_events_1.XdccEvents.ircError, interalErrorHandler);
            _this.join(transfer.channel);
        });
    };
    /**
     * Sends the start signal to the server bot for the specified transfer
     * @param {XdccTransfer} transfer The transfer to start
     * @returns {Promise<XdccTransfer[]>} A promise for the started XDCC transfers
     */
    XdccClient.prototype.start = function (transfer) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var s = function () {
                _this.joinTransferChannel(transfer)
                    .then(function () {
                    _this[_this.options.method](transfer.botNick, _this.options.sendCommand + ' ' + transfer.packId);
                    transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.requested;
                    _this.emit(irc_xdcc_events_1.XdccEvents.xdccRequested, transfer);
                    return resolve(transfer);
                })
                    .catch(function (err) {
                    if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                        var xdccError = new irc_xdcc_error_1.XdccError('start', 'unhandled error', transfer, err);
                        //this.emit(XdccEvents.xdccError, xdccError);
                        return reject(xdccError);
                    }
                    else {
                        //this.emit(XdccEvents.xdccError, err);
                        return reject(err);
                    }
                });
            };
            if (_this.isConnected) {
                s();
            }
            // if not connected, start will be called again by resume(). Not need to intercept connection even
            //else {
            //this.once(XdccEvents.ircConnected, s);
            //}
        });
    };
    /**
     * Sends the cancel signal to server bot for the specified transfer
     * @param {XdccTransfer} transfer The transfer to cancel
     * @returns {Promise<XdccTransfer[]>} A promise for the canceled XDCC transfers
     */
    XdccClient.prototype.cancel = function (transfer) {
        if (transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.canceled || transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.completed) {
            return Promise.resolve(transfer);
        }
        if (transfer.state !== irc_xdcc_transfer_state_1.XdccTransferState.queued) {
            this[this.options.method](transfer.botNick || transfer.sender, this.options.cancelCommand);
        }
        else {
            this[this.options.method](transfer.botNick || transfer.sender, this.options.removeCommand + ' ' + transfer.packId);
        }
        transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.canceled;
        if (transfer.progressIntervalId) {
            clearInterval(transfer.progressIntervalId);
            transfer.progressIntervalId = null;
        }
        this.emit(irc_xdcc_events_1.XdccEvents.xdccCanceled, transfer);
        return Promise.resolve(transfer);
    };
    return XdccClient;
}(irc_1.Client));
exports.XdccClient = XdccClient;
//# sourceMappingURL=irc-xdcc-2.js.map