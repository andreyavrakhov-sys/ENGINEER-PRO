'use strict';
// Conservative extraction: a candidate is reported only when name, unit and quantity
// are present on the same source line. No OCR, no inference of quantities.
const reader=require('./document-reader');
const {parse:parseEstimate,canonical,unit:unitOf}=require('./compare-engine');
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const MAX=25*1024*1024;
function clean(v){return String(v??'').replace(/\s+/g,' ').trim()}
function numeric(v){const s=clean(v).replace(/\s/g,'').replace(',','.');return /^[+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)?Number(s):null}
function key(v){return clean(v).toLocaleLowerCase('uk-UA').replace(/[«»“”"'()]/g,'').replace(/[–—−]/g,'-').replace(/\s+/g,' ')}
function pdfStrings(s){const arr=[];for(const m of s.matchAll(/\(((?:\\.|[^\\)])*)\)\s*(?:Tj|'|"|\])|\[((?:.|\n)*?)\]\s*TJ/g)){
 const bits=m[1]!==undefined?[m[1]]:[...m[2].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map(x=>x[1]);
 for(const b of bits){let text=b.replace(/\\([()\\])/g,'$1').replace(/\\([nrt])/g,(_,c)=>({n:' ',r:' ',t:' '}[c]));if(/[\x00-\x08\x0e-\x1f]/.test(text))continue;arr.push(text)}
}return arr.join(' ')}
function ascii85(buf){
 const input=buf.toString('latin1').replace(/\s/g,'').replace(/^<~/,'').replace(/~>.*$/s,'');
 const out=[];let chunk=[];
 for(const c of input){if(c==='z'&&!chunk.length){out.push(0,0,0,0);continue}
  const n=c.charCodeAt(0)-33;if(n<0||n>84)continue;chunk.push(n);
  if(chunk.length===5){let value=0;for(const x of chunk)value=value*85+x;for(let shift=24;shift>=0;shift-=8)out.push(Math.floor(value/2**shift)%256);chunk=[]}
 }
 if(chunk.length>1){const len=chunk.length;while(chunk.length<5)chunk.push(84);let value=0;for(const x of chunk)value=value*85+x;for(let shift=24;shift>=0&&out.length<1e7;shift-=8){if(shift<(5-len)*8)break;out.push(Math.floor(value/2**shift)%256)}}
 return Buffer.from(out);
}
function pdfLines(file){const b=fs.readFileSync(file);if(b.length>MAX)throw Error('PDF більше 25 МБ');const raw=b.toString('latin1');const objects=new Map();for(const m of raw.matchAll(/(?:^|\r?\n)(\d+)\s+\d+\s+obj\b([\s\S]*?)\bendobj/g))objects.set(+m[1],m[2]);
 const pageIds=[...objects].filter(([,v])=>/\/Type\s*\/Page\b/.test(v)&&!/\/Type\s*\/Pages\b/.test(v)).map(([id])=>id);
 const lines=[],warnings=[];
 if(!pageIds.length){warnings.push('Неможливо визначити сторінки PDF; джерела не встановлено');return {lines,warnings,pages:0}}
 for(let pi=0;pi<Math.min(pageIds.length,150);pi++){
  const obj=objects.get(pageIds[pi]);const block=(obj.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/)||[])[1]||'';
  const refs=[...block.matchAll(/(\d+)\s+\d+\s+R/g)].map(m=>+m[1]);let found=false;
  for(const id of refs){const stream=objects.get(id)||'';const m=stream.match(/stream\r?\n([\s\S]*?)\r?\n?endstream/);if(!m)continue;
   let data=Buffer.from(m[1],'latin1');try{const header=stream.slice(0,m.index);if(/\/ASCII85Decode/.test(header))data=ascii85(data);if(/\/FlateDecode/.test(header))data=zlib.inflateSync(data,{maxOutputLength:MAX})}catch{continue}
   const decoded=data.toString('latin1');for(const bt of decoded.matchAll(/BT([\s\S]*?)ET/g)){
    const t=clean(pdfStrings(bt[1]));if(t.length>=8){lines.push({page:pi+1,text:t});found=true}
   }
  }
  if(!found)warnings.push('Сторінка '+(pi+1)+': текст не прочитано (скан, шрифт або складна структура PDF)');
 }
 if(pageIds.length>150)warnings.push('Оброблено лише перші 150 сторінок');
 return {lines,warnings,pages:pageIds.length};
}
function extractFromLines(lines){const items=[];for(const row of lines){const t=clean(row.text);if(!t||t.length>350)continue;
 // End of line: explicit unit and quantity; preserve raw line for verification.
 const m=t.match(/^(.{5,240}?)\s+(шт\.?|компл\.?|комплект(?:ів|и)?|м\.?п\.?|п\.?м\.?|км|м|m|pcs|м²|м2|м³|м3|кг|т)\s+([\d\s]+(?:[.,]\d+)?)\s*$/iu);
 if(!m)continue;const name=clean(m[1]);if(/^(разом|всього|усього|підсум|найменування)/iu.test(name))continue;
 const qty=numeric(m[3]);if(qty===null)continue;
 items.push({name,unit:clean(m[2]),qty,page:row.page||null,line:row.line||null,source:row.text,sourceMethod:row.sourceMethod||'text',confidence:'Потребує перевірки'});
}return items}
async function analyze(file,options={}){if(typeof file!=='string'||!path.isAbsolute(file)||!fs.existsSync(file))throw Error('Файл не знайдено');const ext=path.extname(file).toLowerCase();let items=[],warnings=[],pages=null;
 if(ext==='.pdf'){const pdf=await require('./pdf-enhanced').pdfLines(file,{ocr:options.ocr===true});items=extractFromLines(pdf.lines);warnings=pdf.warnings;pages=pdf.pages;
  warnings.unshift('PDF.js: зчитано текстовий шар з координатами. Рядки таблиць та OCR потрібно перевіряти за оригіналом; позиції без назви, одиниці та кількості не розпізнаються.');
 }else if(['.xlsx','.csv'].includes(ext)){
  const d=reader.read(file);const sheets=d.sheets||[{name:path.basename(file),rows:d.rows||[]}];
  for(const sheet of sheets){const rows=sheet.rows||[];for(let i=0;i<rows.length;i++){
   const row=rows[i].map(clean);const matches=[];
   for(let j=0;j<row.length-2;j++){
    if(row[j].length<5||row[j].length>240)continue;
    const u=unitOf(row[j+1]);const q=numeric(row[j+2]);if(u&&q!==null)matches.push({name:row[j],unit:row[j+1],qty:q,page:null,line:i+1,sheet:sheet.name,source:row.join(' | '),confidence:'Потребує перевірки'});
   }items.push(...matches.slice(0,1));
  }}warnings.push('Таблиця: автоматично шукаються лише сусідні колонки «найменування / одиниця / кількість»; перевірте заголовки та рядки.');
 }else throw Error('Для специфікацій підтримуються PDF, XLSX і CSV');
 return {file:path.basename(file),pages,items:items.slice(0,5000),totalFound:items.length,warnings};
}
function technicalTokens(name){
 const text=key(name).replace(/[×хxХ]/g,'x').replace(/(\d),(\d)/g,'$1.$2');
 const stop=new Set(['для','та','або','від','типу','з','із','на','по','до','шт','комплект','виріб','монтаж','установка','робіт']);
 return [...new Set((text.match(/[\p{L}\d]+(?:[.\-/][\p{L}\d]+)*/gu)||[]).filter(t=>t.length>2&&!stop.has(t)))];
}
function candidateScore(a,b){
 const ta=technicalTokens(a),tb=technicalTokens(b);if(!ta.length||!tb.length)return 0;
 const aa=new Set(ta),bb=new Set(tb),shared=[...aa].filter(t=>bb.has(t));
 const technical=t=>/\d/.test(t)&&t.length>=3;
 const aTech=ta.filter(technical),bTech=tb.filter(technical);
 if(aTech.length&&bTech.length&&!aTech.some(t=>bTech.includes(t)))return 0;
 const overlap=shared.length/Math.max(aa.size,bb.size);
 const technicalBonus=aTech.length&&aTech.some(t=>bTech.includes(t))?0.12:0;
 return Math.min(1,overlap+technicalBonus);
}
function suggestCandidates(item,est){
 const ua=unitOf(item.unit);
 return est.map((e,i)=>{const ub=unitOf(e.unit);let compatible=false;
  if(ua&&ub){try{compatible=canonical(ua,1).u===canonical(ub,1).u}catch{}}
  const score=candidateScore(item.name,e.name);
  return {e,i,score,compatible};
 }).filter(x=>x.compatible&&x.score>=0.34).sort((a,b)=>b.score-a.score).slice(0,3);
}
function compare(spec,estimate){
 if(!spec||!Array.isArray(spec.items)||!estimate||!Array.isArray(estimate.items))throw Error('Спочатку імпортуйте специфікацію та кошторис');
 const specs=spec.items.filter(x=>x&&clean(x.name).length>4);
 const est=estimate.items.filter(x=>x&&clean(x.name).length>4);
 const rows=[],used=new Set();
 const normalizeCode=x=>key(x||'').replace(/\s+/g,'');
 for(const item of specs){
  const candidates=est.map((e,i)=>({e,i})).filter(({e})=>key(e.name)===key(item.name));
  let match=null,matchIndex=-1,status='Немає точного збігу назви (перевірити вручну)',diff=null;
  if(candidates.length===1){match=candidates[0].e;matchIndex=candidates[0].i}
  else if(candidates.length>1){
   const code=normalizeCode(item.code);
   const byCode=code?candidates.filter(({e})=>normalizeCode(e.code)===code):[];
   if(byCode.length===1){match=byCode[0].e;matchIndex=byCode[0].i}
   else status='Неоднозначно: кілька позицій кошторису';
  }
  if(match){
   used.add(matchIndex);
   const a=numeric(item.qty),b=numeric(match.qty),ua=unitOf(item.unit),ub=unitOf(match.unit);
   if(a===null||b===null)status='Кількість не підтверджена';
   else if(!ua||!ub)status='Одиниці не розпізнано';
   else{const ca=canonical(ua,a),cb=canonical(ub,b);
    if(ca.u!==cb.u)status='Несумісні одиниці';
    else{diff=Number((ca.q-cb.q).toFixed(6));status=Math.abs(diff)<1e-7?'Текстовий збіг':'Розбіжність кількості'}
   }
  }
  const suggestions=match?[]:suggestCandidates(item,est);
  if(!match&&suggestions.length&&!status.startsWith('Неоднозначно')){status='Можливий відповідник — перевірити вручну';}
  rows.push({suggestions:suggestions.map(x=>({name:x.e.name,code:x.e.code||'',sheet:x.e.sheet||'',line:x.e.line??'',score:Number(x.score.toFixed(3))})),suggestedMatches:suggestions.map(x=>`${x.e.name} [${x.e.code||'без шифру'}; ${x.e.sheet||''}:${x.e.line||''}; ${Math.round(x.score*100)}%]`).join(' | '),sourceFile:item.sourceFile||spec.file||'',name:item.name,unitSpec:item.unit,qtySpec:item.qty,unitEstimate:match?.unit||'',qtyEstimate:match?.qty??'',diff,status,page:item.page??'',line:item.line??'',sheet:item.sheet||'',estimateSheet:match?.sheet||'',estimateLine:match?.line??'',estimateCode:match?.code||'',source:item.source||'',sourceMethod:item.sourceMethod||'text',review:'Попередня автоматична звірка: перевірити марку, характеристики, обсяги та креслення за оригіналами'});
 }
 // These are NOT automatically excess materials: drawings may have been incompletely read.
 est.forEach((e,i)=>{if(!used.has(i))rows.push({sourceFile:'',name:e.name,unitSpec:'',qtySpec:'',unitEstimate:e.unit||'',qtyEstimate:e.qty??'',diff:null,status:'Позиція кошторису без підтвердженого зіставлення',page:'',line:'',sheet:'',estimateSheet:e.sheet||'',estimateLine:e.line??'',estimateCode:e.code||'',source:'',sourceMethod:'estimate',review:'Не вважати зайвою: перевірити всі креслення та специфікації, зокрема нерозпізнані рядки'})});
 return {rows,summary:{spec:specs.length,estimate:est.length,matched:rows.filter(x=>x.status==='Текстовий збіг').length,review:rows.filter(x=>x.status!=='Текстовий збіг').length,unmatchedEstimate:rows.filter(x=>x.status==='Позиція кошторису без підтвердженого зіставлення').length}};
}
module.exports={analyze,compare,extractFromLines,numeric,pdfLines,candidateScore,suggestCandidates};
