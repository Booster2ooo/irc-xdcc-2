import { Client } from 'irc';
import { XdccTransfer } from "./irc-xdcc-transfer";
import { XdccClientOptions } from "./irc-xdcc-client-options";
import { XdccPackInfo } from "./irc-xdcc-pack-info";
/**
 * Class representing an irc client with XDCC capabilities.
 * @extends irc.Client
 */
export declare class XdccClient extends Client {
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
    private lastIndex;
    /**
     * @property {XdccClientOptions} options The client options
     */
    private options;
    constructor(opt: XdccClientOptions);
    /**
     * Adds a transfer to the pool based on the provided xdcc pack info
     * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
     * @returns {Promise<XdccTransfer} A promise for the addedd XDCC transfer
     */
    addTransfer(packInfo: XdccPackInfo): Promise<XdccTransfer>;
    /**
     * Cancels the provided transfer
     * @param {XdccTransfer} xdccTransfer transfer instance
     * @returns {Promise<XdccTransfer} A promise for the canceled XDCC transfer
     */
    cancelTransfer(xdccTransfer: XdccTransfer): Promise<XdccTransfer>;
    /**
     * Cancels the transfer matching the provided xdcc pack info
     * @param {XdccPackInfo} packInfo xdcc bot nick and pack id
     * @returns {Promise<XdccTransfer} A promise for the canceled XDCC transfer
     */
    cancelTransferByInfo(packInfo: XdccPackInfo): Promise<XdccTransfer>;
    /**
     * Cancels the transfer at the specified index in the transfer pool
     * @param {number} transferId transfer pool index
     * @returns {Promise<XdccTransfer} A promise for the canceled XDCC transfer
     */
    cancelTransferById(transferId: number): Promise<XdccTransfer>;
    /**
     * Returns the list of transfers
     * @returns {XdccTransfer} A promise for the list of transfers in the pool
     */
    listTransfers(): Promise<XdccTransfer[]>;
    /**
     * Removes the provided transfer instance from the list
     * @param {XdccTransfer} xdccTransfer The transfer instance
     * @returns {Promise<XdccTransfer} A promise for the removed XDCC transfer
     */
    removeTransfer(xdccTransfer: XdccTransfer): Promise<XdccTransfer>;
    /**
     * Removes the transfer at the specified index in the transfer pool
     * @param {number} transferId The transfer pool index
     * @returns {Promise<XdccTransfer} A promise for the removed XDCC transfer
     */
    removeTransferById(transferId: number): Promise<XdccTransfer>;
    /**
     * Disconnects the IRC client and clears the transfer pool
     * @param message The disconnection message
     * @param callback The function called after being disconnected
     */
    disconnect(message?: string, callback?: Function): void;
    /**
     * Handles when the client is fully registered on the IRC network
     * @param {string} message The registration message
     */
    private registeredHandler;
    /**
     * Handles CTCP Version messages
     * @param {string} from The CTCP emitter
     * @param {string} to The CTCP recipient
     * @param {string} message The raw CTCP message
     */
    private versionHandler;
    /**
     * Handles CTCP PrivMsg messages
     * @param {string} from The CTCP emitter
     * @param {string} to The CTCP recipient
     * @param {string} text The CTCP content
     * @param {string} message The raw CTCP message
     */
    private privCtcpHandler;
    /**
     * Handles notice messages
     * @param {string} from The notice emitter
     * @param {string} to The notice recipient
     * @param {string} text The notice content
     * @param {string} message The raw notice message
     */
    private noticeHandler;
    /**
     * Handles a disconnection
     * @param {string} nick The disconnected nick
     * @param {string} reason The disconnection reason
     * @param {string} channels The emitting channels
     * @param {string} message The raw disconnection message
     */
    private disconnectedHandler;
    /**
     * Handles topic messages (auto join channels mentioned in topics)
     * @param {string} channel The channel emitting the topic
     * @param {string} topic The topic content
     * @param {string|null} nick The topic's author
     * @param {string} message The raw topic message
     */
    private topicHandler;
    /**
     * Handles error messages
     * @param {string} message The raw error message
     */
    private errorHandler;
    /**
     * Restarts pooled transfers
     * @returns {XdccTransfer} The restarted XDCC transfers
     */
    private restart;
    /**
     * Cancels all transfers and clears the pool
     * @returns {Promise<void>} An empty promise
     */
    private clear;
    /**
     * Searches matching transfers
     * @param {XdccTransfer} xdccTransfer The transfer info to filter the pool with
     * @returns {Promise<XdccTransfer[]>} A promise for matching XDCC transfers
     */
    private search;
    /**
     * Creates a transfer instance based on the specified xdcc pack info
     * @param packInfo
     * @returns {Promise<XdccTransfer[]>} The created XDCC transfers
     */
    private createTransfer;
    /**
     * Computes the location of the file on disk
     * @param {XdccTransfer} transfer The transfer to verify
     * @returns {Promise<XdccTransfer[]>} The inputed XDCC transfers
     */
    private computeTransferDestination;
    /**
     * Verifies if the destination file already exists and/or needs to be resume for the specified transfer
     * @param {XdccTransfer} transfer The transfer to verify
     * @returns {Promise<XdccTransfer[]>} The inputed XDCC transfers
     */
    private validateTransferDestination;
    /**
     * Downloads the file from the serving bot fro the specified transfer
     * @param {XdccTransfer} transfer The transfer to download
     * @returns {Promise<XdccTransfer[]>} The inputed XDCC transfers
     */
    private downloadFile;
    /**
     * Joins the channel assigned to the transfer if required
     * @param transfer The transfer to join the channel for
     * @returns {Promise<XdccTransfer[]>} A promise for the transfer the channel has been joined for
     */
    private joinTransferChannel;
    /**
     * Sends the start signal to the server bot for the specified transfer
     * @param {XdccTransfer} transfer The transfer to start
     * @returns {Promise<XdccTransfer[]>} A promise for the started XDCC transfers
     */
    start(transfer: XdccTransfer): Promise<XdccTransfer>;
    /**
     * Sends the cancel signal to server bot for the specified transfer
     * @param {XdccTransfer} transfer The transfer to cancel
     * @returns {Promise<XdccTransfer[]>} A promise for the canceled XDCC transfers
     */
    cancel(transfer: XdccTransfer): Promise<XdccTransfer>;
}
//# sourceMappingURL=irc-xdcc-2.d.ts.map