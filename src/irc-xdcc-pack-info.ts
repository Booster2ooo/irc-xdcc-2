import { XdccTransferState } from "./irc-xdcc-transfer-state";

/**
 * Class representing an XDCC pack info.
 */
export class XdccPackInfo {

	/**
	 * @property {string} botNick The nick of the bot serving the file
	 */
	botNick: string|undefined;
	
	/**
	 * @property {number=} packId The id of the requested pack
	 */
	packId: number|string|undefined;

	/**
	 * @property {string} server The IRC server
	 */
	server: string|undefined;

	/**
	 * @property {string} fileName The transfered file name
	 */
	fileName: string|undefined|null;

	/**
	 * @property {string} channel The channel to join
	 */
	channel: string|undefined|null;


	constructor(packInfo?: any) {
		if (packInfo) {
			this.botNick = packInfo.botNick;
			this.packId = packInfo.packId;
			this.server = packInfo.server;
			this.fileName = packInfo.fileName;
			this.channel = packInfo.channel;
		}
	}
}