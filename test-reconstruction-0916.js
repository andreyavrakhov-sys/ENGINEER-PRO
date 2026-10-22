'use strict';const assert=require('assert');const {reconstruct}=require('./table-reconstruction');
const mk=(line,y,parts)=>({page:26,line,y,parts:parts.map(([x,str])=>({x,str,width:str.length*4}))});
const lines=[mk(1,500,[[78,'1.2'],[115,'Шафа власних потреб ЩВП-0,4 кВ'],[700,'шт.'],[780,'1']]),mk(2,490,[[115,'однобічного обслуговування, габаритами 600х250х1200(h)']]),mk(3,480,[[115,'на номінальний струм 100А'],[700,'шт.'],[780,'1']]),mk(4,450,[[78,'1.3'],[115,'Конвектор Термія'],[700,'шт.'],[780,'8']])];
const original={page:26,line:3,y:480,name:'на номінальний струм 100А',unit:'шт',qty:1,quantitySource:{unitX:700}};
const r=reconstruct(lines,[original]);assert.equal(r.improved,1);assert.match(r.items[0].name,/Шафа власних потреб/);assert.match(r.items[0].name,/600х250х1200/);assert.equal(r.items[0].qty,1);assert(!r.items[0].name.includes('Конвектор'));
assert.equal(reconstruct(lines,[{...original,quantitySource:null}]).improved,0);
console.log('PASS: numbered-row coordinate reconstruction preserves quantity and row boundary');
