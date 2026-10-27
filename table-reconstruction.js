'use strict';
// Conservative PDF reconstruction. A numbered interval may be used only when
// it contains one quantity anchor. Otherwise original cells are preserved.
const tidy=s=>String(s??'').replace(/\s+/g,' ').trim();
const marker=/^\d{1,3}(?:\.\d{1,3}){1,3}\.?$/;
const stamp=/(?:Зм\.?\s*Кільк\.?\s*Арк\.?|№\s*док\.?\s*Підпис\s*Дата|Розробив\s+\S+\s+Перевірив)/iu;
function cleanName(s){return tidy(s).replace(/(?:Зм\.?\s*Кільк\.?\s*Арк\.?(?:\s*№\s*док\.?\s*Підпис\s*Дата)?|№\s*док\.?\s*Підпис\s*Дата|Розробив\s+\S+\s+Перевірив)[\s\S]*$/iu,'').trim()}
function reconstruct(lines,items){
 const byPage=new Map();for(const l of lines){if(!l.parts?.length||!Number.isFinite(l.y))continue;const a=byPage.get(l.page)||[];a.push(l);byPage.set(l.page,a)}
 const sorted=new Map([...byPage].map(([p,ls])=>[p,ls.sort((a,b)=>b.y-a.y)]));
 let improved=0,ambiguous=0,cleaned=0;
 const results=items.map(item=>{
  const original=cleanName(item.name);
  let base=item;
  if(original!==tidy(item.name)){base={...item,name:original,originalName:item.name,stampRemoved:true};cleaned++}
  if(!Number.isFinite(item.quantitySource?.unitX)||!Number.isFinite(item.y))return base;
  const page=sorted.get(item.page)||[],current=page.findIndex(l=>l.line===item.line);
  if(current<0)return base;
  const unitX=item.quantitySource.unitX;
  const isMarker=l=>l.parts.some(p=>p.x<unitX*.35&&marker.test(tidy(p.str)));
  let start=current;while(start>0&&current-start<12&&!isMarker(page[start]))start--;
  if(!isMarker(page[start]))return base;
  let end=current;while(end+1<page.length&&end-start<14&&!isMarker(page[end+1]))end++;
  // If a row contains multiple detected unit+quantity pairs, there is no
  // reliable way to assign wrapped descriptions to each item. Fail closed.
  const anchors=items.filter(x=>x.page===item.page&&Number.isFinite(x.quantitySource?.unitX)&&page.slice(start,end+1).some(l=>l.line===x.line));
  if(anchors.length!==1){ambiguous++;return base}
  const snippets=[];
  for(let k=start;k<=end;k++){
   const parts=page[k].parts.filter(p=>p.x>=unitX*.10&&p.x<unitX-8&&p.x+(p.width||0)<=unitX+1&&!marker.test(tidy(p.str)));
   const s=cleanName(parts.map(p=>p.str).join(' '));
   if(s&&/[\p{L}]{3}/u.test(s)&&!/^(?:погоджено|інв\.|підпис|замість)/iu.test(s))snippets.push(s);
  }
  const candidate=cleanName(snippets.join(' '));
  if(candidate.length<=original.length+12||candidate.length>500||stamp.test(candidate))return base;
  const norm=s=>tidy(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const old=norm(original),fresh=norm(candidate);
  if(old.length>=8&&!fresh.includes(old.slice(0,Math.min(14,old.length)))&&!fresh.includes(old.slice(-Math.min(14,old.length))))return base;
  improved++;return {...base,name:candidate,originalName:item.name,nameReconstructed:true,reconstructionMethod:'unique-numbered-row-coordinate',sourceMethod:item.sourceMethod+'+row-reconstruction'};
 });
 return {items:results,improved,ambiguous,cleaned};
}
module.exports={reconstruct,cleanName};
