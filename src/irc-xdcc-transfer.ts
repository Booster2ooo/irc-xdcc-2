import { XdccPackInfo } from "./irc-xdcc-pack-info";
import { XdccTransferState } from "./irc-xdcc-transfer-state";
/**
 * Class representing an XDCC transfer.
 * @extends XdccPackInfo
 */
export class XdccTransfer extends XdccPackInfo {

	/**
	 *  @property {XdccTransferState} state state of the transfer
	 */
	state: XdccTransferState = XdccTransferState.pending;

	/**
	 * @property {number=} transferId index in the internal transfer pool
	 */
	transferId: number|undefined|null;

	/**
	 * @property {number=} resumePosition resume position when an incomplete file is found
	 */
	resumePosition: number|undefined|null;

	/**
	 * @property {number=} receivedBytes number of transfered bytes
	 */
	receivedBytes: number|undefined|null;

	/**
	 * @property {number=} progress transfer progression percentage
	 */
	progress: number|undefined|null;

	/**
	 * @property {number=} speed average transfer speed (bytes per second)
	 */
	speed: number|undefined|null;

	/**
	 * @property {number=} startedAt transfer beginning timestamp
	 */
	startedAt: [number,number]|undefined|null;

	/**
	 * @property {number=} duration transfer duration
	 */
	duration: [number,number]|undefined|null;

	/**
	 * @property {number=} progressIntervalId interval id for the task handling the transfer progression event firing
	 */
	progressIntervalId: NodeJS.Timeout|number|undefined|null;

	/**
	 * @property {string} lastCommand last xdcc command received
	 */
	lastCommand: string|undefined|null;

	/**
	 * @property {string} ip transfer server ip address
	 */
	ip: string|undefined|null;

	/**
	 * @property {number=} port transfer server port
	 */
	port: number|undefined|null;

	/**
	 * @property {number=} fileSize transfered file size
	 */
	fileSize: number|undefined|null;

	/**
	 * @property {string} location transfered file destination
	 */
	location: string|undefined|null;

	/**
	 * @property {string} sender ctcp message emitter (= server bot nick aka botNick)
	 */
	sender: string|undefined|null;

	/**
	 * @property {string} sender ctcp message recipient (= IRC client nick)
	 */
	target: string|undefined|null;

	/**
	 * @property {string} message ctcp message
	 */
	message: string|undefined|null;

	/**
	 * @property {string[]} params parsed ctcp message
	 */
	params: string[] = [];

	/**
	 * @property {any} error error message/transfer infos
	 */
	error: any;

	constructor(packInfo?: XdccPackInfo) {
		super(packInfo);
		this.receivedBytes = 0;
		this.resumePosition = 0;
		this.progress = 0;
		this.speed = 0;
		this.params = [];
	}

}