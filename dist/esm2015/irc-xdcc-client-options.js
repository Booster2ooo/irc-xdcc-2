"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class XdccClientOptions {
    constructor() {
        /**
         * The IRC server to connect to
         */
        this.server = '';
        /**
         * The nick used by the client
         */
        this.nick = 'NodeJsXdcc';
        /**
         * The username used by the client
         */
        this.userName = 'NodeJsXdcc';
        /**
         * The real name used by the client
         */
        this.realName = 'Node JS XDCC Client by Booster2ooo';
        /**
         * The port to connecto to
         */
        this.port = 6697;
        /**
         * If true, the client tries rejoin the channel after being kicked out
         */
        this.autoRejoin = true;
        /**
         * If true, the client connects to the server automatically after instanciation
         */
        this.autoConnect = true;
        /**
         * The list of channels to join when connection to the server
         */
        this.channels = [];
        /**
         * If true, the client will use a secured connection when connecting to the server (SSL)
         */
        this.secure = true;
        /**
         * If true, the client accepts certificates from a non trusted CA
         */
        this.selfSigned = true;
        /**
         * If true, the client connects even if the ssl cert has expired.
         */
        this.certExpired = true;
        /**
         * If true, removes colors and effets from messages before parsing them
         */
        this.stripColors = true;
        /**
         * The encoding used by the client
         */
        this.encoding = 'UTF-8';
        // xdcc specific options
        /**
         * The numbers of seconds the progress event will be emitted
         */
        this.progressInterval = 5;
        /**
         * The downloads destination path
         */
        this.destPath = './dls';
        /**
         * If true, accepts to resume transfers
         */
        this.resume = false;
        /**
         * If true, accepts transfers that don't match any transfer pending in the pool
         */
        this.acceptUnpooled = true;
        /**
         * If true, disconnects active socket connections with the IRC client is disconnected or killed
         */
        this.closeConnectionOnCompleted = false;
        /**
         * If true, automatically joins the channels mentionned in the topics
         */
        this.joinTopicChans = true;
        /**
         * The method used to communicate with DCC bots (say (or msg, both are the same) or ctcp)
         */
        this.method = 'say';
        /**
         * The command used to initiate a DCC send
         */
        this.sendCommand = 'XDCC SEND';
        /**
         * The command used to cancel a DCC
         */
        this.cancelCommand = 'XDCC CANCEL';
        /**
         * The command used to remove a DCC
         */
        this.removeCommand = 'XDCC REMOVE';
        /**
         * The regular expression used to parse a DCC message from a bot
         */
        this.dccParser = /DCC (\w+) ['"]?([\w\.\-\[\]_+ !,\&\(\)#]+?)['"]? (\d+|[\da-f:]+) (\d+) ?(\d+)?/;
        /**
         * The regular expression used to parse a queued announce from a bot
         */
        this.queuedParser = /queue for pack #?(\d+) \("(.+)"\) in position/;
        /**
         * The regular expression used to parse a send announce from a bot
         */
        this.sendParser = /sending( you)?( queued)? pack #?(\d+) \("(.+)"\)/i;
        /**
         * The regular expression used as a replacement source for special characters in filenames
         */
        this.specialChars = /[\s']/g;
        /**
         * The alternative character to replace special characters in filenames
         */
        this.specialCharsAlternative = '_';
    }
}
exports.XdccClientOptions = XdccClientOptions;
//# sourceMappingURL=irc-xdcc-client-options.js.map