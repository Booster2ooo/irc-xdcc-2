"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const irc_xdcc_pack_info_1 = require("./irc-xdcc-pack-info");
const irc_xdcc_transfer_state_1 = require("./irc-xdcc-transfer-state");
/**
 * Class representing an XDCC transfer.
 * @extends XdccPackInfo
 */
class XdccTransfer extends irc_xdcc_pack_info_1.XdccPackInfo {
    constructor(packInfo) {
        super(packInfo);
        /**
         *  @property {XdccTransferState} state state of the transfer
         */
        this.state = irc_xdcc_transfer_state_1.XdccTransferState.pending;
        /**
         * @property {string[]} params parsed ctcp message
         */
        this.params = [];
        this.receivedBytes = 0;
        this.resumePosition = 0;
        this.progress = 0;
        this.speed = 0;
        this.params = [];
    }
}
exports.XdccTransfer = XdccTransfer;
//# sourceMappingURL=irc-xdcc-transfer.js.map