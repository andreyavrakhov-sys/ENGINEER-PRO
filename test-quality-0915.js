'use strict';
const assert=require('assert');const {splitQuality}=require('./table-quality');
const cases=['електрична ра ра 1','10x2,5 і захисту','характеристика , IP54, RAL9006, ( ВхШхГ шт шт'];
const valid=['Конвектор електричний Термія 0,5 кВт','Вентилятор осьовий WOKS Ø400','Коробка розподільна ∅80 мм','Муфта кінцева термоусаджувальна для кабелів Ф8-20мм'];
const r=splitQuality([...cases,...valid].map(name=>({name})));assert.equal(r.quarantined.length,3);assert.equal(r.accepted.length,4);assert(r.quarantined.every(x=>x.qualityIssues.length));console.log('0.9.15 real-fragment quarantine passed');
