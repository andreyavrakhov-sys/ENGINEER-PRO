'use strict';
const assert=require('node:assert/strict');const {extractFromLines,compare}=require('./specification-analyzer');
const rows=extractFromLines([{page:3,text:'Кабель ВВГнг 5х50 м 125,5'},{page:4,text:'Автоматичний вимикач 3Р 32А шт 4'},{page:5,text:'Дані без кількості'}]);
assert.equal(rows.length,2);assert.equal(rows[0].page,3);assert.equal(rows[0].qty,125.5);
const spec={items:rows};const estimate={items:[{name:'Кабель ВВГнг 5х50',unit:'м',qty:100,line:17,code:'С123'},{name:'Автоматичний вимикач 3Р 32А',unit:'шт',qty:4,line:18,code:'С456'}]};
const report=compare(spec,estimate);assert.equal(report.rows[0].status,'Розбіжність кількості');assert.equal(report.rows[0].diff,25.5);assert.equal(report.rows[1].status,'Текстовий збіг');
const ambiguity=compare({items:[rows[1]]},{items:[estimate.items[1],estimate.items[1]]});assert.match(ambiguity.rows[0].status,/Неоднозначно/);
const missing=compare({items:[rows[0]]},{items:[]});assert.match(missing.rows[0].status,/Немає точного збігу/);
console.log('Specification analyzer: 7 assertions passed');
