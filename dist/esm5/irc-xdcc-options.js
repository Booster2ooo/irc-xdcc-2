"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var XdccOptions = /** @class */ (function () {
    function XdccOptions() {
        this.userName = 'NodeJsXdcc';
        this.realName = 'Node JS XDCC Client by Booster2ooo';
        this.port = 6697;
        this.autoRejoin = true;
        this.autoConnect = true;
        this.channels = [];
        this.secure = true;
        this.selfSigned = true;
        this.certExpired = true;
        this.stripColors = true;
        this.encoding = 'UTF-8';
        // xdcc specific options
        this.progressInterval = 5;
        this.destPath = './dls';
        this.resume = false;
        this.acceptUnpooled = true;
        this.closeConnectionOnDisconnect = false;
        this.joinTopicChans = true;
        this.method = 'say';
        this.sendCommand = 'XDCC SEND';
        this.cancelCommand = 'XDCC CANCEL';
        this.removeCommand = 'XDCC REMOVE';
        this.dccParser = /DCC (\w+) ['"]?([\w\.\-\[\]_+ !\(\)]+?)['"]? (\d+|[\da-f:]+) (\d+) ?(\d+)?/;
        this.queuedParser = /queue for pack #?(\d+) \("(\.+)"\) in position/;
        this.sendParser = /sending( you)?( queued)? pack #?(\d+) \("(.+)"\)/i;
    }
    return XdccOptions;
}());
exports.XdccOptions = XdccOptions;
//# sourceMappingURL=irc-xdcc-options.js.map