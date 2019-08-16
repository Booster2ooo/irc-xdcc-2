"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var XdccError = /** @class */ (function () {
    function XdccError(origin, message, target, error, extra) {
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
    return XdccError;
}());
exports.XdccError = XdccError;
//# sourceMappingURL=irc-xdcc-error.js.map