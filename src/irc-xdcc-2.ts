import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import { Client } from 'irc';
import { statP, renameP, unlinkP } from './fs-promise';
//import { promises as fsp } from 'fs'; // experimental ...
import * as ircXdccEvents from './irc-xdcc-events';
import { XdccTransfer } from "./irc-xdcc-transfer";
import { XdccClientOptions } from "./irc-xdcc-options";
import { XdccPackInfo } from "./irc-xdcc-pack-info";
import { XdccTransferState } from "./irc-xdcc-transfer-state";
import { XdccMessage } from './irc-xdcc-message';
import { converter } from './converter';
import { version } from './version';

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
	private transferPool: XdccTransfer[];

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
		this.on(ircXdccEvents.ircRegistered, this.registeredHandler)
			.on(ircXdccEvents.ircCtcpVersion, this.versionHandler)
			.on(ircXdccEvents.ircCtcpPrivmsg, this.privCtcpHandler)
			.on(ircXdccEvents.ircNotice, this.noticeHandler)
			.on(ircXdccEvents.ircQuit, this.disconnectedHandler)
			.on(ircXdccEvents.ircKill, this.disconnectedHandler)
			;
		if (options.joinTopicChans) {
			this.on(ircXdccEvents.ircTopic, this.topicHandler);
		}
	}

	/**
	 * Adds a transfer to the pool based on the provided xdcc pack info
	 * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
	 * @returns {Promise<XdccTransfer} A promise for the addedd XDCC transfer
	 */
	addTransfer(packInfo: XdccPackInfo): Promise<XdccTransfer> {
		if (!packInfo.botNick) {
			this.emit(ircXdccEvents.xdccError, 'botNick not provided');
			return Promise.reject({ code: ircXdccEvents.xdccError, message: 'botNick not provided'});
		}
		if(!packInfo.packId) {
			this.emit(ircXdccEvents.xdccError, 'packId not provided');
			return Promise.reject({ code: ircXdccEvents.xdccError, message: 'packId not provided'});
		}
		packInfo.server = this.server;
		return this.search(packInfo as XdccTransfer)
			.then((transfers: XdccTransfer[]) => {
				if (transfers.length) {
					return Promise.reject({ code: ircXdccEvents.xdccError, message: 'required pack already in pool', id: transfers[0].transferId});
				}
				return this.createTransfer(packInfo);
			})
			.then((transfer) => {
				this.emit(ircXdccEvents.xdccCreated, transfer);
				return this.start(transfer);
			})
			.catch((err) => this.emit(ircXdccEvents.xdccError, err));
	}

	/**
	 * Cancels the provided transfer
	 * @param {XdccTransfer} xdccTransfer transfer instance
	 * @returns {Promise<XdccTransfer} A promise for the cancelled XDCC transfer
	 */
	cancelTransfer(xdccTransfer: XdccTransfer): Promise<XdccTransfer> {
		if (xdccTransfer.transferId) {
			return this.cancelTransferById(xdccTransfer.transferId);
		}
		return this.search(xdccTransfer)
			.then((transfers: XdccTransfer[]) => {
				if (!transfers ||!transfers.length) {
					return Promise.reject(`Unable to remove the specified transfer, not found.`);
				}
				return this.cancelTransferById(transfers[0].transferId as number);
			});
	}

	/**
	 * Cancels the transfer matching the provided xdcc pack info
	 * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
	 * @returns {Promise<XdccTransfer} A promise for the cancelled XDCC transfer
	 */
	cancelTransferByInfo(packInfo: XdccPackInfo): Promise<XdccTransfer> {
		return this.search({ botNick: packInfo.botNick, packId: packInfo.packId } as XdccTransfer)
			.then((transfers: XdccTransfer[]) => {
				if (!transfers ||!transfers.length) {
					return Promise.reject(`Unable to remove the specified transfer, not found.`);
				}
				return this.cancelTransferById(transfers[0].transferId as number);
			});
	}

	/**
	 * Cancels the transfer at the specified index in the transfer pool
	 * @param {number} transferId transfer pool index
	 * @returns {Promise<XdccTransfer} A promise for the cancelled XDCC transfer
	 */
	cancelTransferById(transferId: number): Promise<XdccTransfer> {
		return this.search({ transferId } as XdccTransfer)
			.then((transfers: XdccTransfer[]) => {
				if (!transfers ||!transfers.length) {
					return Promise.reject(`Unable to remove transfer with id ${transferId}, not found.`);
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
	 * @returns {Promise<XdccTransfer} A promise for the removed XDCC transfer
	 */
	removeTransfer(xdccTransfer: XdccTransfer): Promise<XdccTransfer> {
		if (xdccTransfer.transferId) {
			return this.removeTransferById(xdccTransfer.transferId);
		}
		return this.search(xdccTransfer)
			.then((transfers: XdccTransfer[]) => {
				if (!transfers ||!transfers.length) {
					return Promise.reject(`Unable to remove the specified transfer, not found.`);
				}
				return this.removeTransferById(transfers[0].transferId as number);
			});
	}

	/**
	 * Removes the transfer at the specified index in the transfer pool
	 * @param {number} transferId The transfer pool index
	 * @returns {Promise<XdccTransfer} A promise for the removed XDCC transfer
	 */
	removeTransferById(transferId: number): Promise<XdccTransfer> {
		return this.cancelTransferById(transferId)
			.then((transfer: XdccTransfer) => {
				const index = this.transferPool.indexOf(transfer);
				this.transferPool.splice(index, 1);
				this.emit(ircXdccEvents.xdccRemoved, transfer);
				return Promise.resolve(transfer);
			});
	}

	/**
	 * Disconnects the IRC client
	 * @param message The disconnection message
	 * @param callback The function called after being disconnected
	 */
	disconnect(message: string, callback: Function): void {
		message = message || version;
		this.emit(ircXdccEvents.ircQuit, this.nick, message, Object.keys(this.chans), null);
		this.clear()
			.catch((err) => this.emit(ircXdccEvents.ircError, err))
			.then(() => Client.disconnect.call(this, message, callback))
			;		
	}

	/**
	 * Handles when the client is fully registered on the IRC network
	 * @param {string} message The registration message
	 */
	private registeredHandler(message: string): void {
		const channelRejoinedQueue: Promise<string>[] = this.options.channels.map((chan) => new Promise((resolve, reject) => {
			this.once(ircXdccEvents.ircJoin+chan.toLowerCase(), (nick: string, message: string) => {
				if(nick == this.nick) {
					resolve(chan);
				}
			});
		}));
		Promise.all(channelRejoinedQueue)
			.then((channels: string[]) => {
				this.isConnected = true;
				this.emit(ircXdccEvents.ircConnected, channels);
				/* Used .once instead of .on, no need to remove the listeners anymore
				this.options.channels.forEach((chan) => {
					this.removeAllListeners(ircXdccEvents.ircJoin+chan.toLowerCase());
				});*/
				return this.resume();
			})
			.catch((err) => this.emit(ircXdccEvents.ircError, err));
	}

	/**
	 * Handles CTCP Version messages
	 * @param {string} from The CTCP emitter
	 * @param {string} to The CTCP recipient
	 * @param {string} message The raw CTCP message
	 */
	private versionHandler(from: string, to: string, message: string): void {
		this.ctcp(from, 'normal', 'VERSION ' + version);
	}
	
	/**
	 * Handles CTCP PrivMsg messages
	 * @param {string} from The CTCP emitter
	 * @param {string} to The CTCP recipient
	 * @param {string} text The CTCP content
	 * @param {string} message The raw CTCP message
	 */
	private privCtcpHandler(from: string, to: string, text: string, message: string): void {
		if (to !== this.nick
		 || !text
		 || text.substr(0, 4) !== 'DCC '
		) {
			this.emit(ircXdccEvents.xdccError, { error: 'not a DCC message', message: message })
			return;
		}
		const parsedMessage: RegExpMatchArray | null = text.match(this.options.dccParser);
		if (!parsedMessage || !parsedMessage.length) {
			this.emit(ircXdccEvents.xdccError, { error: 'unable to parse DCC message', message: message })
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
						if (transfers[0].state === XdccTransferState.completed) {
							return Promise.reject('transfer already finished');
						}
						return Promise.resolve(transfers[0]);
					}
					else if (!this.options.acceptUnpooled) {
						return Promise.reject('unintended transfer');
					}
					return this.createTransfer({ botNick: xdccMessage.sender, packId: -1} as XdccPackInfo);
				})
				.then((transfer: XdccTransfer) => {
					const separator = path.sep.replace('\\\\','\\');
					transfer.sender = xdccMessage.sender;
					transfer.target = xdccMessage.target;
					transfer.message = xdccMessage.message;
					transfer.params = xdccMessage.params;
					transfer.lastCommand = xdccMessage.params[1].toUpperCase();
					if (transfer.lastCommand === 'SEND') {
						transfer.fileName = xdccMessage.params[2];
						transfer.location = this.options.destPath
							+ (this.options.destPath.substr(-1, 1) === separator ? '' : separator)
							+ transfer.fileName
							;
						transfer.ip = converter.intToIp(xdccMessage.params[3]);
						transfer.port = parseInt(xdccMessage.params[4], 10);
						transfer.fileSize = parseInt(xdccMessage.params[5], 10);
						return this.validateTransferDestination(transfer);
					}
					else if (transfer.lastCommand === 'ACCEPT'
						&& transfer.fileName === xdccMessage.params[2]
						&& transfer.port === parseInt(xdccMessage.params[3], 10)
						&& transfer.resumePosition === parseInt(xdccMessage.params[4], 10)
					) {
						return Promise.resolve(transfer);
					}
					else {
						return Promise.reject(`unknown/invalid command '${transfer.lastCommand}'`);
					}
				})
				.then(this.downloadFile.bind(this))
				.catch(err => this.emit(ircXdccEvents.xdccError, err))
		, 2000);
	}

	/**
	 * Handles notice messages
	 * @param {string} from The notice emitter
	 * @param {string} to The notice recipient
	 * @param {string} text The notice content
	 * @param {string} message The raw notice message
	 */
	private noticeHandler(from: string,to: string, text: string, message: string): void {
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
							this.emit(ircXdccEvents.xdccQueued, transfer);
						}
					});
				})
				.catch(err => this.emit(ircXdccEvents.xdccError, err));
		}
	}

	/**
	 * Handles a disconnection
	 * @param {string} nick The disconnected nick
	 * @param {string} reason The disconnection reason
	 * @param {string} channels The emitting channels
	 * @param {string} message The raw disconnection message
	 */
	private disconnectedHandler(nick: string, reason: string, channels: string, message: string): void {
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
	private topicHandler(channel: string, topic: string, nick: string, message: string): void {
		topic
			.split(' ')
			.filter((part) => part[0]=='#')
			.forEach((chan) => {
				this.join(chan);
			});
	}

	/**
	 * Resume pooled transfers
	 * @returns {XdccTransfer} The resumed XDCC transfers
	 */
	private resume(): Promise<XdccTransfer[]> {
		return this.search({ state: XdccTransferState.pending } as XdccTransfer)
			.then((transfers: XdccTransfer[]) => Promise.all(
					transfers.map(transfer => this.start(transfer)
				)
			));
	}

	/**
	 * Cancels all transfers and clears the pool
	 * @returns {Promise<void>} An empty promise
	 */
	private clear(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.transferPool.forEach(transfer => this.cancel(transfer));
			this.transferPool = [];
			return resolve();
		});
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
		return Promise.resolve(transfer);
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
					return Promise.reject('file with the same size already exists');
				}
				return statP(partLocation)
					.catch((err: any) => {
						return Promise.resolve(new fs.Stats());
					});
			})
			.then((stats: fs.Stats) => {
				if (stats.isFile() && stats.size === transfer.fileSize) {
					return renameP(partLocation, transfer.location as fs.PathLike)
						.then(() => Promise.reject('file with the same size already exists'));
				}
				else if (!stats.size) {
					return Promise.resolve(transfer);
				}
				else if (this.options.resume) {
					transfer.resumePosition = stats.size;
					this.ctcp(transfer.botNick, 'privmsg', `DCC RESUME ${transfer.fileName} ${transfer.port} ${transfer.resumePosition}`);
					return Promise.reject('transfer should be resumed');
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
			if (transfer.state === XdccTransferState.completed || transfer.state === XdccTransferState.cancelled) {
				return reject('transfer aborted: transfer already finished or cancelled');
			}
			const partLocation: fs.PathLike = transfer.location + '.part' as fs.PathLike;
			const writeStream: fs.WriteStream = fs.createWriteStream(partLocation, { flags: 'a' });
			const sendBuffer: Buffer = Buffer.alloc(4);
			let received: number = transfer.resumePosition || 0;
			let ack: number = transfer.resumePosition || 0;
			let socket: net.Socket;
			const disconnectedHandler: Function = (nick: string, reason: string, channels: string[], message: string) => {
				if (nick === this.nick) {
					writeStream.end();
					socket && socket.destroy();
					transfer.error = 'transfer aborted: irc client disconnected';
					return reject('transfer aborted: irc client disconnected');
				}
			};
			if (this.options.closeConnectionOnCompleted) {
				this.once(ircXdccEvents.ircQuit, disconnectedHandler);
				this.once(ircXdccEvents.ircKill, disconnectedHandler);
			}
			writeStream.on('open', () => {
				socket = net.createConnection(transfer.port as number, transfer.ip as string, () => {
					transfer.state = XdccTransferState.started;
					this.emit(ircXdccEvents.xdccStarted, transfer);
					transfer.progressIntervalId = setInterval(() => {
						this.emit(ircXdccEvents.xdccProgress, transfer, received);
					}, this.options.progressInterval*1000);
					transfer.startedAt = process.hrtime();
					this.emit(ircXdccEvents.xdccConnect, transfer);
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
						if (this.rawListeners(ircXdccEvents.ircQuit).indexOf(disconnectedHandler) > -1 ) {
							this.removeListener(ircXdccEvents.ircQuit, disconnectedHandler);
						}
						if (this.rawListeners(ircXdccEvents.ircKill).indexOf(disconnectedHandler) > -1 ) {
							this.removeListener(ircXdccEvents.ircKill, disconnectedHandler);
						}
					}
					// Connection closed
					if (received == transfer.fileSize) {
						// download complete
						renameP(transfer.location + '.part', transfer.location as fs.PathLike)
							.then(() => {
								transfer.state = XdccTransferState.completed;
								this.emit(ircXdccEvents.xdccComplete, transfer);
								resolve(transfer);
							})
							.catch((err) => {
								transfer.error = err;
								reject(transfer);
							});
					} 
					else if (received != transfer.fileSize && transfer.state !== XdccTransferState.completed) {
						// download incomplete
						transfer.state = XdccTransferState.cancelled; // create a "failed" status?
						if (!socketError) {
							transfer.error = 'server unexpected closed connection';
						}
						else {
							transfer.error = socketError;
						}
						this.emit(ircXdccEvents.xdccDlError, transfer);
						reject(transfer);
					} 
					else if (received != transfer.fileSize && transfer.state === XdccTransferState.completed) {
						// download aborted
						transfer.state = XdccTransferState.cancelled; // create a "failed" status?
						if (!socketError) {
							transfer.error = 'server closed connection, download canceled';
						}
						else {
							transfer.error = socketError;
						}
						this.emit(ircXdccEvents.xdccDlError, transfer);
						reject(transfer);
					}
				};
				socket.on('end', socketEndHandler);
				socket.on('error', socketEndHandler);
			});
			writeStream.on('error', (err) => {
				writeStream.end();
				socket && socket.destroy();
				transfer.error = err;
				this.emit(ircXdccEvents.xdccDlError, transfer);
				reject(`write stream error: ${err.toString()}`);
			});
		});
	}

	/**
	 * Sends the start signal to the server bot for the specified transfer
	 * @param {XdccTransfer} transfer The transfer to start
	 * @returns {Promise<XdccTransfer[]>} The stater XDCC transfers
	 */
	start(transfer: XdccTransfer): Promise<XdccTransfer> {
		return new Promise((resolve, reject) => {
			const s: Function = () => {
				this[this.options.method](transfer.botNick, this.options.sendCommand + ' ' + transfer.packId);
				transfer.state = XdccTransferState.requested;
				this.emit(ircXdccEvents.xdccRequested, transfer);
				return resolve(transfer);
			};
			if(this.isConnected) {
				s();
			}
			else {
				this.once(ircXdccEvents.ircConnected, s);
			}
		});
	}

	/**
	 * Sends the cancel signal to server bot for the specified transfer
	 * @param {XdccTransfer} transfer The transfer to cancel
	 * @returns {Promise<XdccTransfer[]>} The cancelled XDCC transfers
	 */
	cancel(transfer: XdccTransfer): Promise<XdccTransfer> {
		if (transfer.state === XdccTransferState.cancelled || transfer.state === XdccTransferState.completed) {
			return Promise.resolve(transfer);
		}
		if (transfer.state === XdccTransferState.queued) {
			this[this.options.method](transfer.botNick || transfer.sender, this.options.cancelCommand);
		}
		else {
			this[this.options.method](transfer.botNick || transfer.sender, this.options.removeCommand + ' ' + transfer.packId);
		}
		transfer.state = XdccTransferState.cancelled;
		if (transfer.progressIntervalId) {
			clearInterval(transfer.progressIntervalId as NodeJS.Timeout);
			transfer.progressIntervalId = null;
		}
		this.emit(ircXdccEvents.xdccCanceled, transfer);
		return Promise.resolve(transfer);
	}

}