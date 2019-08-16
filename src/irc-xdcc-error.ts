import { XdccPackInfo } from "./irc-xdcc-pack-info";
import { XdccTransfer } from "./irc-xdcc-transfer";

export class XdccError {

    origin: string;
    target: XdccPackInfo|XdccTransfer|null|undefined;
    message: string;
    error: Error|any|null|undefined;
    extra: Error|any|null|undefined;

    constructor(origin: string, message: string, target?: XdccPackInfo|XdccTransfer|null, error?: Error|any|null, extra?: Error|any|null) {
        this.origin = origin;
        this.message = message;
        if (target) {
            this.target = target;
        }
        if (error) {
            this.error = error;
        }
        if (extra) {
            this.extra = extra;
        }
    }

}