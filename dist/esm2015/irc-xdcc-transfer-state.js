"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var XdccTransferState;
(function (XdccTransferState) {
    XdccTransferState[XdccTransferState["pending"] = 0] = "pending";
    XdccTransferState[XdccTransferState["requested"] = 1] = "requested";
    XdccTransferState[XdccTransferState["queued"] = 2] = "queued";
    XdccTransferState[XdccTransferState["started"] = 3] = "started";
    XdccTransferState[XdccTransferState["finished"] = 4] = "finished";
    XdccTransferState[XdccTransferState["cancelled"] = -1] = "cancelled";
})(XdccTransferState = exports.XdccTransferState || (exports.XdccTransferState = {}));
//# sourceMappingURL=irc-xdcc-transfer-state.js.map