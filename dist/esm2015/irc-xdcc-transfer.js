"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const irc_xdcc_pack_info_1 = require("./irc-xdcc-pack-info");
const irc_xdcc_transfer_state_1 = require("./irc-xdcc-transfer-state");
class XdccTransfer extends irc_xdcc_pack_info_1.XdccPackInfo {
    constructor(packInfo) {
        super();
        /**
         *  @property {XdccTransferState} state state of the transfer
         */
        this.state = irc_xdcc_transfer_state_1.XdccTransferState.pending;
        /**
         * @property {string[]} params parsed ctcp message
         */
        this.params = [];
        if (packInfo) {
            this.botNick = packInfo.botNick;
            this.packId = packInfo.packId;
            this.server = packInfo.server;
        }
    }
}
exports.XdccTransfer = XdccTransfer;
//# sourceMappingURL=irc-xdcc-transfer.js.map