const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fs = require('fs');
const log4js = require('log4js');
const logger = log4js.getLogger();

const {config} = require('./config.js');

const {searchUrl, chineseFilePrefix, lineTitles, lineFields, launChOptions, billTypeMap,} = require('./consts');
//todo 测试断点继续功能
let page, monthData = [], totalNum, loginNumber, type,
    trace = {version: 1, sms: {date: '0', cursor: 1}, call: {date: '0', cursor: 1}},
    queryData, allData = {};

const cmCrawler = async function () {
    //页面初始化
    await initPage();

    // const l = await page.waitForSelector('#dropdownMenu2');
    // logger.info(await page.evaluate(el => el.innerText, l));
    loginNumber = await login();

    //等待类型菜单栏出现（包括通话记录，短信记录，上网记录等按钮）
    await page.waitForSelector('#switch-data');

    //通话记录按钮
    const callBtn = await page.$('[eventcode=UCenter_billdetailqry_type_THXD]');
    callBtn.recordType = 'call';
    //短信记录按钮
    const smsBtn = await page.$('[eventcode=UCenter_billdetailqry_type_DCXD]');
    smsBtn.recordType = 'sms';

    const queryTypeList = [];
    //先采集电话
    queryTypeList.push(callBtn);
    //后采集短信
    queryTypeList.push(smsBtn);

    await page.waitFor(1000);

    //等待月份列表出现
    const monthList = await page.$$('#month-data li');
    //反转列表中元素，从较早的月份开始采集
    monthList.reverse();

    //
    for (let query of queryTypeList) {
        // queryData = [];
        type = query.recordType;

        //初始化通话或短信记录文件
        const filename = initRecordFile(loginNumber);

        //先将月份按钮设置为未激活状态，以免点击类型按钮后立即开始查询
        for (let monthLi of monthList) {
            page.evaluate(el => el.setAttribute('class', ''), monthLi);
        }
        await page.waitFor(config.queryTimeInterval);

        //点击通话或短信记录按钮
        await query.click();
        // page.waitForSelector('#tmpl-data img');

        for (let monthLi of monthList) {
            monthData = [];
            totalNum = 0;

            const month = await page.evaluate(el => el.getAttribute('v'), monthLi);
            //月份小于trace中的记录时，跳过该月的查询
            if (month < trace[type].date) continue;
            trace[type].date = month;

            fs.writeFileSync(`${loginNumber}/trace.txt`, JSON.stringify(trace) + ';');
            //todo remove activate

            await monthLi.click();
            logger.info('1.0 init month :', type, month, monthData.length, totalNum);
            await page.waitForResponse((response => {
                if (response.url().indexOf('detailbillinfojsonp') !== -1) {
                    logger.info('1.1 month wait for', month, '\'s response:', response.url());
                    return true
                }
            }), {timeout: 0}); // to do
            await page.waitFor(config.queryTimeInterval);
            // try {
            let pageDiv = await page.$('#page-demo');
            // }catch(e){
            //     continue;
            // }
            logger.info('1.2', month, 'waiting for login');
            await page.waitForFunction(() => window.loginStatus === true, {timeout: 0});

            await page.screenshot({path: `${loginNumber}/screenshots/${type}_${month}.png`, fullPage: true});
            // const notes2 = await page.waitForSelector('#notes2', {timeout: 0});
            // const pageInfo = await pageDiv.$evaluate('#notes1', el => el.innerText);

            // let totalNum = await page.evaluate(el => el.innerText, notes2);
            // totalNum = /\d+/.exec(totalNum)[0];

            const pageInput = await pageDiv.$('input');
            const searchBtn = await pageDiv.$('.gs-search');

            while (totalNum > trace[type].cursor) {
                logger.info('2.1 in loop, month data length: ', monthData.length, ' total: ', totalNum);
                logger.info('2.2 wait for login dialog to disappear');

                await page.waitForSelector('#show_vec_firstdiv', {hidden: true, timeout: 0});

                logger.info('2.3 wait for login in');

                await page.waitForFunction(() => window.loginStatus === true, {timeout: 0});
                const nextPage = Math.floor(monthData.length / 50) + 1;

                //先清空页数输入框
                await page.evaluate((el) => {
                    el.value = ''
                }, pageInput);
                await pageInput.type(String(nextPage));
                //删除旁边的浮动栏，以免误按
                await page.evaluate(() => document.querySelector('#div_easy_entry') && document.querySelector('#div_easy_entry').remove());
                await searchBtn.click();

                logger.info(`2.4 wait for ${nextPage} page's response`);

                //等待页面查询结果返回
                await page.waitForResponse((response => {
                    if (response.url().indexOf('detailbillinfojsonp') !== -1) {
                        logger.info(`2.5 got ${nextPage} page's response of : ${response.url()}`);
                        return true
                    }
                }), {timeout: 0});
                await page.waitFor(config.queryTimeInterval);

                // let text = await res.text();
                // let results = JSON.parse(text.substring(text.indexOf('(') + 1, text.lastIndexOf(')')));
            }

            logger.info('3.1 ' + month + '月' + type + '数据全部取完\n数据长度：' + monthData.length);
            // queryData = queryData.concat(monthData);
            //一次写一个月的数据
            writeData(filename, month, type, monthData);
            // logger.info('queryDdata:', queryData.length);


        }
        // allData[query.recordType] = queryData;
    }
    page.evaluate(() => {
        alert('所有数据采集完成')
    });
};

const requestInterceptor = interceptedRequest => {
    let url = interceptedRequest.url();

    if (url.indexOf('detailbillinfojsonp') !== -1) {
        // let queryMap = {};
        // const querystr = url.substr(url.indexOf('?') + 1);
        // const queries = querystr.split('&');
        // queries.forEach(query => {
        //     const q = query.split('=');
        //     if (q.length === 2) {
        //         queryMap[q[0]] = q[1];
        //     }
        // });
        // const billType = billTypeMap[queryMap['billType']];

        //改写查询参数step，每次查询200条，改写curCuror，从trace记录中取查询起点
        logger.info('original request url :', url);

        url = url.replace(/step=\d+/, 'step=200').replace(/curCuror=\d+/, `curCuror=${trace[type].cursor}`);

        logger.info('modified request url :', url);
    }

    interceptedRequest.continue({url});

};

const responseProcessor = async response => {
    const url = response.url();

    if (url.indexOf('detailbillinfojsonp') === -1) return;

    const text = await response.text();
    //response text 格式为 jQuery_1234(data)
    const results = JSON.parse(text.substring(text.indexOf('(') + 1, text.lastIndexOf(')')));

    if (results.retCode === '520001') {
        //身份标识不存在，验权失败
        logger.info('520001 results', JSON.stringify(results));
        await page.evaluate(() => {
            loginStatus = false
        });
    }

    if ((results.retCode === '000000' || results.retCode === '400010')) {
        totalNum = results.totalNum || totalNum;
        if (results.data) {
            monthData = monthData.concat(results.data);
            trace[type].cursor = trace[type].cursor + results.data.length;
        }

        //一个月数据全部取完，重置月份总计和记录起点
        if (trace[type].cursor >= totalNum) {
            trace[type].cursor = 1;
            totalNum = 0;
        }

        //更新记录文件
        //全局登陆状态设置为true
        await page.evaluate(() => {
            loginStatus = true;
        });

        logger.info('response url:', url);
        logger.info(`in response results data length: ${results.data ? results.data.length : null}`);
        //太多了，所以不在log里打印具体的通话记录数据
        delete results.data;
        logger.info('response result:\n', results);
        logger.info('in response trace:', JSON.stringify(trace));

    }
};

function writeData(filename, month, type, data) {
    //统计数据
    let counts = fs.openSync(loginNumber + '/统计.csv', 'a+');
    fs.appendFileSync(counts, `${chineseFilePrefix[type]},${month},${data.length}\r\n`);
    fs.closeSync(counts);

    //通话或短信详单
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

const initPage = async () => {
    const browser = await puppeteer.launch({
        executablePath: config.executablePath.mac,
        headless: false,
        ignoreHTTPSErrors: true,
        // slowMo: 100,
        args: [
            `--window-size=${launChOptions.windowWidth}, ${launChOptions.windowHeight}`]
    });
    page = (await browser.pages())[0];

    await page.setViewport({
        width: launChOptions.windowWidth,
        height: launChOptions.windowHeight
    });
    // await page.screenshot({path: 'full.png', fullPage: true});
    await page.setRequestInterception(true);
    page.on('request', requestInterceptor);

    page.on('response', responseProcessor);

    await page.goto(searchUrl, {waitUntil: 'domcontentloaded'});

    //将浏览器中登陆状态标识设为false
    await page.evaluate(() => {
        loginStatus = false;
    })

};

const login = async () =>{
    //点击登陆按钮
    const loginBtn = await page.waitForSelector('#login-btn');
    loginBtn.click();

    //等待登陆输入框出现
    await page.waitForSelector('table.ui-dialog-grid', {hidden: false, timeout: 0});
    //等待输入完毕，点击确认按钮后登录框消失
    await page.waitForSelector('table.ui-dialog-grid', {hidden: true, timeout: 0});

    // await page.waitForSelector('#show_vec_firstdiv');
    //等待登陆成功，用右上角是否出现电话号码来判断，也可以改成通过登陆接口返回结果来判断
    const loginNumberEl = (await page.waitForSelector('.loginStr', {timeout: 0}));
    const loginNumber = await page.evaluate(el => el.innerText, loginNumberEl);
    //在浏览器环境中设置一个全局的登陆状态变量
    await page.evaluate(() => {
        window.loginStatus = true
    });
    initTrace(loginNumber);

    configLogger(loginNumber);
    return loginNumber;

};

function initTrace(path) {
    if (!fs.existsSync(path)) fs.mkdirSync(path);

    const ss = path + '/screenshots';
    if (!fs.existsSync(ss)) fs.mkdirSync(ss);

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

function initRecordFile(loginNumber) {
    //init file
    const date = new Date();
    const [y, m, d, t] = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getTime()];

    const filename = `${loginNumber}/${loginNumber}_${chineseFilePrefix[type]}_${y}.${m}.${d}_${t}.csv`;
    if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
    }
    return filename;
}

function configLogger(loginNumber) {
    //配置日志，以用户电话号码来命名
    logger.level = 'debug';
    config.log4js.appenders.everything.filename = `${loginNumber}/${loginNumber}.log`;
    log4js.configure(config.log4js);
    logger.info('-----------start logging-------------\n');
    logger.info(loginNumber);
}

cmCrawler();