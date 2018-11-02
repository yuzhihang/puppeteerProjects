const billTypeMap = {
    '02': 'call',
    '03': 'sms'
};
const chineseFilePrefix = {
    'call': '通话记录',
    'sms': '短信记录'
};

const lineTitles = {
    'sms': '起始时间,通信地点,对方号码,通信方式,信息类型,业务名称,套餐优惠,通信费(元)\n',
    'call': '起始时间,通信地点,通信方式,对方号码,通信时长,通信类型,套餐优惠,实收通信费(元)\n'
};

const lineFields = {
    'sms': ['startTime', 'commPlac', 'anotherNm', 'commMode', 'infoType', 'busiName', 'meal', 'commFee'],
    'call': ['startTime', 'commPlac', 'commMode', 'anotherNm', 'commTime', 'commType', 'mealFavorable', 'commFee']
};

const searchUrl = 'https://shop.10086.cn/i/?f=billdetailqry';

const launChOptions = {
    windowWidth: 1280,
    windowHeight: 1024
};

module.exports = {
    searchUrl,
    billTypeMap,
    chineseFilePrefix,
    lineTitles,
    lineFields,
    launChOptions
};