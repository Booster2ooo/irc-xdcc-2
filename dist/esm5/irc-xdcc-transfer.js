"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var irc_xdcc_pack_info_1 = require("./irc-xdcc-pack-info");
var irc_xdcc_transfer_state_1 = require("./irc-xdcc-transfer-state");
/**
 * Class representing an XDCC transfer.
 * @extends XdccPackInfo
 */
var XdccTransfer = /** @class */ (function (_super) {
    __extends(XdccTransfer, _super);
    function XdccTransfer(packInfo) {
        var _this = _super.call(this) || this;
        /**
         *  @property {XdccTransferState} state state of the transfer
         */
        _this.state = irc_xdcc_transfer_state_1.XdccTransferState.pending;
        /**
         * @property {string[]} params parsed ctcp message
         */
        _this.params = [];
        if (packInfo) {
            _this.botNick = packInfo.botNick;
            _this.packId = packInfo.packId;
            _this.server = packInfo.server;
            _this.fileName = packInfo.fileName;
        }
        _this.receivedBytes = 0;
        _this.resumePosition = 0;
        _this.progress = 0;
        _this.speed = 0;
        _this.params = [];
        return _this;
    }
    return XdccTransfer;
}(irc_xdcc_pack_info_1.XdccPackInfo));
exports.XdccTransfer = XdccTransfer;
//# sourceMappingURL=irc-xdcc-transfer.js.map