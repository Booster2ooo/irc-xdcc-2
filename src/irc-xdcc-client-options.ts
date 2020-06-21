export class XdccClientOptions {
	/**
	 * The IRC server to connect to
	 */
	server: string = '';
	/**
	 * The nick used by the client
	 */
	nick: string = 'NodeJsXdcc';
	/**
	 * The username used by the client
	 */
	userName: string = 'NodeJsXdcc';
	/**
	 * The real name used by the client
	 */
	realName: string = 'Node JS XDCC Client by Booster2ooo';
	/**
	 * The port to connecto to
	 */
	port: number = 6697;
	/**
	 * If true, the client tries rejoin the channel after being kicked out
	 */
	autoRejoin: boolean = true;
	/**
	 * If true, the client connects to the server automatically after instanciation
	 */
	autoConnect: boolean = true;
	/**
	 * The list of channels to join when connection to the server
	 */
	channels: string[] = [];
	/**
	 * If true, the client will use a secured connection when connecting to the server (SSL)
	 */
	secure: boolean = true;
	/**
	 * If true, the client accepts certificates from a non trusted CA
	 */
	selfSigned: boolean = true;
	/**
	 * If true, the client connects even if the ssl cert has expired.
	 */
	certExpired: boolean = true;
	/**
	 * If true, removes colors and effets from messages before parsing them
	 */
	stripColors: boolean = true;
	/**
	 * The encoding used by the client
	 */
	encoding: string = 'UTF-8';
	// xdcc specific options
	/**
	 * The numbers of seconds the progress event will be emitted
	 */
	progressInterval: number = 5;
	/**
	 * The downloads destination path
	 */
	destPath: string = './dls';
	/**
	 * If true, accepts to resume transfers
	 */
	resume: boolean = false;
	/**
	 * If true, accepts transfers that don't match any transfer pending in the pool
	 */
	acceptUnpooled: boolean = true;
	/**
	 * If true, disconnects active socket connections with the IRC client is disconnected or killed
	 */
	closeConnectionOnCompleted: boolean = false;
	/**
	 * If true, automatically joins the channels mentionned in the topics
	 */
	joinTopicChans: boolean = true;
	/**
	 * The method used to communicate with DCC bots (say (or msg, both are the same) or ctcp)
	 */
	method: string = 'say';
	/**
	 * The command used to initiate a DCC send
	 */
	sendCommand: string = 'XDCC SEND';
	/**
	 * The command used to cancel a DCC
	 */
	cancelCommand: string = 'XDCC CANCEL';
	/**
	 * The command used to remove a DCC
	 */
	removeCommand: string = 'XDCC REMOVE';
	/**
	 * The regular expression used to parse a DCC message from a bot
	 */
	dccParser: RegExp = /DCC (\w+) ['"]?([\w\.\-\[\]_+ !,\&\(\)#]+?)['"]? (\d+|[\da-f:]+) (\d+) ?(\d+)?/ ;
	/**
	 * The regular expression used to parse a queued announce from a bot
	 */
	queuedParser: RegExp = /queue for pack #?(\d+) \("(.+)"\) in position/;
	/**
	 * The regular expression used to parse a send announce from a bot
	 */
	sendParser: RegExp = /sending( you)?( queued)? pack #?(\d+) \("(.+)"\)/i;
	/**
	 * The regular expression used as a replacement source for special characters in filenames
	 */
	specialChars: RegExp = /[\s']/g;
	/**
	 * The alternative character to replace special characters in filenames
	 */
	specialCharsAlternative: string = '_';
}