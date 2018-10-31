const puppeteer = require('puppeteer');

const options = {
    windowWidth: 1280,
    windowHeight: 1024
};
const searchUrl = 'file:///Users/Rossonero/Desktop/jy.htm';
// const searchUrl = 'https://shop.10086.cn/i/?f=billdetailqry';

let page, queryData, monthData = [], allData = {}, totalNum;


const cmCrawler = async function () {
    await init();

    let pageDiv = await page.$('#page-demo');
    const input = await pageDiv.$('input');
    let nextpage = Math.floor(200 / 50) + 1;
    await input.type(String(nextpage));
    const search = await pageDiv.$('.gs-search');
    await search.click();
    await page.evaluate((el) => {el.value = ''}, input);
    nextpage = Math.floor(400 / 50) + 1;
    await input.type(String(nextpage));
    await search.click();


};
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
    // await page.setRequestInterception(true);

    await page.goto(searchUrl, {waitUntil: 'domcontentloaded'});

};


cmCrawler();