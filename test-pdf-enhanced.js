'use strict';
const assert=require('assert');
const {makeLines}=require('./pdf-enhanced');
const {extractFromLines}=require('./specification-analyzer');
const lines=makeLines([
 {str:'Кабель ВВГнг 4х120',transform:[1,0,0,1,30,700],width:170,height:10},
 {str:'м',transform:[1,0,0,1,280,700],width:9,height:10},
 {str:'125,5',transform:[1,0,0,1,350,700],width:35,height:10},
 {str:'Лоток металевий 200х50',transform:[1,0,0,1,30,675],width:180,height:10},
 {str:'м',transform:[1,0,0,1,280,675],width:9,height:10},
 {str:'90',transform:[1,0,0,1,350,675],width:20,height:10}
],3);
assert.strictEqual(lines.length,2);
assert.strictEqual(lines[0].page,3);
const items=extractFromLines(lines);
assert.strictEqual(items.length,2);
assert.strictEqual(items[0].qty,125.5);
assert.strictEqual(items[1].qty,90);
assert.strictEqual(items[0].sourceMethod,'pdfjs-geometry');
console.log('PDF line grouping and specification extraction: 6 checks OK');
