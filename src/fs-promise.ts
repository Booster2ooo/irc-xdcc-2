import * as fs from 'fs';

export const statP = (filePath: fs.PathLike): Promise<fs.Stats> => new Promise((resolve, reject) => {
	fs.stat(filePath, (err, stats: fs.Stats) => {
		if(err) return reject(err);
		resolve(stats);
	});
});

export const renameP = (oldPath: fs.PathLike, newPath: fs.PathLike): Promise<void> => new Promise((resolve, reject) => {
	fs.rename(oldPath, newPath, (err) => {
		if(err) return reject(err);
		resolve();
	});
});

export const unlinkP = (filePath: fs.PathLike): Promise<void> => new Promise((resolve, reject) => {
	fs.unlink(filePath, (err) => {
		if(err) return reject(err);
		resolve();
	});
});