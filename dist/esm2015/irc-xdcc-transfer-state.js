"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Enum for XDCC transfer states
 * @enum
 */
var XdccTransferState;
(function (XdccTransferState) {
    XdccTransferState[XdccTransferState["canceled"] = -1] = "canceled";
    XdccTransferState[XdccTransferState["pending"] = 0] = "pending";
    XdccTransferState[XdccTransferState["requested"] = 1] = "requested";
    XdccTransferState[XdccTransferState["queued"] = 2] = "queued";
    XdccTransferState[XdccTransferState["started"] = 3] = "started";
    XdccTransferState[XdccTransferState["completed"] = 4] = "completed";
})(XdccTransferState = exports.XdccTransferState || (exports.XdccTransferState = {}));
//# sourceMappingURL=irc-xdcc-transfer-state.js.map