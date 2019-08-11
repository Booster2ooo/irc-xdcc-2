import { XdccTransferState } from "./irc-xdcc-transfer-state";

export class XdccPackInfo {

	/**
	 * @property {string} botNick nick of the bot serving the file
	 */
	botNick: string|undefined;
	
	/**
	 * @property {number=} packId id of the requested pack
	 */
	packId: number|string|undefined;

	/**
	 * @property {string} server IRC server
	 */
	server: string|undefined;

}