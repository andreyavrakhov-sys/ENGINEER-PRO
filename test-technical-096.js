const assert=require('assert');const a=require('./specification-analyzer');
assert(a.technicalConflicts('Обмежувач 35 кВ','Обмежувач 10 кВ').includes('voltage'));
assert(a.technicalConflicts('Конвектор 0,5 кВт','Конвектор 2 кВт').includes('power'));
assert(a.technicalConflicts('Автомат 160 А','Автомат 100 А').includes('current'));
assert.strictEqual(a.candidateScore('Обмежувач перенапруги 35 кВ','Обмежувач перенапруги 10 кВ'),0);
assert.strictEqual(a.technicalConflicts('Шафа РЗА 35 кВ','Шафа РЗА 35 кВ').length,0);
const report=a.compare({items:[{name:'Шафа захисту 35 кВ',qty:2,unit:'шт'}]},{items:[{name:'Шафа захисту 35 кВ',qty:1,unit:'шт',code:'К1'}]});
assert.strictEqual(report.rows[0].diff,1);
console.log('0.9.6 technical gates passed');
