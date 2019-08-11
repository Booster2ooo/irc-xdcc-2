"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
exports.statP = function (filePath) { return new Promise(function (resolve, reject) {
    fs.stat(filePath, function (err, stats) {
        if (err)
            return reject(err);
        resolve(stats);
    });
}); };
exports.renameP = function (oldPath, newPath) { return new Promise(function (resolve, reject) {
    fs.rename(oldPath, newPath, function (err) {
        if (err)
            return reject(err);
        resolve();
    });
}); };
exports.unlinkP = function (filePath) { return new Promise(function (resolve, reject) {
    fs.unlink(filePath, function (err) {
        if (err)
            return reject(err);
        resolve();
    });
}); };
//# sourceMappingURL=fs-promise.js.map