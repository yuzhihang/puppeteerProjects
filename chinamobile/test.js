const fs = require('fs');
let dirName = 'tmp';
if(!fs.existsSync(dirName)){
    fs.mkdirSync(dirName);
}

const filename = '1.txt';
let fd = fs.openSync(dirName + '/' + filename, 'a+');
fs.appendFileSync(fd, 1);
fs.writeFileSync(fd, 2);
fs.closeSync(fd);
let trace = {sms:'0',call:'0'};
if(!fs.existsSync(`${dirName}/trace.txt`)){
    let fd = fs.openSync(`${dirName}/trace.txt`, 'w');
    fs.writeFileSync(fd, JSON.stringify(trace));
}else{
    let fd = fs.openSync(`${dirName}/trace.txt`, 'r');
    let content = fs.readFileSync(fd, 'utf8');

    console.log(content);
    console.log(JSON.parse(content));

}

// fs.writeFileSync('tmp/1.txt');