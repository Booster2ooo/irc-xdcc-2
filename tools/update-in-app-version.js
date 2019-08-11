const package = require('./../package.json');
const fs = require('fs');
const versionDestination = './src/version.ts';
const versionContent = `export const version = '${package.name} v${package.version} - a Node.js xdcc client';`;

fs.writeFileSync(versionDestination, versionContent, { flag: 'w+' });