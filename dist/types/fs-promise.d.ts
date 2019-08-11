/// <reference types="node" />
import * as fs from 'fs';
export declare const statP: (filePath: fs.PathLike) => Promise<fs.Stats>;
export declare const renameP: (oldPath: fs.PathLike, newPath: fs.PathLike) => Promise<void>;
export declare const unlinkP: (filePath: fs.PathLike) => Promise<void>;
//# sourceMappingURL=fs-promise.d.ts.map