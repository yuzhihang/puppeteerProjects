const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const path = require('path');
const fs = require('fs');
const log4js = require('log4js');
const logger = log4js.getLogger();

const {config} = require('./config.js');

const billTypeMap = {
    '02': 'call',
    '03': 'sms'
};

const lineTitles = {
    'sms': '起始时间,通信地点,对方号码,通信方式,信息类型\n',
    'call': '起始时间,通信地点,对方号码,通信方式,通信类型,通信时长\n'
};
const lineFields = {
    'sms': ['startTime', 'commPlac', 'anotherNm', 'commMode', 'infoType'],
    'call': ['startTime', 'commPlac', 'anotherNm', 'commMode', 'commType', 'commTime']
};

// let queriedData = {
//     'sms': {records: []},
//     'call': {records: []}
// };
const options = {
    windowWidth: 1280,
    windowHeight: 1024
};
// const searchUrl = 'file:///Users/Rossonero/Desktop/jy.htm';
const searchUrl = 'https://shop.10086.cn/i/?f=billdetailqry';
const executablePath = {
    win32: path.join(__dirname, '../node_modules/puppeteer/.local-chromium/win-594312/chrome-win/chrome'),
    win64: path.join(__dirname, '../node_modules/puppeteer/.local-chromium/win64-594312/chrome-win/chrome'),
    mac: path.join(__dirname, '../node_modules/puppeteer/.local-chromium/mac-594312/chrome-mac/Chromium.app/Contents/MacOS/Chromium')
};

let page, queryData, monthData = [], allData = {}, totalNum, loginNumber, type,
    trace = {version: 1, sms: {date: '0', cursor: 1}, call: {date: '0', cursor: 1}};

const cmCrawler = async function () {
    await init();

    // const l = await page.waitForSelector('#dropdownMenu2');
    // logger.info(await page.evaluate(el => el.innerText, l));
    const loginBtn = await page.waitForSelector('#login-btn');
    loginBtn.click();
    let detailRequest, jsonpFunction;
    await page.waitForSelector('table.ui-dialog-grid', {hidden: false, timeout: 0});//登录框
    await page.waitForSelector('table.ui-dialog-grid', {hidden: true, timeout: 0});
    await page.waitForSelector('#switch-data');// 类型菜单栏

    const smsBtn = await page.$('[eventcode=UCenter_billdetailqry_type_DCXD]');
    const callBtn = await page.$('[eventcode=UCenter_billdetailqry_type_THXD]');
    smsBtn.recordType = 'sms';
    callBtn.recordType = 'call';
    // await smsBtn.click();
    // await textBtn.click();

    // await page.waitForSelector('#show_vec_firstdiv');
    const loginNumberEl = (await page.waitForSelector('.loginStr', {timeout: 0}));
    loginNumber = await page.evaluate(el => el.innerText, loginNumberEl);
    await page.evaluate(() => {
        window.loginStatus = true
    });

    logger.level = 'debug';
    config.log4js.appenders.everything.filename = `${loginNumber}/${loginNumber}.log`;
    log4js.configure(config.log4js);
    logger.info('-----------start logging-------------\n');
    logger.info(loginNumber);

    initTrace(loginNumber);
    await page.waitFor(1000);
    const queryTypeList = [];
    queryTypeList.push(smsBtn);
    queryTypeList.push(callBtn);
    const monthList = await page.$$('#month-data li');
    monthList.reverse();
    for (let query of queryTypeList) {
        queryData = [];

        for (let monthLi of monthList) {
            page.evaluate(el => el.setAttribute('class', ''), monthLi);
        }
        await page.waitFor(1000);
        await query.click();
        // page.waitForSelector('#tmpl-data img');
        type = query.recordType;
        //init file
        const date = new Date();
        const [y, m, d, t] = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getTime()];

        const filename = `${loginNumber}/${type}_${y}.${m}.${d}_${t}.csv`;
        if (fs.existsSync(filename)) {
            fs.unlinkSync(filename);
        }

        for (let monthLi of monthList) {
            monthData = [];
            totalNum = 0;

            const month = await page.evaluate(el => el.getAttribute('v'), monthLi);
            // logger.info(month,trace[ty[]])
            if (month < trace[type].date) continue;
            trace[type].date = month;
            //todo remove activate
            await monthLi.click();
            logger.info('1.0 init month :', type, month, monthData.length, totalNum);
            await page.waitForResponse((response => {
                if (response.url().indexOf('detailbillinfojsonp') !== -1) {
                    logger.info('1.1 month waitfor response:', response.url());
                    return true
                }
            }), {timeout: 0}); // to do
            await page.waitFor(3000);
            let pageDiv;
            // try {
            pageDiv = await page.$('#page-demo');
            // }catch(e){
            //     continue;
            // }
            logger.info('1.2 waiting for login');
            await page.waitForFunction(() => window.loginStatus === true, {timeout: 0});
            await page.screenshot({path: `${loginNumber}/screenshots/${type}_${month}.png`, fullPage: true});
            // const notes2 = await page.waitForSelector('#notes2', {timeout: 0});
            // const pageInfo = await pageDiv.$evaluate('#notes1', el => el.innerText);

            // let totalNum = await page.evaluate(el => el.innerText, notes2);
            // totalNum = /\d+/.exec(totalNum)[0];

            while (totalNum > trace[type].cursor) {
                logger.info('2.1 in loop, month data length: ', monthData.length, ' total: ', totalNum);
                logger.info('wait for login diag to disappear');
                await page.waitForSelector('#show_vec_firstdiv', {hidden: true, timeout: 0});
                logger.info('wait for login in');
                await page.waitForFunction(() => window.loginStatus === true, {timeout: 0});
                const nextPage = Math.floor(monthData.length / 50) + 1;
                logger.info('nextpage ', nextPage);
                const input = await pageDiv.$('input');
                await page.evaluate((el) => {
                    el.value = ''
                }, input);
                await input.type(String(nextPage));
                const search = await pageDiv.$('.gs-search');
                await page.evaluate(() => document.querySelector('#div_easy_entry') && document.querySelector('#div_easy_entry').remove());
                await search.click();
                logger.info(`2.2 wait for ${nextPage} page response`);

                await page.waitForResponse((response => {
                    if (response.url().indexOf('detailbillinfojsonp') !== -1) {
                        logger.info('2.3 page waitfor response:', response.url());
                        return true
                    }
                }), {timeout: 0}); // to do
                await page.waitFor(3000);

                // let text = await res.text();
                // let results = JSON.parse(text.substring(text.indexOf('(') + 1, text.lastIndexOf(')')));
            }
            logger.info('3.1 ' + month);
            logger.info(monthData.length);
            queryData = queryData.concat(monthData);
            writeData(filename, monthData, type);
            logger.info('queryDdata:', queryData.length);


        }


        allData[query.recordType] = queryData;
    }
};

function writeData(filename, data, type) {


    let fd = fs.openSync(filename, 'a+');
    fs.appendFileSync(fd, lineTitles[type]);

    for (let d of data) {
        let fields = lineFields[type];
        fields = fields.map((item) => {
            return d[item]
        });
        const line = fields.toString() + '\r\n';
        fs.appendFileSync(fd, line);
    }
    fs.closeSync(fd);
}

const init = async () => {
    const browser = await puppeteer.launch({
        executablePath: executablePath.mac,
        headless: false, ignoreHTTPSErrors: true,
        // slowMo: 100,
        args: [
            `--window-size=${options.windowWidth}, ${options.windowHeight}`]
    });
    page = (await browser.pages())[0];

    await page.setViewport({
        width: options.windowWidth,
        height: options.windowHeight
    });
    // await page.screenshot({path: 'full.png', fullPage: true});
    await page.setRequestInterception(true);
    page.on('request', requestInterceptor);

    page.on('response', responseParser);

    await page.goto(searchUrl, {waitUntil: 'domcontentloaded'});
    await page.evaluate(() => {
        loginStatus = false;
    })

};

function initTrace(path) {
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
        fs.mkdirSync(path + '/screenshots');
    }
    if (!fs.existsSync(`${path}/trace.txt`)) {
        let fd = fs.openSync(`${path}/trace.txt`, 'w');
        fs.writeFileSync(fd, JSON.stringify(trace) + ';');
    } else {
        let fd = fs.openSync(`${path}/trace.txt`, 'r');
        let content = fs.readFileSync(fd, 'utf8');
        content = content.substring(0, content.indexOf(';'));
        trace = JSON.parse(content);
    }
}

const requestInterceptor = interceptedRequest => {
    let url = interceptedRequest.url();
    let queryMap = {};
    if (url.indexOf('detailbillinfojsonp') !== -1) {
        const querystr = url.substr(url.indexOf('?') + 1);
        const queries = querystr.split('&');
        queries.forEach(query => {
            const q = query.split('=');
            if (q.length === 2) {
                queryMap[q[0]] = q[1];
            }
        });
        const billType = billTypeMap[queryMap['billType']];

        url = url.replace(/step=\d+/, 'step=200').replace(/curCuror=\d+/, `curCuror=${trace[type].cursor}`);
        // detailRequest = interceptedRequest.url();
        logger.info('request url:', url);
    }
    interceptedRequest.continue({url});

};

const responseParser = async response => {
    const url = response.url();
    if (url.indexOf('detailbillinfojsonp') === -1) return;
    // logger.info('response url: ', url);
    logger.info('response url:', url);
    const text = await response.text();

    const results = JSON.parse(text.substring(text.indexOf('(') + 1, text.lastIndexOf(')')));
    // logger.info(results);
    logger.info('in response total num', results.totalNum);
    if (results.retCode === '520001') {
        logger.info('520001 results', JSON.stringify(results));
        await page.evaluate(() => {
            loginStatus = false
        });
    }
    if ((results.retCode === '000000' || results.retCode === '400010')) {
        // if (!results.totalNum) results.totalNum = results.data ? results.data.length : 0;
        // if (!results.curCuror) results.curCuror = trace[type].cursor;
        totalNum = results.totalNum || totalNum;
        if (results.data) {
            monthData = monthData.concat(results.data);
            trace[type].cursor = trace[type].cursor + results.data.length;
        }

        if(trace[type].cursor >= totalNum){
            trace[type].cursor = 1;
            totalNum = 0;
        }
        logger.info('in response trace:', JSON.stringify(trace));
        fs.writeFileSync(`${loginNumber}/trace.txt`, JSON.stringify(trace) + ';');
        logger.info(`in response, ${results.startDate}\n result cursor: ${results.curCuror}\nresults length: ${results.data ? results.data.length : 0}\ntotalNum: ${totalNum}`);
        await page.evaluate(() => {
            loginStatus = true
        });
        delete results.data;
        logger.info('response result:', results);
    }
};

cmCrawler();