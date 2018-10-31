const puppeteer = require('puppeteer');
const searchUrl = 'file:///Users/Rossonero/Desktop/jy.htm';
const init = async () => {
    const browser = await puppeteer.launch({
        headless: false, ignoreHTTPSErrors: true,
        // slowMo: 100,

    });
    let page = (await browser.pages())[0];


    // await page.screenshot({path: 'full.png', fullPage: true});
    await page.goto(searchUrl, {waitUntil: 'domcontentloaded'});
    await page.screenshot({path:'t/s.png'});

};

init()// const fs = require('fs');
// let dirName = 'tmp';
// if(!fs.existsSync(dirName)){
//     fs.mkdirSync(dirName);
// }
//
// const filename = '1.txt';
// let fd = fs.openSync(dirName + '/' + filename, 'a+');
// fs.appendFileSync(fd, 1);
// fs.writeFileSync(fd, 2);
// fs.closeSync(fd);
// let trace = {sms:'0',call:'0'};
// if(!fs.existsSync(`${dirName}/trace.txt`)){
//     let fd = fs.openSync(`${dirName}/trace.txt`, 'w');
//     fs.writeFileSync(fd, JSON.stringify(trace));
// }else{
//     let fd = fs.openSync(`${dirName}/trace.txt`, 'r');
//     let content = fs.readFileSync(fd, 'utf8');
//
//     console.log(content);
//     console.log(JSON.parse(content));
//
// }
//
//
//
// // fs.writeFileSync('tmp/1.txt');