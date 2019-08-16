import { XdccPackInfo } from "./irc-xdcc-pack-info";
import { XdccTransfer } from "./irc-xdcc-transfer";
export declare class XdccError {
    origin: string;
    target: XdccPackInfo | XdccTransfer | null | undefined;
    message: string;
    error: Error | any | null | undefined;
    extra: Error | any | null | undefined;
    constructor(origin: string, message: string, target?: XdccPackInfo | XdccTransfer | null, error?: Error | any | null, extra?: Error | any | null);
}
//# sourceMappingURL=irc-xdcc-error.d.ts.map