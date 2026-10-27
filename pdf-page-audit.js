'use strict';
// Per-page evidence of geometric table anchors. This does not invent items.
const {extractGeometry,cells}=require('./table-geometry');
const unit=/^(?:шт\.?|компл\.?|к-т|м|м\.?п\.?|п\.?м\.?|км\.?|м[²³23]|кг|т)$/iu;
const num=/^\d+(?:[.,]\d+)?$/;
function auditPages(lines,pages,accepted=[],quarantined=[]){
 const groups=new Map();
 for(const l of lines||[]){if(!Number.isInteger(l.page))continue;let g=groups.get(l.page);if(!g){g={page:l.page,lines:0,textChars:0,geometryAnchors:0,unparsedAnchors:0,accepted:0,quarantined:0,anchorExamples:[]};groups.set(l.page,g)}
  g.lines++;g.textChars+=String(l.text||'').length;
  const p=cells(l.parts);let anchors=0;
  for(let i=0;i<p.length;i++)if(unit.test(p[i].str.toLowerCase())){
   for(let j=i+1;j<Math.min(i+5,p.length);j++){
    if(num.test(p[j].str.replace(/\s/g,''))){anchors++;break}
    if(/[\p{L}]/u.test(p[j].str))break;
   }
  }
  if(anchors){g.geometryAnchors+=anchors;if(!extractGeometry(l)){g.unparsedAnchors+=anchors;if(g.anchorExamples.length<3)g.anchorExamples.push({line:l.line,text:String(l.text||'').slice(0,110)})}}
 }
 for(const x of accepted||[]){const g=groups.get(x.page);if(g)g.accepted++}
 for(const x of quarantined||[]){const g=groups.get(x.page);if(g)g.quarantined++}
 const output=[];for(let page=1;page<=Math.min(Number(pages)||0,1000);page++){
  const g=groups.get(page)||{page,lines:0,textChars:0,geometryAnchors:0,unparsedAnchors:0,accepted:0,quarantined:0,anchorExamples:[]};
  g.status=g.geometryAnchors>0&&g.accepted===0?'table-anchors-without-accepted-items':g.textChars<40?'low-text-layer':g.geometryAnchors===0?'no-table-anchors':'parsed-some';output.push(g);
 }
 return {pagesTotal:Number(pages)||0,pagesScanned:output.length,pagesNotScanned:Math.max(0,(Number(pages)||0)-output.length),lowTextLayer:output.filter(x=>x.status==='low-text-layer').length,tableAnchorsWithoutAcceptedItems:output.filter(x=>x.status==='table-anchors-without-accepted-items').length,unparsedAnchors:output.reduce((n,x)=>n+x.unparsedAnchors,0),problemPages:output.filter(x=>x.status==='table-anchors-without-accepted-items'||x.status==='low-text-layer').slice(0,30)};
}
module.exports={auditPages};
