"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
exports.statP = (filePath) => new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
        if (err)
            return reject(err);
        resolve(stats);
    });
});
exports.renameP = (oldPath, newPath) => new Promise((resolve, reject) => {
    fs.rename(oldPath, newPath, (err) => {
        if (err)
            return reject(err);
        resolve();
    });
});
exports.unlinkP = (filePath) => new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
        if (err)
            return reject(err);
        resolve();
    });
});
//# sourceMappingURL=fs-promise.js.map