'use strict';
const assert=require('assert');
const {extractGeometry}=require('./table-geometry');
const {extractFromLines}=require('./specification-analyzer');
function row(name,qty,extra){return {page:26,line:29,text:`${name} шт. ${qty} ${extra}`,parts:[{x:30,str:name},{x:550,str:'шт.'},{x:605,str:String(qty)},{x:670,str:String(extra)}]}}
for(const [name,q,extra] of [['1.5 Конвектор Термія',8,'2,800'],['1.6 Вентилятор WOKS Ø400',4,'4'],['8.3 Коробка розподільна Ø80',16,'0,45']]){
 const x=extractGeometry(row(name,q,extra));assert(x);assert.strictEqual(x.qty,q);assert.strictEqual(x.ignoredRight,extra);
 assert.strictEqual(extractFromLines([row(name,q,extra)])[0].qty,q);
}
assert.strictEqual(extractFromLines([{page:26,text:'1.5 Конвектор Термія шт. 8 2,800',parts:[{x:1,str:'1.5 Конвектор Термія'},{x:5,str:'шт. 8 2,800'}]}]).length,0);
console.log('geometry regression: 4 PASS');
