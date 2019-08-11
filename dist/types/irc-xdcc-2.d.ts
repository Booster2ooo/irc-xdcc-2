import { Client } from 'irc';
import { XdccTransfer } from "./irc-xdcc-transfer";
import { XdccOptions } from "./irc-xdcc-options";
import { XdccPackInfo } from "./irc-xdcc-pack-info";
export declare class XdccClient extends Client {
    /**
     * @property {boolean} isConnected defines if the IRC client is connected and joined all the channels
     */
    isConnected: boolean;
    /**
     * @property {string} server IRC server address
     */
    server: string;
    /**
     * @property {XdccTransfer[]} transferPool list of transfers
     */
    private transferPool;
    /**
     * @property {number} lastIndex last index generated
     */
    private lastIndex;
    /**
     * @property {XdccOptions} options options
     */
    private options;
    constructor(server: string, nick: string, opt: XdccOptions);
    /**
     * Adds a transfer to the pool based on the provided xdcc pack info
     * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
     */
    addTransfer(packInfo: XdccPackInfo): Promise<XdccTransfer>;
    /**
     * Cancels the provided transfer
     * @param {XdccTransfer} xdccTransfer transfer instance
     */
    cancelTransfer(xdccTransfer: XdccTransfer): Promise<XdccTransfer>;
    /**
     * Cancels the transfer matching the provided xdcc pack info
     * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
     */
    cancelTransferByInfo(packInfo: XdccPackInfo): Promise<XdccTransfer>;
    /**
     * Cancels the transfer at the specified index in the transfer pool
     * @param {number} transferId transfer pool index
     */
    cancelTransferById(transferId: number): Promise<XdccTransfer>;
    /**
     * Returns the list of transfers
     */
    listTransfers(): Promise<XdccTransfer[]>;
    /**
     * Removes the provided transfer instance from the list
     * @param {XdccTransfer} xdccTransfer transfer instance
     */
    removeTransfer(xdccTransfer: XdccTransfer): Promise<XdccTransfer>;
    /**
     * Removes the transfer at the specified index in the transfer pool
     * @param {number} transferId transfer pool index
     */
    removeTransferById(transferId: number): Promise<XdccTransfer>;
    /**
     * Disconnects the IRC client
     * @param message disconnection message
     * @param callback function called after being disconnected
     */
    disconnect(message: string, callback: Function): void;
    /**
     * Handles when the client is fully registered on the IRC network
     * @param {string} message registration message
     */
    private registeredHandler;
    /**
     * Handles CTCP Version messages
     * @param {string} from CTCP emitter
     * @param {string} to CTCP recipient
     * @param {string} message raw CTCP message
     */
    private versionHandler;
    /**
     * Handles CTCP PrivMsg messages
     * @param {string} from CTCP emitter
     * @param {string} to CTCP recipient
     * @param {string} text CTCP content
     * @param {string} message raw CTCP message
     */
    private privCtcpHandler;
    /**
     * Handles notice messages
     * @param {string} from notice emitter
     * @param {string} to notice recipient
     * @param {string} text notice content
     * @param {string} message raw notice message
     */
    private noticeHandler;
    /**
     * Handles a disconnection
     * @param {string} nick disconnected nick
     * @param {string} reason disconnection reason
     * @param {string} channels emitting channels
     * @param {string} message raw disconnection message
     */
    private disconnectedHandler;
    /**
     * Handles topic messages (auto join channels mentioned in topics)
     * @param {string} channel channel emitting the topic
     * @param {string} topic topic content
     * @param {string|null} nick topic's author
     * @param {string} message raw topic message
     */
    private topicHandler;
    /**
     * Resume pooled transfers
     */
    private resume;
    /**
     * Cancels all transfers
     */
    private clear;
    /**
     * Searches matching transfers
     * @param {XdccTransfer} xdccTransfer the transfer info to filter the pool with
     */
    private search;
    /**
     * Creates a transfer instance based on the specified xdcc pack info
     * @param packInfo
     */
    private createTransfer;
    /**
     * Verifies if the destination file already exists and/or needs to be resume for the specified transfer
     * @param {XdccTransfer} transfer the transfer to verify
     */
    private validateTransferDestination;
    /**
     * Downloads the file from the serving bot fro the specified transfer
     * @param {XdccTransfer} transfer the transfer to download
     */
    private downloadFile;
    /**
     * Sends the start signal to the server bot for the specified transfer
     * @param {XdccTransfer} transfer the transfer to start
     */
    start(transfer: XdccTransfer): Promise<XdccTransfer>;
    /**
     * Sends the cancel signal to server bot for the specified transfer
     * @param {XdccTransfer} transfer teh transfer to cancel
     */
    cancel(transfer: XdccTransfer): Promise<XdccTransfer>;
}
//# sourceMappingURL=irc-xdcc-2.d.ts.map