
declare module 'irc' {
	import { EventEmitter } from "events";
	import { Socket } from "net";
	export class Client extends EventEmitter {
		constructor(server: string, nick: string, options: any);
		conn: Socket;
		chans: any;
		nick: string;
		send(command: string, ...args: string[]): void;
		join(channel: string, callback: Function): void;
		join(part: string, message?: string|Function, callback?: Function): void;
		say(target: string, message: string): void;
		ctcp(target: string, type: string, text: string): void;
		action(target: string, message: string): void;
		notice(target: string, message: string): void;
		whois(nick: string, callback: Function): void;
		list(...args: string[]): void;
		connect(retryCount?: number|Function, callback?: Function): void;
		disconnect(message?: string|Function, callback?: Function): void;
		activateFloodProtection(interval?: number): void;
	}
}