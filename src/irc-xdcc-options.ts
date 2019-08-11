export class XdccOptions {
	userName: string = 'NodeJsXdcc';
	realName: string = 'Node JS XDCC Client by Booster2ooo';
	port: number = 6697;
	autoRejoin: boolean = true;
	autoConnect: boolean = true;
	channels: string[] = [];
	secure: boolean = true;
	selfSigned: boolean = true;
	certExpired: boolean = true;
	stripColors: boolean = true;
	encoding: string = 'UTF-8';
	// xdcc specific options
	progressInterval: number = 5;
	destPath: string = './dls';
	resume: boolean = false;
	acceptUnpooled: boolean = true;
	closeConnectionOnDisconnect: boolean = false;
	joinTopicChans: boolean = true;
	method: string = 'say';
	sendCommand: string = 'XDCC SEND';
	cancelCommand: string = 'XDCC CANCEL';
	removeCommand: string = 'XDCC REMOVE';
	dccParser: RegExp = /DCC (\w+) ['"]?([\w\.\-\[\]_+ !\(\)]+?)['"]? (\d+|[\da-f:]+) (\d+) ?(\d+)?/ ;
	queuedParser: RegExp = /queue for pack #?(\d+) \("(\.+)"\) in position/;
	sendParser: RegExp = /sending( you)?( queued)? pack #?(\d+) \("(.+)"\)/i;

}