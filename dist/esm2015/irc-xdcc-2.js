"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const net = __importStar(require("net"));
const irc_1 = require("irc");
const fs_promise_1 = require("./fs-promise");
//import { promises as fsp } from 'fs'; // experimental ...
const irc_xdcc_events_1 = require("./irc-xdcc-events");
const irc_xdcc_transfer_1 = require("./irc-xdcc-transfer");
const irc_xdcc_client_options_1 = require("./irc-xdcc-client-options");
const irc_xdcc_transfer_state_1 = require("./irc-xdcc-transfer-state");
const irc_xdcc_message_1 = require("./irc-xdcc-message");
const converter_1 = require("./converter");
const version_1 = require("./version");
const irc_xdcc_error_1 = require("./irc-xdcc-error");
/**
 * Class representing an irc client with XDCC capabilities.
 * @extends irc.Client
 */
class XdccClient extends irc_1.Client {
    constructor(opt) {
        const defaultOptions = new irc_xdcc_client_options_1.XdccClientOptions();
        const options = { ...defaultOptions, ...opt };
        // create destination directory
        fs.mkdir(options.destPath, () => { });
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
        super(options.server, options.nick, options);
        this.isConnected = false;
        this.server = options.server;
        this.options = options;
        this.transferPool = [];
        this.lastIndex = 0;
        this.on(irc_xdcc_events_1.XdccEvents.ircRegistered, this.registeredHandler)
            .on(irc_xdcc_events_1.XdccEvents.ircCtcpVersion, this.versionHandler)
            .on(irc_xdcc_events_1.XdccEvents.ircCtcpPrivmsg, this.privCtcpHandler)
            .on(irc_xdcc_events_1.XdccEvents.ircNotice, this.noticeHandler)
            .on(irc_xdcc_events_1.XdccEvents.ircQuit, this.disconnectedHandler)
            .on(irc_xdcc_events_1.XdccEvents.ircKill, this.disconnectedHandler)
            .on(irc_xdcc_events_1.XdccEvents.ircError, this.errorHandler);
        if (options.joinTopicChans) {
            this.on(irc_xdcc_events_1.XdccEvents.ircTopic, this.topicHandler);
        }
    }
    /**
     * Adds a transfer to the pool based on the provided xdcc pack info
     * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
     * @returns {Promise<XdccTransfer} A promise for the addedd XDCC transfer
     */
    addTransfer(packInfo) {
        if (!packInfo.botNick) {
            const error = new irc_xdcc_error_1.XdccError('addTransfer', 'botNick not provided', packInfo);
            this.emit(irc_xdcc_events_1.XdccEvents.xdccError, error);
            return Promise.reject(error);
        }
        if (!packInfo.packId) {
            const error = new irc_xdcc_error_1.XdccError('addTransfer', 'packId not provided', packInfo);
            this.emit(irc_xdcc_events_1.XdccEvents.xdccError, error);
            return Promise.reject(error);
        }
        packInfo.server = this.server;
        return this.search(packInfo)
            .then((transfers) => {
            if (transfers.length) {
                return Promise.reject(new irc_xdcc_error_1.XdccError('addTransfer', `required pack already in pool with id '${transfers[0].transferId}'`, packInfo));
            }
            return this.createTransfer(packInfo);
        })
            .then((transfer) => {
            return this.start(transfer);
        })
            .catch((err) => {
            if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                const xdccError = new irc_xdcc_error_1.XdccError('addTransfer', 'unhandled error', packInfo, err);
                this.emit(irc_xdcc_events_1.XdccEvents.xdccError, xdccError);
                return Promise.reject(xdccError);
            }
            else {
                this.emit(irc_xdcc_events_1.XdccEvents.xdccError, err);
                return Promise.reject(err);
            }
        });
    }
    /**
     * Cancels the provided transfer
     * @param {XdccTransfer} xdccTransfer transfer instance
     * @returns {Promise<XdccTransfer} A promise for the canceled XDCC transfer
     */
    cancelTransfer(xdccTransfer) {
        if (xdccTransfer.transferId) {
            return this.cancelTransferById(xdccTransfer.transferId);
        }
        return this.search(xdccTransfer)
            .then((transfers) => {
            if (!transfers || !transfers.length) {
                return Promise.reject(new irc_xdcc_error_1.XdccError('cancelTransfer', `Unable to cancel the specified transfer, not found.`, xdccTransfer));
            }
            return this.cancelTransferById(transfers[0].transferId);
        });
    }
    /**
     * Cancels the transfer matching the provided xdcc pack info
     * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
     * @returns {Promise<XdccTransfer} A promise for the canceled XDCC transfer
     */
    cancelTransferByInfo(packInfo) {
        return this.search({ botNick: packInfo.botNick, packId: packInfo.packId })
            .then((transfers) => {
            if (!transfers || !transfers.length) {
                return Promise.reject(new irc_xdcc_error_1.XdccError('cancelTransferByInfo', `Unable to cancel the specified transfer, not found.`, packInfo));
            }
            return this.cancelTransferById(transfers[0].transferId);
        });
    }
    /**
     * Cancels the transfer at the specified index in the transfer pool
     * @param {number} transferId transfer pool index
     * @returns {Promise<XdccTransfer} A promise for the canceled XDCC transfer
     */
    cancelTransferById(transferId) {
        return this.search({ transferId })
            .then((transfers) => {
            if (!transfers || !transfers.length) {
                return Promise.reject(new irc_xdcc_error_1.XdccError('cancelTransferById', `Unable to remove cancel with id ${transferId}, not found.`));
            }
            this.cancel(transfers[0]);
            return Promise.resolve(transfers[0]);
        });
    }
    /**
     * Returns the list of transfers
     * @returns {XdccTransfer} A promise for the list of transfers in the pool
     */
    listTransfers() {
        return Promise.resolve(this.transferPool);
    }
    /**
     * Removes the provided transfer instance from the list
     * @param {XdccTransfer} xdccTransfer The transfer instance
     * @returns {Promise<XdccTransfer} A promise for the removed XDCC transfer
     */
    removeTransfer(xdccTransfer) {
        if (xdccTransfer.transferId) {
            return this.removeTransferById(xdccTransfer.transferId);
        }
        return this.search(xdccTransfer)
            .then((transfers) => {
            if (!transfers || !transfers.length) {
                return Promise.reject(new irc_xdcc_error_1.XdccError('removeTransfer', `Unable to remove the specified transfer, not found.`, xdccTransfer));
            }
            return this.removeTransferById(transfers[0].transferId);
        });
    }
    /**
     * Removes the transfer at the specified index in the transfer pool
     * @param {number} transferId The transfer pool index
     * @returns {Promise<XdccTransfer} A promise for the removed XDCC transfer
     */
    removeTransferById(transferId) {
        return this.cancelTransferById(transferId)
            .then((transfer) => {
            const index = this.transferPool.indexOf(transfer);
            this.transferPool.splice(index, 1);
            this.emit(irc_xdcc_events_1.XdccEvents.xdccRemoved, transfer);
            return Promise.resolve(transfer);
        });
    }
    /**
     * Disconnects the IRC client and clears the transfer pool
     * @param message The disconnection message
     * @param callback The function called after being disconnected
     */
    disconnect(message, callback) {
        message = message || version_1.version;
        const disconnectCallback = () => {
            this.isConnected = false;
            if (callback) {
                callback();
            }
        };
        this.clear()
            .catch((err) => this.emit(irc_xdcc_events_1.XdccEvents.ircError, err))
            .then(() => irc_1.Client.prototype.disconnect.call(this, message, disconnectCallback));
    }
    /**
     * Handles when the client is fully registered on the IRC network
     * @param {string} message The registration message
     */
    registeredHandler(message) {
        const channelRejoinedQueue = this.options.channels.map((chan) => new Promise((resolve, reject) => {
            this.once(irc_xdcc_events_1.XdccEvents.ircJoin + chan.toLowerCase(), (nick, message) => {
                if (nick == this.nick) {
                    resolve(chan);
                }
            });
        }));
        Promise.all(channelRejoinedQueue)
            .then((channels) => {
            this.isConnected = true;
            this.emit(irc_xdcc_events_1.XdccEvents.ircConnected, channels);
            /* Used .once instead of .on, no need to remove the listeners anymore
            this.options.channels.forEach((chan) => {
                this.removeAllListeners(XdccEvents.ircJoin+chan.toLowerCase());
            });*/
            return this.restart();
        })
            .catch((err) => {
            if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                const xdccError = new irc_xdcc_error_1.XdccError('registeredHandler', 'unhandled error', null, err, message);
                this.emit(irc_xdcc_events_1.XdccEvents.xdccError, xdccError);
            }
            else {
                this.emit(irc_xdcc_events_1.XdccEvents.xdccError, err);
            }
        });
    }
    /**
     * Handles CTCP Version messages
     * @param {string} from The CTCP emitter
     * @param {string} to The CTCP recipient
     * @param {string} message The raw CTCP message
     */
    versionHandler(from, to, message) {
        this.ctcp(from, 'normal', 'VERSION ' + version_1.version);
    }
    /**
     * Handles CTCP PrivMsg messages
     * @param {string} from The CTCP emitter
     * @param {string} to The CTCP recipient
     * @param {string} text The CTCP content
     * @param {string} message The raw CTCP message
     */
    privCtcpHandler(from, to, text, message) {
        if (to !== this.nick
            || !text
            || text.substr(0, 4) !== 'DCC ') {
            this.emit(irc_xdcc_events_1.XdccEvents.xdccError, new irc_xdcc_error_1.XdccError('privCtcpHandler', 'not a DCC message', null, null, message));
            return;
        }
        const parsedMessage = text.match(this.options.dccParser);
        if (!parsedMessage || !parsedMessage.length) {
            this.emit(irc_xdcc_events_1.XdccEvents.xdccError, new irc_xdcc_error_1.XdccError('privCtcpHandler', 'unable to parse DCC message', null, null, message));
            return;
        }
        const xdccMessage = new irc_xdcc_message_1.XdccMessage();
        xdccMessage.sender = from;
        xdccMessage.target = to;
        xdccMessage.message = text;
        xdccMessage.params = parsedMessage;
        // Delay handling so the notice with filename can be parsed... (?)
        setTimeout(() => this.search({
            botNick: xdccMessage.sender,
            fileName: xdccMessage.params[2]
        })
            .then((transfers) => {
            if (transfers.length) {
                if (transfers[0].state === irc_xdcc_transfer_state_1.XdccTransferState.completed) {
                    return Promise.reject(new irc_xdcc_error_1.XdccError('privCtcpHandler', 'transfer already completed', transfers[0], null, xdccMessage));
                }
                return Promise.resolve(transfers[0]);
            }
            else if (!this.options.acceptUnpooled) {
                return Promise.reject(new irc_xdcc_error_1.XdccError('privCtcpHandler', 'unintended transfer', null, null, xdccMessage));
            }
            return this.createTransfer({ botNick: xdccMessage.sender, packId: -1 });
        })
            .then((transfer) => {
            const separator = path.sep.replace('\\\\', '\\');
            transfer.sender = xdccMessage.sender;
            transfer.target = xdccMessage.target;
            transfer.message = xdccMessage.message;
            transfer.params = xdccMessage.params;
            transfer.lastCommand = xdccMessage.params[1].toUpperCase();
            if (transfer.lastCommand === 'SEND') {
                transfer.fileName = xdccMessage.params[2];
                transfer.location = this.options.destPath
                    + (this.options.destPath.substr(-1, 1) === separator ? '' : separator)
                    + transfer.fileName;
                transfer.ip = converter_1.converter.intToIp(xdccMessage.params[3]);
                transfer.port = parseInt(xdccMessage.params[4], 10);
                transfer.fileSize = parseInt(xdccMessage.params[5], 10);
                return this.validateTransferDestination(transfer);
            }
            else if (transfer.lastCommand === 'ACCEPT'
                && transfer.fileName === xdccMessage.params[2]
                && transfer.port === parseInt(xdccMessage.params[3], 10)
                && transfer.resumePosition === parseInt(xdccMessage.params[4], 10)) {
                return Promise.resolve(transfer);
            }
            else {
                return Promise.reject(new irc_xdcc_error_1.XdccError('privCtcpHandler', `unknown/invalid command '${transfer.lastCommand}'`, transfer, null, xdccMessage));
            }
        })
            .then(this.downloadFile.bind(this))
            .catch((err) => {
            if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                const xdccError = new irc_xdcc_error_1.XdccError('privCtcpHandler', 'unhandled error', null, err, message);
                this.emit(irc_xdcc_events_1.XdccEvents.xdccError, xdccError);
            }
            else {
                this.emit(irc_xdcc_events_1.XdccEvents.xdccError, err);
            }
        }), 2000);
    }
    /**
     * Handles notice messages
     * @param {string} from The notice emitter
     * @param {string} to The notice recipient
     * @param {string} text The notice content
     * @param {string} message The raw notice message
     */
    noticeHandler(from, to, text, message) {
        const dccSendMessage = text.match(this.options.sendParser);
        const dccQueuedMessage = text.match(this.options.queuedParser);
        if (dccSendMessage || dccQueuedMessage) {
            let packId = dccSendMessage ? dccSendMessage[3] : dccQueuedMessage[1];
            let fileName = dccSendMessage ? dccSendMessage[4] : dccQueuedMessage[2];
            let isQueued = false;
            this.search({ botNick: from, packId })
                .then((transfers) => {
                // The should be only one...
                transfers.forEach(transfer => {
                    transfer.fileName = fileName;
                    if (isQueued) {
                        transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.queued;
                        this.emit(irc_xdcc_events_1.XdccEvents.xdccQueued, transfer);
                    }
                });
            })
                .catch((err) => {
                if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                    const xdccError = new irc_xdcc_error_1.XdccError('noticeHandler', 'unhandled error', null, err, message);
                    this.emit(irc_xdcc_events_1.XdccEvents.xdccError, xdccError);
                }
                else {
                    this.emit(irc_xdcc_events_1.XdccEvents.xdccError, err);
                }
            });
        }
    }
    /**
     * Handles a disconnection
     * @param {string} nick The disconnected nick
     * @param {string} reason The disconnection reason
     * @param {string} channels The emitting channels
     * @param {string} message The raw disconnection message
     */
    disconnectedHandler(nick, reason, channels, message) {
        if (nick == this.nick) {
            this.isConnected = false;
        }
    }
    /**
     * Handles topic messages (auto join channels mentioned in topics)
     * @param {string} channel The channel emitting the topic
     * @param {string} topic The topic content
     * @param {string|null} nick The topic's author
     * @param {string} message The raw topic message
     */
    topicHandler(channel, topic, nick, message) {
        topic
            .split(' ')
            .filter((part) => part[0] == '#')
            .forEach((chan) => {
            this.join(chan);
        });
    }
    /**
     * Handles error messages
     * @param {string} message The raw error message
     */
    errorHandler(message) {
        if (message.command === 'err_bannedfromchan') {
            this.search({ channel: message.args[1] })
                .then((transfers) => {
                transfers.forEach(transfer => {
                    transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.canceled;
                    transfer.error = message;
                    this.emit(irc_xdcc_events_1.XdccEvents.xdccCanceled, transfer);
                });
            })
                .catch((err) => {
                if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                    const xdccError = new irc_xdcc_error_1.XdccError('errorHandler', 'unhandled error', null, err, message);
                    this.emit(irc_xdcc_events_1.XdccEvents.xdccError, xdccError);
                }
                else {
                    this.emit(irc_xdcc_events_1.XdccEvents.xdccError, err);
                }
            });
        }
        else if (message.command === 'err_nosuchnick') {
            this.search({ botNick: message.args[1] })
                .then((transfers) => {
                transfers.forEach(transfer => {
                    transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.canceled;
                    transfer.error = message;
                    this.emit(irc_xdcc_events_1.XdccEvents.xdccCanceled, transfer);
                });
            })
                .catch((err) => {
                if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                    const xdccError = new irc_xdcc_error_1.XdccError('errorHandler', 'unhandled error', null, err, message);
                    this.emit(irc_xdcc_events_1.XdccEvents.xdccError, xdccError);
                }
                else {
                    this.emit(irc_xdcc_events_1.XdccEvents.xdccError, err);
                }
            });
        }
    }
    /**
     * Restarts pooled transfers
     * @returns {XdccTransfer} The restarted XDCC transfers
     */
    restart() {
        return Promise.all(this.transferPool.map(transfer => this.start(transfer)));
    }
    /**
     * Cancels all transfers and clears the pool
     * @returns {Promise<void>} An empty promise
     */
    clear() {
        return Promise.all(this.transferPool.map((transfer) => this.removeTransferById(transfer.transferId)));
    }
    /**
     * Searches matching transfers
     * @param {XdccTransfer} xdccTransfer The transfer info to filter the pool with
     * @returns {Promise<XdccTransfer[]>} A promise for matching XDCC transfers
     */
    search(needle) {
        return Promise.resolve(this.transferPool.filter((transfer) => {
            let isMatch = true;
            Object.keys(needle).forEach(key => {
                if (needle.hasOwnProperty(key) && (!transfer.hasOwnProperty(key)
                    || transfer[key] !== needle[key])) {
                    isMatch = false;
                }
            });
            return isMatch;
        }));
    }
    /**
     * Creates a transfer instance based on the specified xdcc pack info
     * @param packInfo
     * @returns {Promise<XdccTransfer[]>} The created XDCC transfers
     */
    createTransfer(packInfo) {
        const transfer = new irc_xdcc_transfer_1.XdccTransfer(packInfo);
        transfer.server = this.server;
        this.lastIndex++;
        transfer.transferId = this.lastIndex;
        this.transferPool.push(transfer);
        this.emit(irc_xdcc_events_1.XdccEvents.xdccCreated, transfer);
        return Promise.resolve(transfer);
    }
    /**
     * Verifies if the destination file already exists and/or needs to be resume for the specified transfer
     * @param {XdccTransfer} transfer The transfer to verify
     * @returns {Promise<XdccTransfer[]>} The inputed XDCC transfers
     */
    validateTransferDestination(transfer) {
        const partLocation = transfer.location + '.part';
        return fs_promise_1.statP(transfer.location)
            .catch((err) => {
            return Promise.resolve(new fs.Stats());
        })
            .then((stats) => {
            if (stats.isFile() && stats.size === transfer.fileSize) {
                transfer.error = 'file with the same size already exists';
                transfer.progress = 100;
                this.cancel(transfer);
                return Promise.reject(new irc_xdcc_error_1.XdccError('validateTransferDestination', transfer.error, transfer));
            }
            return fs_promise_1.statP(partLocation)
                .catch((err) => {
                return Promise.resolve(new fs.Stats());
            });
        })
            .then((stats) => {
            if (stats.isFile() && stats.size === transfer.fileSize) {
                return fs_promise_1.renameP(partLocation, transfer.location)
                    .then(() => {
                    transfer.error = 'file with the same size already exists';
                    transfer.progress = 100;
                    this.cancel(transfer);
                    return Promise.reject(new irc_xdcc_error_1.XdccError('validateTransferDestination', transfer.error, transfer));
                });
            }
            else if (!stats.size) {
                return Promise.resolve(transfer);
            }
            else if (this.options.resume) {
                if (!transfer.resumePosition) {
                    transfer.resumePosition = stats.size;
                    this.ctcp(transfer.botNick, 'privmsg', `DCC RESUME ${transfer.fileName} ${transfer.port} ${transfer.resumePosition}`);
                    return Promise.reject(new irc_xdcc_error_1.XdccError('validateTransferDestination', 'transfer should be resumed', transfer));
                }
                else {
                    return Promise.reject(new irc_xdcc_error_1.XdccError('validateTransferDestination', 'transfer should be resumed, resume command already sent', transfer));
                }
            }
            else {
                return fs_promise_1.unlinkP(partLocation)
                    .then(() => Promise.resolve(transfer));
            }
        });
    }
    /**
     * Downloads the file from the serving bot fro the specified transfer
     * @param {XdccTransfer} transfer The transfer to download
     * @returns {Promise<XdccTransfer[]>} The inputed XDCC transfers
     */
    downloadFile(transfer) {
        return new Promise((resolve, reject) => {
            if (transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.completed || transfer.state === irc_xdcc_transfer_state_1.XdccTransferState.canceled) {
                return reject(new irc_xdcc_error_1.XdccError('downloadFile', 'transfer aborted: transfer already completed or canceled', transfer));
            }
            const partLocation = transfer.location + '.part';
            const writeStream = fs.createWriteStream(partLocation, { flags: 'a' });
            const sendBuffer = Buffer.alloc(4);
            let received = transfer.resumePosition || 0;
            let ack = transfer.resumePosition || 0;
            let socket;
            const internalDisconnectedHandler = (nick, reason, channels, message) => {
                if (nick === this.nick) {
                    writeStream.end();
                    socket && socket.destroy();
                    transfer.error = 'transfer aborted: irc client disconnected';
                    return reject(new irc_xdcc_error_1.XdccError('downloadFile', transfer.error, transfer));
                }
            };
            if (this.options.closeConnectionOnCompleted) {
                this.once(irc_xdcc_events_1.XdccEvents.ircQuit, internalDisconnectedHandler);
                this.once(irc_xdcc_events_1.XdccEvents.ircKill, internalDisconnectedHandler);
            }
            writeStream.on('open', () => {
                socket = net.createConnection(transfer.port, transfer.ip, () => {
                    transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.started;
                    this.emit(irc_xdcc_events_1.XdccEvents.xdccStarted, transfer);
                    transfer.progressIntervalId = setInterval(() => {
                        this.emit(irc_xdcc_events_1.XdccEvents.xdccProgressed, transfer, received);
                    }, this.options.progressInterval * 1000);
                    transfer.startedAt = process.hrtime();
                    this.emit(irc_xdcc_events_1.XdccEvents.xdccConnected, transfer);
                });
                socket.on('data', (data) => {
                    const totalReceived = received + data.length;
                    const progress = totalReceived - transfer.resumePosition;
                    const timeDelta = process.hrtime(transfer.startedAt);
                    const secondsDelta = (timeDelta[0] * 1e9 + timeDelta[1]) / 1e9;
                    const percents = totalReceived / transfer.fileSize * 100;
                    const speed = progress / secondsDelta;
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
                const socketEndHandler = (socketError) => {
                    const duration = transfer.startedAt ? process.hrtime(transfer.startedAt) : [0, 0];
                    const secondsDelta = (duration[0] * 1e9 + duration[1]) / 1e9;
                    const speed = transfer.fileSize / secondsDelta;
                    transfer.duration = duration;
                    transfer.speed = speed;
                    writeStream.end();
                    socket.destroy();
                    if (transfer.progressIntervalId) {
                        clearInterval(transfer.progressIntervalId);
                        transfer.progressIntervalId = null;
                    }
                    if (this.options.closeConnectionOnCompleted) {
                        if (this.rawListeners(irc_xdcc_events_1.XdccEvents.ircQuit).indexOf(internalDisconnectedHandler) > -1) {
                            this.off(irc_xdcc_events_1.XdccEvents.ircQuit, internalDisconnectedHandler);
                        }
                        if (this.rawListeners(irc_xdcc_events_1.XdccEvents.ircKill).indexOf(internalDisconnectedHandler) > -1) {
                            this.off(irc_xdcc_events_1.XdccEvents.ircKill, internalDisconnectedHandler);
                        }
                    }
                    // Connection closed
                    if (received == transfer.fileSize) {
                        // download completed
                        fs_promise_1.renameP(transfer.location + '.part', transfer.location)
                            .then(() => {
                            transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.completed;
                            this.emit(irc_xdcc_events_1.XdccEvents.xdccCompleted, transfer);
                            resolve(transfer);
                        })
                            .catch((err) => {
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
                        const xdccError = new irc_xdcc_error_1.XdccError('downloadFile', transfer.error, transfer);
                        this.emit(irc_xdcc_events_1.XdccEvents.xdccDlError, xdccError);
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
                        const xdccError = new irc_xdcc_error_1.XdccError('downloadFile', transfer.error, transfer);
                        this.emit(irc_xdcc_events_1.XdccEvents.xdccDlError, xdccError);
                        reject(xdccError);
                    }
                };
                socket.on('end', socketEndHandler);
                socket.on('error', socketEndHandler);
            });
            writeStream.on('error', (err) => {
                writeStream.end();
                socket && socket.destroy();
                transfer.error = `write stream error: ${err.toString()}`;
                const xdccError = new irc_xdcc_error_1.XdccError('downloadFile', transfer.error, transfer, err);
                this.emit(irc_xdcc_events_1.XdccEvents.xdccDlError, xdccError);
                reject(xdccError);
            });
        });
    }
    /**
     * Joins the channel assigned to the transfer if required
     * @param transfer The transfer to join the channel for
     * @returns {Promise<XdccTransfer[]>} A promise for the transfer the channel has been joined for
     */
    joinTransferChannel(transfer) {
        return new Promise((resolve, reject) => {
            if (!transfer.channel) {
                return resolve(transfer);
            }
            if (Object.keys(this.chans).map((chan) => chan.toLowerCase()).indexOf(transfer.channel.toLowerCase()) > -1) {
                return resolve(transfer);
            }
            const internalJoinHandler = (channel, nick, message) => {
                if (nick === this.nick && channel.toLowerCase() === transfer.channel.toLowerCase()) {
                    this.off(irc_xdcc_events_1.XdccEvents.ircJoin, internalJoinHandler);
                    this.off(irc_xdcc_events_1.XdccEvents.ircError, interalErrorHandler);
                    resolve(transfer);
                }
            };
            const interalErrorHandler = (message) => {
                if (message.command == 'err_bannedfromchan' && message.args[1].toLowerCase() === transfer.channel.toLowerCase()) {
                    this.off(irc_xdcc_events_1.XdccEvents.ircJoin, internalJoinHandler);
                    this.off(irc_xdcc_events_1.XdccEvents.ircError, interalErrorHandler);
                    transfer.error = 'banned from channel';
                    const xdccError = new irc_xdcc_error_1.XdccError('joinTransferChannel', transfer.error, transfer, null, message);
                    reject(xdccError);
                }
            };
            this.on(irc_xdcc_events_1.XdccEvents.ircJoin, internalJoinHandler);
            this.on(irc_xdcc_events_1.XdccEvents.ircError, interalErrorHandler);
            this.join(transfer.channel);
        });
    }
    /**
     * Sends the start signal to the server bot for the specified transfer
     * @param {XdccTransfer} transfer The transfer to start
     * @returns {Promise<XdccTransfer[]>} A promise for the started XDCC transfers
     */
    start(transfer) {
        return new Promise((resolve, reject) => {
            const s = () => {
                this.joinTransferChannel(transfer)
                    .then(() => {
                    this[this.options.method](transfer.botNick, this.options.sendCommand + ' ' + transfer.packId);
                    transfer.progress = 0;
                    transfer.speed = 0;
                    transfer.receivedBytes = 0;
                    transfer.resumePosition = 0;
                    delete transfer.error;
                    transfer.state = irc_xdcc_transfer_state_1.XdccTransferState.requested;
                    this.emit(irc_xdcc_events_1.XdccEvents.xdccRequested, transfer);
                    return resolve(transfer);
                })
                    .catch((err) => {
                    if (!(err instanceof irc_xdcc_error_1.XdccError)) {
                        const xdccError = new irc_xdcc_error_1.XdccError('start', 'unhandled error', transfer, err);
                        //this.emit(XdccEvents.xdccError, xdccError);
                        return reject(xdccError);
                    }
                    else {
                        //this.emit(XdccEvents.xdccError, err);
                        return reject(err);
                    }
                });
            };
            if (this.isConnected) {
                s();
            }
            // if not connected, start will be called again by restart(). Not need to intercept connection even
            //else {
            //this.once(XdccEvents.ircConnected, s);
            //}
        });
    }
    /**
     * Sends the cancel signal to server bot for the specified transfer
     * @param {XdccTransfer} transfer The transfer to cancel
     * @returns {Promise<XdccTransfer[]>} A promise for the canceled XDCC transfers
     */
    cancel(transfer) {
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
    }
}
exports.XdccClient = XdccClient;
//# sourceMappingURL=irc-xdcc-2.js.map