'use strict';const assert=require('assert');const {auditPages}=require('./pdf-page-audit');
const lines=[{page:1,line:1,text:'Кабель силовий м 99',parts:[{x:20,str:'Кабель силовий',width:90},{x:200,str:'м',width:8},{x:230,str:'99',width:15}]},{page:2,line:1,text:'',parts:[]}];
let r=auditPages(lines,3,[],[]);assert.equal(r.tableAnchorsWithoutAcceptedItems,1);assert.equal(r.lowTextLayer,2);assert.equal(r.problemPages[0].page,1);
r=auditPages(lines,3,[{page:1}],[]);assert.equal(r.tableAnchorsWithoutAcceptedItems,0);assert.equal(r.unparsedAnchors,0);
const bad=[{page:1,line:1,text:'м 99',parts:[{x:200,str:'м'},{x:230,str:'99'}]}];r=auditPages(bad,1,[],[]);assert.equal(r.unparsedAnchors,1);assert.equal(r.problemPages[0].anchorExamples.length,1);
console.log('PASS 0.9.19 page-level geometry audit');
