'use strict';
// Coordinate-aware reconstruction of names inside a numbered specification row.
// Never changes quantity/unit; preserves the original fragment for audit.
const tidy=s=>String(s??'').replace(/\s+/g,' ').trim();
const marker=/^\d{1,3}(?:\.\d{1,3}){1,3}\.?$/;
function reconstruct(lines,items){
 const byPage=new Map();for(const l of lines){if(!l.parts?.length||!Number.isFinite(l.y))continue;const a=byPage.get(l.page)||[];a.push(l);byPage.set(l.page,a)}
 let improved=0;const results=items.map(item=>{
  if(!Number.isFinite(item.quantitySource?.unitX)||!Number.isFinite(item.y))return item;
  const page=(byPage.get(item.page)||[]).sort((a,b)=>b.y-a.y);
  const current=page.findIndex(l=>l.line===item.line);if(current<0)return item;
  const anchor=page[current],unitX=item.quantitySource.unitX;
  // A numbered row begins in the far-left position column. Only reconstruct
  // where the same page has a trustworthy row marker above the quantity.
  const isMarker=l=>l.parts.some(p=>p.x<unitX*.35&&marker.test(tidy(p.str)));
  let start=current;while(start>0&&current-start<12&&!isMarker(page[start]))start--;
  if(!isMarker(page[start]))return item;
  let end=current;while(end+1<page.length&&end-start<14&&!isMarker(page[end+1]))end++;
  const leftBound=unitX*.10, rightBound=unitX-8;
  const snippets=[];
  for(let k=start;k<=end;k++){
   const parts=page[k].parts.filter(p=>p.x>=leftBound&&p.x<rightBound&&p.x+p.width<=unitX+1&&!marker.test(tidy(p.str)));
   const s=tidy(parts.map(p=>p.str).join(' '));if(s&&/[\p{L}]{3}/u.test(s)&&!/^\s*(?:погоджено|інв\.|підпис|замість)/iu.test(s))snippets.push(s);
  }
  const candidate=tidy(snippets.join(' '));
  if(candidate.length<=item.name.length+12||candidate.length>700)return item;
  // Require substantial overlap with the original name to prevent row leakage.
  const norm=s=>tidy(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const old=norm(item.name),fresh=norm(candidate);
  if(old.length>=8&&!fresh.includes(old.slice(0,Math.min(14,old.length)))&&!fresh.includes(old.slice(-Math.min(14,old.length))))return item;
  improved++;return {...item,name:candidate,originalName:item.name,nameReconstructed:true,reconstructionMethod:'numbered-row-coordinate',sourceMethod:item.sourceMethod+'+row-reconstruction'};
 });return {items:results,improved};
}
module.exports={reconstruct};
