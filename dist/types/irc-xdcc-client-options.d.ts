export declare class XdccClientOptions {
    /**
     * The IRC server to connect to
     */
    server: string;
    /**
     * The nick used by the client
     */
    nick: string;
    /**
     * The username used by the client
     */
    userName: string;
    /**
     * The real name used by the client
     */
    realName: string;
    /**
     * The port to connecto to
     */
    port: number;
    /**
     * If true, the client tries rejoin the channel after being kicked out
     */
    autoRejoin: boolean;
    /**
     * If true, the client connects to the server automatically after instanciation
     */
    autoConnect: boolean;
    /**
     * The list of channels to join when connection to the server
     */
    channels: string[];
    /**
     * If true, the client will use a secured connection when connecting to the server (SSL)
     */
    secure: boolean;
    /**
     * If true, the client accepts certificates from a non trusted CA
     */
    selfSigned: boolean;
    /**
     * If true, the client connects even if the ssl cert has expired.
     */
    certExpired: boolean;
    /**
     * If true, removes colors and effets from messages before parsing them
     */
    stripColors: boolean;
    /**
     * The encoding used by the client
     */
    encoding: string;
    /**
     * The numbers of seconds the progress event will be emitted
     */
    progressInterval: number;
    /**
     * The downloads destination path
     */
    destPath: string;
    /**
     * If true, accepts to resume transfers
     */
    resume: boolean;
    /**
     * If true, accepts transfers that don't match any transfer pending in the pool
     */
    acceptUnpooled: boolean;
    /**
     * If true, disconnects from IRC after a transfer is done
     */
    closeConnectionOnCompleted: boolean;
    /**
     * If true, automatically joins the channels mentionned in the topics
     */
    joinTopicChans: boolean;
    /**
     * The method used to communicate with DCC bots (say (or msg, both are the same) or ctcp)
     */
    method: string;
    /**
     * The command used to initiate a DCC send
     */
    sendCommand: string;
    /**
     * The command used to cancel a DCC
     */
    cancelCommand: string;
    /**
     * The command used to remove a DCC
     */
    removeCommand: string;
    /**
     * The regular expression used to parse a DCC message from a bot
     */
    dccParser: RegExp;
    /**
     * The regular expression used to parse a queued announce from a bot
     */
    queuedParser: RegExp;
    /**
     * The regular expression used to parse a send announce from a bot
     */
    sendParser: RegExp;
}
//# sourceMappingURL=irc-xdcc-client-options.d.ts.map