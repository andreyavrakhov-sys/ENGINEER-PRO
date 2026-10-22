'use strict';
const assert=require('assert');const {quality,splitQuality}=require('./table-quality');
for(const n of ['м³ м³ м³ м³','кг м² м² м³','Погоджено 2.1.2 5х35','Реконструкція ПС 35/10 кВ Конопляне 100','Шафа Т'])assert(!quality({name:n}).reliable,n);
for(const n of ['Конвектор електричний Термія 0,5 кВт','Вентилятор осьовий WOKS Ø400','Коробка розподільна ∅80 мм','Муфта кінцева термоусаджувальна для кабелів'])assert(quality({name:n}).reliable,n);
const r=splitQuality([{name:'м³ м³ м³ м³'},{name:'Коробка розподільна ∅80 мм'}]);assert.equal(r.accepted.length,1);assert.equal(r.quarantined.length,1);
console.log('0.9.14 quality quarantine tests passed');
