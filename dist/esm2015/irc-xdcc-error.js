"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class XdccError {
    constructor(origin, message, target, error, extra) {
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
exports.XdccError = XdccError;
//# sourceMappingURL=irc-xdcc-error.js.map