const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');

const fs = require('fs');
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

let page, queryData, monthData = [], allData = {}, totalNum, loginNumber, trace = {sms:'0',call:'0'};

const cmCrawler = async function () {
    await init();

    // const l = await page.waitForSelector('#dropdownMenu2');
    // console.log(await page.evaluate(el => el.innerText, l));
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
    if(!fs.existsSync(loginNumber)){
        fs.mkdirSync(loginNumber);
        fs.mkdirSync(loginNumber + '/screenshots');
    }
    if(!fs.existsSync(`${loginNumber}/trace.txt`)){
        let fd = fs.openSync(`${loginNumber}/trace.txt`, 'w');
        fs.writeFileSync(fd, JSON.stringify(trace));
    }else{
        let fd = fs.openSync(`${loginNumber}/trace.txt`, 'r');
        let content = fs.readFileSync(fd, 'utf8');
        trace = JSON.parse(content);
    }
    await page.waitFor(1000);
    console.log(loginNumber);
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
        const type = query.recordType;
        //init file
        const date = new Date();
        const [y, m, d, t] = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getTime()];

        const filename = `${loginNumber}/${type}_${y}.${m}.${d}_${t}.csv`;
        if(fs.existsSync(filename)){
            fs.unlinkSync(filename);
        }

        for (let monthLi of monthList) {
            monthData = [];
            totalNum = 0;

            const month = await page.evaluate(el => el.getAttribute('v'), monthLi);
            if(month < trace[type]) continue;
            trace[type] = month;
            await page.screenshot({path: `${loginNumber}/screenshots/${type}_${month}.png`});
            //todo remove activate
            await monthLi.click();
            console.log('1.0 init month :', type, month, monthData.length, totalNum);
            await page.waitForResponse((response => {
                if (response.url().indexOf('detailbillinfojsonp') !== -1) {
                    console.log('1.1 month waitfor response:', response.url());
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
            console.log('1.2 waiting for login');
            await page.waitForFunction(() => window.loginStatus === true, {timeout: 0});
            // const notes2 = await page.waitForSelector('#notes2', {timeout: 0});
            // const pageInfo = await pageDiv.$evaluate('#notes1', el => el.innerText);

            // let totalNum = await page.evaluate(el => el.innerText, notes2);
            // totalNum = /\d+/.exec(totalNum)[0];

            while (totalNum > monthData.length) {
                console.log('2.1 in loop, month data length: ', monthData.length, ' total: ',totalNum);
                console.log('wait for login diag to disappear');
                await page.waitForSelector('#show_vec_firstdiv',{hidden: true, timeout: 0});
                console.log('wait for login in');
                await page.waitForFunction(() => window.loginStatus === true, {timeout: 0});
                const nextPage = Math.floor(monthData.length / 50) + 1;
                console.log('nextpage ', nextPage);
                const input = await pageDiv.$('input');
                await page.evaluate((el) => {el.value = ''}, input);
                await input.type(String(nextPage));
                const search = await pageDiv.$('.gs-search');
                await page.evaluate(() => document.querySelector('#div_easy_entry') && document.querySelector('#div_easy_entry').remove());
                await search.click();
                console.log(`2.2 wait for ${nextPage} page response`);

                await page.waitForResponse((response => {
                    if (response.url().indexOf('detailbillinfojsonp') !== -1) {
                        console.log('2.3 page waitfor response:', response.url());
                        return true
                    }
                }), {timeout: 0}); // to do
                await page.waitFor(3000);

                // let text = await res.text();
                // let results = JSON.parse(text.substring(text.indexOf('(') + 1, text.lastIndexOf(')')));
            }

            queryData = queryData.concat(monthData);
            writeData(filename, monthData, type);
            console.log('queryDdata:', queryData.length, queryData[0]);




        }


        allData[query.recordType] = queryData;
    }
};
function writeData(filename, data, type){

    fs.writeFileSync(`${loginNumber}/trace.txt`, JSON.stringify(trace));
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

        url = url.replace(/step=\d+/, 'step=200').replace(/curCuror=\d+/, `curCuror=${monthData.length + 1}`)
        // detailRequest = interceptedRequest.url();
        console.log('request url:', url);
    }
    interceptedRequest.continue({url});

};

const responseParser = async response => {
    const url = response.url();
    if (url.indexOf('detailbillinfojsonp') === -1) return;
    // console.log('response url: ', url);
    const text = await response.text();
    const results = JSON.parse(text.substring(text.indexOf('(') + 1, text.lastIndexOf(')')));
    // console.log(results);
    console.log('response url:', url);
    console.log('in response total num', results.totalNum);
    if (results.retCode === '520001') {
        console.log('520001 results', JSON.stringify(results));
        await page.evaluate(() => {
            loginStatus = false
        });
    }
    if (results.retCode === '000000' && results.curCuror > monthData.length) {
        totalNum = results.totalNum;
        monthData = monthData.concat(results.data);
        console.log(`in response, ${results.startDate}\n result cursor: ${results.curCuror}\nresults length: ${results.data.length}\ntotalNum: ${totalNum}`);
        await page.evaluate(() => {
            loginStatus = true
        });
    }
};

cmCrawler();
// await page.evaluate(() => {
//     document.querySelector('#login-btn').click();
// });
// await page.screenshot({path: 'example.png'});
//短信 document.querySelector('[eventcode=UCenter_billdetailqry_type_DCXD]')
//通话 document.querySelector('[eventcode=UCenter_billdetailqry_type_THXD]')
//身份认证 #show_vec_firstdiv
//     await page.evaluate(() => {
//         const span = document.createElement('span');
//         const txt = document.createTextNode('text');
//         span.appendChild(txt);
//         const div = document.querySelector('#middleLeft');
//         div.insertBefore(span, null);
//
//
//     })

//page.on('console', msg => console.log('PAGE LOG:', msg.text()));
// await browser.close();


//https://shop.10086.cn/i/v1/fee/detailbillinfojsonp/15889636305?callback=jQuery004414273435542815_1540360370438&curCuror=151&step=100&qryMonth=201809&billType=02&_=1540360495281
// await page.setRequestInterception(true);
// page.on('console', msg => console.log('PAGE LOG:', msg.text()));
// page.on('request', interceptedRequest => {
//     if (interceptedRequest.url().endsWith('.png') || interceptedRequest.url().endsWith('.jpg'))
//         interceptedRequest.abort();
//     else
//         interceptedRequest.continue();
// });


// # Basic verbose logging
// env DEBUG="puppeteer:*" node script.js
//
// # Debug output can be enabled/disabled by namespace
// env DEBUG="puppeteer:*,-puppeteer:protocol" node script.js # everything BUT protocol messages
// env DEBUG="puppeteer:session" node script.js # protocol session messages (protocol messages to targets)
// env DEBUG="puppeteer:mouse,puppeteer:keyboard" node script.js # only Mouse and Keyboard API calls
//
// # Protocol traffic can be rather noisy. This example filters out all Network domain messages
// env DEBUG="puppeteer:*" env DEBUG_COLORS=true node script.js 2>&1 | grep -v '"Network'

// request.continue([overrides])
// overrides <Object> Optional request overwrites, which can be one of the following:
//     url <string> If set, the request url will be changed
// method <string> If set changes the request method (e.g. GET or POST)
// postData <string> If set changes the post data of request
// headers <Object> If set changes the request HTTP headers
// returns: <Promise>
// Continues request with optional request overrides. To use this, request interception should be enabled with page.setRequestInterception. Exception is immediately thrown if the request interception is not enabled.