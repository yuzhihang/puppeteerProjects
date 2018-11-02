exports.config = {
    queryTimeInterval: 5000, // 查询速度，单位（毫秒）
    log4js: {
        appenders: {
            everything: { type: 'file', filename: '.log',maxLogSize: 2000000, backups: 1, },
            console: { type: 'console' }
        },
        categories: {
            default: { appenders: [ 'everything', 'console' ], level: 'debug' }
        }
    }
};

