const path = require('path');
exports.config = {
    queryTimeInterval: 3000, // 查询速度，单位（毫秒）
    log4js: {
        appenders: {
            everything: { type: 'file', filename: '.log',maxLogSize: 2000000, backups: 1, },
            console: { type: 'console' }
        },
        categories: {
            default: { appenders: [ 'everything', 'console' ], level: 'debug' }
        }
    },
    executablePath: {
    win32: path.join(__dirname, '../tools/chrome-win-594312/chrome'),
    win64: path.join(__dirname, '../node_modules/puppeteer/.local-chromium/win64-594312/chrome-win/chrome'),
    mac: path.join(__dirname, '../node_modules/puppeteer/.local-chromium/mac-594312/chrome-mac/Chromium.app/Contents/MacOS/Chromium')
    }
};

