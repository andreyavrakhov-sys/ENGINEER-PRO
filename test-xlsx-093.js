'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {build}=require('./xlsx-report');
const b=build([{name:'Усі результати',headers:['Назва','Кількість'],rows:[['Болт М12',12]]},{name:'На перевірку',headers:['Статус'],rows:[['Можливий збіг']]}]);
assert.strictEqual(b.readUInt32LE(0),0x04034b50);
const p=path.join(os.tmpdir(),'engineer-pro-xlsx-093-test.xlsx');fs.writeFileSync(p,b);
console.log('XLSX written:',p);
