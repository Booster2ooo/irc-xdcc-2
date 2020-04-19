import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import { Client } from 'irc';
import { statP, renameP, unlinkP } from './fs-promise';
//import { promises as fsp } from 'fs'; // experimental ...
import { XdccEvents }from './irc-xdcc-events';
import { XdccTransfer } from "./irc-xdcc-transfer";
import { XdccClientOptions } from "./irc-xdcc-client-options";
import { XdccPackInfo } from "./irc-xdcc-pack-info";
import { XdccTransferState } from "./irc-xdcc-transfer-state";
import { XdccMessage } from './irc-xdcc-message';
import { converter } from './converter';
import { version } from './version';
import { XdccError } from './irc-xdcc-error';


const pathSeparator = path.sep.replace('\\\\','\\');

/**
 * Class representing an irc client with XDCC capabilities.
 * @extends irc.Client
 */
export class XdccClient extends Client {

	/**
	 * @property {boolean} isConnected Defines if the IRC client is connected and joined all the channels
	 */
	isConnected: boolean;

	/**
	 * @property {string} server IRC server address
	 */
	server: string;

	/**
	 * @property {XdccTransfer[]} transferPool The list of transfers
	 */
	transferPool: XdccTransfer[];

	/**
	 * @property {number} stores The last generated transfer id
	 */
	private lastIndex: number;

	/**
	 * @property {XdccClientOptions} options The client options
	 */
	private options: XdccClientOptions;

	constructor(opt: XdccClientOptions) {
		const defaultOptions = new XdccClientOptions();
		const options = { ...defaultOptions, ...opt };
		// create destination directory
		fs.mkdir(options.destPath,() => {});
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
		this.on(XdccEvents.ircRegistered, this.registeredHandler)
			.on(XdccEvents.ircCtcpVersion, this.versionHandler)
			.on(XdccEvents.ircCtcpPrivmsg, this.privCtcpHandler)
			.on(XdccEvents.ircNotice, this.noticeHandler)
			.on(XdccEvents.ircQuit, this.disconnectedHandler)
			.on(XdccEvents.ircKill, this.disconnectedHandler)
			.on(XdccEvents.ircError, this.errorHandler)
			;
		if (options.joinTopicChans) {
			this.on(XdccEvents.ircTopic, this.topicHandler);
		}
	}
	
	/**
	 * Promised based factory, alternative to constructor. If opt.autoConnect, will resolve after being connected
	 * @param opt {XdccClientOptions} The XdccClientOptions
	 * @returns {Promise<XdccClient>} A promise for the new instance of XdccClient
	 */
	static create(opt: XdccClientOptions): Promise<XdccClient> {
		return new Promise((resolve, reject) => {
			const client = new XdccClient(opt);
			if (!opt.autoConnect) {
				return resolve(client);
			}
			const connectedListener = () => {
				client.removeListener(XdccEvents.ircConnected, connectedListener);
				resolve(client);
			};
			const netErrorListerner = () => {
				client.removeListener(XdccEvents.ircNeterror, netErrorListerner);
				reject(client);
			};
			client.addListener(XdccEvents.ircConnected, connectedListener);
			client.addListener(XdccEvents.ircNeterror, netErrorListerner);
		});
	}

	/**
	 * A promise wrapper around the original connect function
	 * @param retryCount {number} The number of times the client will try to connect on failure
	 * @returns {Promise<void>} A new instance of XdccClient
	 */
	connectP(retryCount?: number): Promise<void> {
		return new Promise((resolve, reject) => {			
			const connectedListener = () => {
				this.removeListener(XdccEvents.ircConnected, connectedListener);
				resolve();
			};
			this.addListener(XdccEvents.ircConnected, connectedListener.bind(this));
			this.connect(retryCount, () => {
				connectedListener();
			});
		});
	}

	/**
	 * Adds a transfer to the pool based on the provided xdcc pack info
	 * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
	 * @returns {Promise<XdccTransfer>} A promise for the addedd XDCC transfer
	 */
	addTransfer(packInfo: XdccPackInfo): Promise<XdccTransfer> {
		if (!packInfo.botNick) {
			const error = new XdccError('addTransfer', 'botNick not provided', packInfo);
			this.emit(XdccEvents.xdccError, error);
			return Promise.reject(error);
		}
		if(!packInfo.packId) {
			const error = new XdccError('addTransfer', 'packId not provided', packInfo);
			this.emit(XdccEvents.xdccError, error);
			return Promise.reject(error);
		}
		packInfo.server = this.server;
		return this.search(packInfo as XdccTransfer)
			.then((transfers: XdccTransfer[]) => {
				if (transfers.length) {
					return Promise.reject(new XdccError(
						'addTransfer', 
						`required pack already in pool with id '${transfers[0].transferId}'`,
						packInfo
					));
				}
				return this.createTransfer(packInfo);
			})
			.then((transfer) => {
				return this.start(transfer);
			})
			.catch((err: XdccError|Error) => {
				if(!(err instanceof XdccError)) {
					const xdccError = new XdccError('addTransfer', 'unhandled error', packInfo, err);
					this.emit(XdccEvents.xdccError, xdccError);
					return Promise.reject(xdccError);
				}
				else {
					this.emit(XdccEvents.xdccError, err);
					return Promise.reject(err);
				}
			});
	}

	/**
	 * Cancels the provided transfer
	 * @param {XdccTransfer} xdccTransfer transfer instance
	 * @returns {Promise<XdccTransfer>} A promise for the canceled XDCC transfer
	 */
	cancelTransfer(xdccTransfer: XdccTransfer): Promise<XdccTransfer> {
		if (xdccTransfer.transferId) {
			return this.cancelTransferById(xdccTransfer.transferId);
		}
		return this.search(xdccTransfer)
			.then((transfers: XdccTransfer[]) => {
				if (!transfers ||!transfers.length) {
					return Promise.reject(new XdccError('cancelTransfer',`Unable to cancel the specified transfer, not found.`, xdccTransfer));
				}
				return this.cancelTransferById(transfers[0].transferId as number);
			});
	}

	/**
	 * Cancels the transfer matching the provided xdcc pack info
	 * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
	 * @returns {Promise<XdccTransfer>} A promise for the canceled XDCC transfer
	 */
	cancelTransferByInfo(packInfo: XdccPackInfo): Promise<XdccTransfer> {
		return this.search({ botNick: packInfo.botNick, packId: packInfo.packId } as XdccTransfer)
			.then((transfers: XdccTransfer[]) => {
				if (!transfers ||!transfers.length) {
					return Promise.reject(new XdccError('cancelTransferByInfo',`Unable to cancel the specified transfer, not found.`, packInfo));
				}
				return this.cancelTransferById(transfers[0].transferId as number);
			});
	}

	/**
	 * Cancels the transfer at the specified index in the transfer pool
	 * @param {number} transferId transfer pool index
	 * @returns {Promise<XdccTransfer>} A promise for the canceled XDCC transfer
	 */
	cancelTransferById(transferId: number): Promise<XdccTransfer> {
		return this.search({ transferId } as XdccTransfer)
			.then((transfers: XdccTransfer[]) => {
				if (!transfers ||!transfers.length) {
					return Promise.reject(new XdccError('cancelTransferById',`Unable to remove cancel with id ${transferId}, not found.`));
				}
				this.cancel(transfers[0]);
				return Promise.resolve(transfers[0]);
			});
	}

	/**
	 * Returns the list of transfers
	 * @returns {XdccTransfer} A promise for the list of transfers in the pool
	 */
	listTransfers(): Promise<XdccTransfer[]> {
		return Promise.resolve(this.transferPool);
	}

	/**
	 * Removes the provided transfer instance from the list
	 * @param {XdccTransfer} xdccTransfer The transfer instance
	 * @returns {Promise<XdccTransfer>} A promise for the removed XDCC transfer
	 */
	removeTransfer(xdccTransfer: XdccTransfer): Promise<XdccTransfer> {
		if (xdccTransfer.transferId) {
			return this.removeTransferById(xdccTransfer.transferId);
		}
		return this.search(xdccTransfer)
			.then((transfers: XdccTransfer[]) => {
				if (!transfers ||!transfers.length) {
					return Promise.reject(new XdccError('removeTransfer',`Unable to remove the specified transfer, not found.`, xdccTransfer));
				}
				return this.removeTransferById(transfers[0].transferId as number);
			});
	}

	/**
	 * Removes the transfer at the specified index in the transfer pool
	 * @param {number} transferId The transfer pool index
	 * @returns {Promise<XdccTransfer>} A promise for the removed XDCC transfer
	 */
	removeTransferById(transferId: number): Promise<XdccTransfer> {
		return this.cancelTransferById(transferId)
			.then((transfer: XdccTransfer) => {
				const index = this.transferPool.indexOf(transfer);
				this.transferPool.splice(index, 1);
				this.emit(XdccEvents.xdccRemoved, transfer);
				return Promise.resolve(transfer);
			});
	}

	/**
	 * Disconnects the IRC client and clears the transfer pool
	 * @param message The disconnection message
	 * @param callback The function called after being disconnected
	 */
	disconnect(message?: string, callback?: Function): void {
		message = message || version;
		const disconnectCallback = () => {
			this.isConnected = false;
			if (callback) {
				callback();
			}
		};
		this.clear()
			.catch((err) => this.emit(XdccEvents.ircError, err))
			.then(() => Client.prototype.disconnect.call(this, message, disconnectCallback))
			;		
	}

	/**
	 * Handles when the client is fully registered on the IRC network
	 * @param {string} message The registration message
	 */
	private registeredHandler(message: any): void {
		const channelRejoinedQueue: Promise<string>[] = this.options.channels.map((chan) => new Promise((resolve, reject) => {
			this.once(XdccEvents.ircJoin+chan.toLowerCase(), (nick: string, message: string) => {
				if(nick == this.nick) {
					resolve(chan);
				}
			});
		}));
		Promise.all(channelRejoinedQueue)
			.then((channels: string[]) => {
				this.isConnected = true;
				this.emit(XdccEvents.ircConnected, channels);
				/* Used .once instead of .on, no need to remove the listeners anymore
				this.options.channels.forEach((chan) => {
					this.removeAllListeners(XdccEvents.ircJoin+chan.toLowerCase());
				});*/
				return this.restart();
			})
			
			.catch((err: XdccError|Error) => {
				if(!(err instanceof XdccError)) {
					const xdccError = new XdccError('registeredHandler', 'unhandled error', null, err, message);
					this.emit(XdccEvents.xdccError, xdccError);
				}
				else {
					this.emit(XdccEvents.xdccError, err);
				}
			})
	}

	/**
	 * Handles CTCP Version messages
	 * @param {string} from The CTCP emitter
	 * @param {string} to The CTCP recipient
	 * @param {string} message The raw CTCP message
	 */
	private versionHandler(from: string, to: string, message: any): void {
		this.ctcp(from, 'normal', 'VERSION ' + version);
	}
	
	/**
	 * Handles CTCP PrivMsg messages
	 * @param {string} from The CTCP emitter
	 * @param {string} to The CTCP recipient
	 * @param {string} text The CTCP content
	 * @param {string} message The raw CTCP message
	 */
	private privCtcpHandler(from: string, to: string, text: string, message: any): void {
		if (to !== this.nick
		 || !text
		 || text.substr(0, 4) !== 'DCC '
		) {
			this.emit(XdccEvents.xdccError, new XdccError('privCtcpHandler','not a DCC message', null, null, message));
			return;
		}
		const parsedMessage: RegExpMatchArray | null = text.match(this.options.dccParser);
		if (!parsedMessage || !parsedMessage.length) {
			this.emit(XdccEvents.xdccError, new XdccError('privCtcpHandler','unable to parse DCC message', null, null, message));
			return;
		}
		const xdccMessage: XdccMessage = new XdccMessage();
		xdccMessage.sender = from;
		xdccMessage.target = to;
		xdccMessage.message = text;
		xdccMessage.params = parsedMessage;
		// Delay handling so the notice with filename can be parsed... (?)
		setTimeout(() => 
			this.search({
					botNick: xdccMessage.sender,
					fileName: xdccMessage.params[2]
			} as XdccTransfer)
				.then((transfers: XdccTransfer[]) => {
					if (transfers.length) {
						if (transfers.length > 1) {
							console.warn(`found multiple transfers (${transfers.length}) for the same file '${xdccMessage.params[2]}' from the same bot '${xdccMessage.sender}'. Using first one.`);
						}
						if (transfers[0].state === XdccTransferState.completed) {
							return Promise.reject(new XdccError('privCtcpHandler', 'transfer already completed', transfers[0], null, xdccMessage));
						}
						return Promise.resolve(transfers[0]);
					}
					else if (!this.options.acceptUnpooled) {
						return Promise.reject(new XdccError('privCtcpHandler', 'unintended transfer', null, null, xdccMessage));
					}
					return this.createTransfer({ botNick: xdccMessage.sender, packId: -1} as XdccPackInfo);
				})
				.then((transfer: XdccTransfer) => {
					transfer.sender = xdccMessage.sender;
					transfer.target = xdccMessage.target;
					transfer.message = xdccMessage.message;
					transfer.params = xdccMessage.params;
					transfer.lastCommand = xdccMessage.params[1].toUpperCase();
					if (transfer.lastCommand === 'SEND') {
						transfer.fileName = xdccMessage.params[2];
						transfer.ip = converter.intToIp(xdccMessage.params[3]);
						transfer.port = parseInt(xdccMessage.params[4], 10);
						transfer.fileSize = parseInt(xdccMessage.params[5], 10);
						return this.computeTransferDestination(transfer)
							.then(this.validateTransferDestination.bind(this));
					}
					else if (transfer.lastCommand === 'ACCEPT'
						&& transfer.fileName === xdccMessage.params[2]
						&& transfer.port === parseInt(xdccMessage.params[3], 10)
						&& transfer.resumePosition === parseInt(xdccMessage.params[4], 10)
					) {
						return Promise.resolve(transfer);
					}
					else {
						return Promise.reject(new XdccError('privCtcpHandler', `unknown/invalid command '${transfer.lastCommand}'`, transfer, null, xdccMessage));
					}
				})
				.then(this.downloadFile.bind(this))
				.catch((err: XdccError|Error) => {
					if(!(err instanceof XdccError)) {
						const xdccError = new XdccError('privCtcpHandler', 'unhandled error', null, err, message);
						this.emit(XdccEvents.xdccError, xdccError);
					}
					else {
						this.emit(XdccEvents.xdccError, err);
					}
				})
		, 2000);
	}

	/**
	 * Handles notice messages
	 * @param {string} from The notice emitter
	 * @param {string} to The notice recipient
	 * @param {string} text The notice content
	 * @param {string} message The raw notice message
	 */
	private noticeHandler(from: string,to: string, text: string, message: any): void {
		const dccSendMessage: RegExpMatchArray | null = text.match(this.options.sendParser);
		const dccQueuedMessage: RegExpMatchArray | null = text.match(this.options.queuedParser);
		if (dccSendMessage || dccQueuedMessage) {
			let packId: string|number = dccSendMessage ? dccSendMessage[3] : (dccQueuedMessage as RegExpMatchArray)[1];
			let fileName: string = dccSendMessage ? dccSendMessage[4] : (dccQueuedMessage as RegExpMatchArray)[2];
			let isQueued: boolean = false;
			this.search({ botNick: from, packId } as XdccTransfer)
				.then((transfers: XdccTransfer[]) => {
					// The should be only one...
					transfers.forEach(transfer => {
						transfer.fileName = fileName;
						if (isQueued) {
							transfer.state = XdccTransferState.queued;
							this.emit(XdccEvents.xdccQueued, transfer);
						}
					});
				})
				.catch((err: XdccError|Error) => {
					if(!(err instanceof XdccError)) {
						const xdccError = new XdccError('noticeHandler', 'unhandled error', null, err, message);
						this.emit(XdccEvents.xdccError, xdccError);
					}
					else {
						this.emit(XdccEvents.xdccError, err);
					}
				})
				;
		}
	}

	/**
	 * Handles a disconnection
	 * @param {string} nick The disconnected nick
	 * @param {string} reason The disconnection reason
	 * @param {string} channels The emitting channels
	 * @param {string} message The raw disconnection message
	 */
	private disconnectedHandler(nick: string, reason: string, channels: string, message: any): void {
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
	private topicHandler(channel: string, topic: string, nick: string, message: any): void {
		topic
			.split(' ')
			.filter((part) => part[0]=='#')
			.forEach((chan) => {
				this.join(chan);
			});
	}
	
	/**
	 * Handles error messages
	 * @param {string} message The raw error message
	 */
	private errorHandler(message: any): void {
		if (message.command === 'err_bannedfromchan') {
			this.search({ channel: message.args[1]} as XdccTransfer)
				.then((transfers: XdccTransfer[]) => {
					transfers.forEach(transfer => {
						transfer.state = XdccTransferState.canceled;
						transfer.error = message;
						this.emit(XdccEvents.xdccCanceled, transfer);
					});
				})
				.catch((err: XdccError|Error) => {
					if(!(err instanceof XdccError)) {
						const xdccError = new XdccError('errorHandler', 'unhandled error', null, err, message);
						this.emit(XdccEvents.xdccError, xdccError);
					}
					else {
						this.emit(XdccEvents.xdccError, err);
					}
				})
				;
		}
		else if (message.command === 'err_nosuchnick') {
			this.search({ botNick: message.args[1]} as XdccTransfer)
				.then((transfers: XdccTransfer[]) => {
					transfers.forEach(transfer => {
						transfer.state = XdccTransferState.canceled;
						transfer.error = message;
						this.emit(XdccEvents.xdccCanceled, transfer);
					});
				})
				.catch((err: XdccError|Error) => {
					if(!(err instanceof XdccError)) {
						const xdccError = new XdccError('errorHandler', 'unhandled error', null, err, message);
						this.emit(XdccEvents.xdccError, xdccError);
					}
					else {
						this.emit(XdccEvents.xdccError, err);
					}
				})
				;
		}
	}

	/**
	 * Restarts pooled transfers
	 * @returns {XdccTransfer} The restarted XDCC transfers
	 */
	private restart(): Promise<XdccTransfer[]> {
		return Promise.all(this.transferPool.map(transfer => this.start(transfer)));
	}

	/**
	 * Cancels all transfers and clears the pool
	 * @returns {Promise<void>} An empty promise
	 */
	private clear(): Promise<XdccTransfer[]> {
		return Promise.all(this.transferPool.map((transfer: XdccTransfer) => this.removeTransferById(transfer.transferId as number)));
	}

	/**
	 * Searches matching transfers
	 * @param {XdccTransfer} xdccTransfer The transfer info to filter the pool with
	 * @returns {Promise<XdccTransfer[]>} A promise for matching XDCC transfers
	 */
	private search(needle: XdccTransfer): Promise<XdccTransfer[]> {
		return Promise.resolve(this.transferPool.filter((transfer) => {
			let isMatch = true;
			Object.keys(needle).forEach(key => {
				if(needle.hasOwnProperty(key) && ( 
						!transfer.hasOwnProperty(key) 
					  || (transfer as any)[key] !== (needle as any)[key]
					)
				) {
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
	private createTransfer(packInfo: XdccPackInfo): Promise<XdccTransfer> {
		const transfer = new XdccTransfer(packInfo);
		transfer.server = this.server;
		this.lastIndex++;
		transfer.transferId = this.lastIndex;
		this.transferPool.push(transfer);		
		this.emit(XdccEvents.xdccCreated, transfer);
		return Promise.resolve(transfer);
	}

	/**
	 * Computes the location of the file on disk
	 * @param {XdccTransfer} transfer The transfer to verify
	 * @returns {Promise<XdccTransfer[]>} The inputed XDCC transfers
	 */
	private computeTransferDestination(transfer: XdccTransfer): Promise<XdccTransfer> {
		if (transfer.location) {
			return Promise.resolve(transfer);
		}
		return this.search({
				fileName: transfer.fileName
			} as XdccTransfer)
			.then((transfers: XdccTransfer[]) => {
				const filenameParts: string[] = (transfer.fileName as string).split('.');
				const otherBotsTransfers = transfers.filter(t => t.botNick != transfer.botNick && t.state === XdccTransferState.started);
				if (otherBotsTransfers.length) {
					// if other transfers of the same file, myfile.ext becomes myfile.(1).ext
					filenameParts.splice(filenameParts.length - 1, 0, `(${otherBotsTransfers.length})`);
				}
				transfer.location = this.options.destPath
					+ (this.options.destPath.substr(-1, 1) === pathSeparator ? '' : pathSeparator)
					+ filenameParts.join('.')
					;
				return Promise.resolve(transfer);
			})
	}

	/**
	 * Verifies if the destination file already exists and/or needs to be resume for the specified transfer
	 * @param {XdccTransfer} transfer The transfer to verify
	 * @returns {Promise<XdccTransfer[]>} The inputed XDCC transfers
	 */
	private validateTransferDestination(transfer: XdccTransfer): Promise<XdccTransfer> {
		const partLocation: fs.PathLike = transfer.location + '.part' as fs.PathLike;
		return statP(transfer.location as fs.PathLike)
			.catch((err: any) => {
				return Promise.resolve(new fs.Stats());
			})
			.then((stats: fs.Stats) => {
				if (stats.isFile() && stats.size === transfer.fileSize) {
					transfer.error = 'file with the same size already exists';
					transfer.progress = 100;
					this.cancel(transfer);
					return Promise.reject(new XdccError('validateTransferDestination', transfer.error, transfer));
				}
				return statP(partLocation)
					.catch((err: any) => {
						return Promise.resolve(new fs.Stats());
					});
			})
			.then((stats: fs.Stats) => {
				if (stats.isFile() && stats.size === transfer.fileSize) {
					return renameP(partLocation, transfer.location as fs.PathLike)
						.then(() => {
							transfer.error = 'file with the same size already exists';
							transfer.progress = 100;
							this.cancel(transfer);
							return Promise.reject(new XdccError('validateTransferDestination', transfer.error, transfer));
						});
				}
				else if (!stats.size) {
					return Promise.resolve(transfer);
				}
				else if (this.options.resume) {
					if (!transfer.resumePosition) {
						transfer.resumePosition = stats.size;
						this.ctcp(transfer.botNick as string, 'privmsg', `DCC RESUME ${transfer.fileName} ${transfer.port} ${transfer.resumePosition}`);
						return Promise.reject(new XdccError('validateTransferDestination', 'transfer should be resumed', transfer));
					}
					else {
						return Promise.reject(new XdccError('validateTransferDestination', 'transfer should be resumed, resume command already sent', transfer));
					}
				}
				else {
					return unlinkP(partLocation)
						.then(() => Promise.resolve(transfer));
				}
			});
	}

	/**
	 * Downloads the file from the serving bot fro the specified transfer
	 * @param {XdccTransfer} transfer The transfer to download
	 * @returns {Promise<XdccTransfer[]>} The inputed XDCC transfers
	 */
	private downloadFile(transfer: XdccTransfer): Promise<XdccTransfer> {
		return new Promise((resolve, reject) => {
			if (transfer.state === XdccTransferState.completed || transfer.state === XdccTransferState.canceled) {
				return reject(new XdccError('downloadFile', 'transfer aborted: transfer already completed or canceled', transfer));
			}
			const partLocation: fs.PathLike = transfer.location + '.part' as fs.PathLike;
			const writeStream: fs.WriteStream = fs.createWriteStream(partLocation, { flags: 'a' });
			const sendBuffer: Buffer = Buffer.alloc(4);
			let received: number = transfer.resumePosition || 0;
			let ack: number = transfer.resumePosition || 0;
			let socket: net.Socket;
			const internalDisconnectedHandler = (nick: string, reason: string, channels: string[], message: string) => {
				if (nick === this.nick) {
					writeStream.end();
					socket && socket.destroy();
					transfer.error = 'transfer aborted: irc client disconnected';
					return reject(new XdccError('downloadFile', transfer.error, transfer));
				}
			};
			if (this.options.closeConnectionOnCompleted) {
				this.once(XdccEvents.ircQuit, internalDisconnectedHandler);
				this.once(XdccEvents.ircKill, internalDisconnectedHandler);
			}
			writeStream.on('open', () => {
				socket = net.createConnection(transfer.port as number, transfer.ip as string, () => {
					transfer.state = XdccTransferState.started;
					this.emit(XdccEvents.xdccStarted, transfer);
					transfer.progressIntervalId = setInterval(() => {
						this.emit(XdccEvents.xdccProgressed, transfer, received);
					}, this.options.progressInterval*1000);
					transfer.startedAt = process.hrtime();
					this.emit(XdccEvents.xdccConnected, transfer);
				});
				socket.on('data', (data: Buffer) => {
					const totalReceived: number = received + data.length;
					const progress: number = totalReceived - (transfer.resumePosition as number);
					const timeDelta: [number, number] = process.hrtime(transfer.startedAt as [number,number]);
					const secondsDelta: number = (timeDelta[0] * 1e9 + timeDelta[1]) / 1e9;
					const percents: number = totalReceived / (transfer.fileSize as number) * 100;
					const speed: number = progress / secondsDelta;
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
				const socketEndHandler = (socketError: Error) => {
					const duration: [number, number] = transfer.startedAt ? process.hrtime(transfer.startedAt) : [0,0];
					const secondsDelta: number = (duration[0] * 1e9 + duration[1]) / 1e9;
					const speed: number = (transfer.fileSize as number) / secondsDelta;
					transfer.duration = duration;
					transfer.speed = speed;
					writeStream.end();
					socket.destroy();
					if (transfer.progressIntervalId) {
						clearInterval(transfer.progressIntervalId as NodeJS.Timeout);
						transfer.progressIntervalId = null;
					}
					if(this.options.closeConnectionOnCompleted) {
						if (this.rawListeners(XdccEvents.ircQuit).indexOf(internalDisconnectedHandler) > -1 ) {
							this.off(XdccEvents.ircQuit, internalDisconnectedHandler);
						}
						if (this.rawListeners(XdccEvents.ircKill).indexOf(internalDisconnectedHandler) > -1 ) {
							this.off(XdccEvents.ircKill, internalDisconnectedHandler);
						}
					}
					// Connection closed
					if (received == transfer.fileSize) {
						// download completed
						renameP(transfer.location + '.part', transfer.location as fs.PathLike)
							.then(() => {
								transfer.state = XdccTransferState.completed;
								this.emit(XdccEvents.xdccCompleted, transfer);
								resolve(transfer);
							})
							.catch((err) => {
								transfer.error = err;
								reject(transfer);
							});
					} 
					else if (received != transfer.fileSize && transfer.state !== XdccTransferState.completed) {
						// download incomplete
						transfer.state = XdccTransferState.canceled; // create a "failed" status?
						if (!socketError) {
							transfer.error = 'server unexpected closed connection';
						}
						else {
							transfer.error = socketError;
						}
						const xdccError = new XdccError('downloadFile', transfer.error, transfer);
						this.emit(XdccEvents.xdccDlError, xdccError);
						reject(xdccError);
					} 
					else if (received != transfer.fileSize && transfer.state === XdccTransferState.completed) {
						// download aborted
						transfer.state = XdccTransferState.canceled; // create a "failed" status?
						if (!socketError) {
							transfer.error = 'server closed connection, download canceled';
						}
						else {
							transfer.error = socketError;
						}
						const xdccError = new XdccError('downloadFile', transfer.error, transfer);
						this.emit(XdccEvents.xdccDlError, xdccError);
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
				const xdccError = new XdccError('downloadFile', transfer.error, transfer, err);
				this.emit(XdccEvents.xdccDlError, xdccError);
				reject(xdccError);
			});
		});
	}

	/**
	 * Joins the channel assigned to the transfer if required
	 * @param transfer The transfer to join the channel for
	 * @returns {Promise<XdccTransfer[]>} A promise for the transfer the channel has been joined for
	 */
	private joinTransferChannel(transfer: XdccTransfer): Promise<XdccTransfer> {
		return new Promise((resolve, reject) => {
			if (!transfer.channel) {
				return resolve(transfer);
			}
			if (Object.keys(this.chans).map((chan: string) => chan.toLowerCase()).indexOf(transfer.channel.toLowerCase()) > -1) {
				return resolve(transfer);
			}
			const internalJoinHandler = (channel: string, nick: string, message: any) => {
				if (nick === this.nick && channel.toLowerCase() === (transfer.channel as string).toLowerCase()) {
					this.off(XdccEvents.ircJoin, internalJoinHandler);
					this.off(XdccEvents.ircError, interalErrorHandler);
					resolve(transfer);
				}
			};
			const interalErrorHandler = (message: any) => {
				if (message.command == 'err_bannedfromchan' && message.args[1].toLowerCase() === (transfer.channel as string).toLowerCase()) {
					this.off(XdccEvents.ircJoin, internalJoinHandler);
					this.off(XdccEvents.ircError, interalErrorHandler);
					transfer.error = 'banned from channel';
					const xdccError = new XdccError('joinTransferChannel', transfer.error, transfer, null, message);
					reject(xdccError);
				}
			};
			this.on(XdccEvents.ircJoin, internalJoinHandler);
			this.on(XdccEvents.ircError, interalErrorHandler);
			this.join(transfer.channel);
		});
	}

	/**
	 * Sends the start signal to the server bot for the specified transfer
	 * @param {XdccTransfer} transfer The transfer to start
	 * @returns {Promise<XdccTransfer[]>} A promise for the started XDCC transfers
	 */
	start(transfer: XdccTransfer): Promise<XdccTransfer> {
		return new Promise((resolve, reject) => {
			const s: Function = () => {
				this.joinTransferChannel(transfer)
					.then(() => {
						(this as any)[this.options.method](transfer.botNick, this.options.sendCommand + ' ' + transfer.packId);
						transfer.progress = 0;
						transfer.speed = 0;
						transfer.receivedBytes = 0;
						transfer.resumePosition = 0;
						delete transfer.error;
						transfer.state = XdccTransferState.requested;
						this.emit(XdccEvents.xdccRequested, transfer);
						return resolve(transfer);
					})
					.catch((err) => {
						if(!(err instanceof XdccError)) {
							const xdccError = new XdccError('start', 'unhandled error', transfer, err);
							//this.emit(XdccEvents.xdccError, xdccError);
							return reject(xdccError);
						}
						else {
							//this.emit(XdccEvents.xdccError, err);
							return reject(err);
						}
					})
					;
			};
			if(this.isConnected) {
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
	cancel(transfer: XdccTransfer): Promise<XdccTransfer> {
		if (transfer.state === XdccTransferState.canceled || transfer.state === XdccTransferState.completed) {
			return Promise.resolve(transfer);
		}
		if (transfer.state !== XdccTransferState.queued) {
			(this as any)[this.options.method](transfer.botNick || transfer.sender, this.options.cancelCommand);
		}
		else {
			(this as any)[this.options.method](transfer.botNick || transfer.sender, this.options.removeCommand + ' ' + transfer.packId);
		}
		transfer.state = XdccTransferState.canceled;
		if (transfer.progressIntervalId) {
			clearInterval(transfer.progressIntervalId as NodeJS.Timeout);
			transfer.progressIntervalId = null;
		}
		this.emit(XdccEvents.xdccCanceled, transfer);
		return Promise.resolve(transfer);
	}

}