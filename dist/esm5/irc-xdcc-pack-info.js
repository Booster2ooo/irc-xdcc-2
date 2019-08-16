"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Class representing an XDCC pack info.
 */
var XdccPackInfo = /** @class */ (function () {
    function XdccPackInfo(packInfo) {
        if (packInfo) {
            this.botNick = packInfo.botNick;
            this.packId = packInfo.packId;
            this.server = packInfo.server;
            this.fileName = packInfo.fileName;
            this.channel = packInfo.channel;
        }
    }
    return XdccPackInfo;
}());
exports.XdccPackInfo = XdccPackInfo;
//# sourceMappingURL=irc-xdcc-pack-info.js.map