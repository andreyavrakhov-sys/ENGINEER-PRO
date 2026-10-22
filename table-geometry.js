'use strict';
// Geometry-first PDF row parser. Quantity is the FIRST numeric cell to the right
// of a unit cell; trailing mass/weight/notes are not appended to quantity.
const unitRE=/^(?:шт\.?|компл\.?|к-т|м|м\.?п\.?|п\.?м\.?|км\.?|м[²³]|м[23]|кг|т)$/iu;
const numberRE=/^\d+(?:[.,]\d+)?$/u;
const tidy=s=>String(s??'').replace(/\s+/g,' ').trim();
function normalizeUnit(s){return tidy(s).toLowerCase().replace(/\.$/,'')}
function cells(parts){return (parts||[]).map(p=>({x:Number(p.x),width:Number(p.width||0),str:tidy(p.str)})).filter(p=>Number.isFinite(p.x)&&p.str).sort((a,b)=>a.x-b.x)}
function extractGeometry(row){
 const parts=cells(row.parts);if(parts.length<3)return null;
 for(let i=0;i<parts.length;i++){
  const u=normalizeUnit(parts[i].str);if(!unitRE.test(u))continue;
  let qty=null,qi=-1;
  for(let j=i+1;j<Math.min(parts.length,i+5);j++){
   const t=parts[j].str.replace(/\s/g,'');
   if(numberRE.test(t)){qty=Number(t.replace(',','.'));qi=j;break}
   if(/[\p{L}]/u.test(t))break;
  }
  if(qi<0)continue;
  const before=parts.slice(0,i).map(p=>p.str).join(' ');
  const name=tidy(before).replace(/^\d+(?:\.\d+)*\s+/,'');
  if(name.length<5||!/[\p{L}]/u.test(name)||/^(?:найменування|позначення|всього|разом)/iu.test(name))continue;
  return {name,unit:u,qty,page:row.page||null,line:row.line||null,source:row.text,sourceMethod:'pdfjs-geometry',confidence:'Потребує перевірки',quantitySource:{unitX:parts[i].x,quantityX:parts[qi].x,raw:parts[qi].str},ignoredRight:parts.slice(qi+1).map(p=>p.str).join(' ').slice(0,80)};
 }
 return null;
}
module.exports={extractGeometry,cells};
