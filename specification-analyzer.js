'use strict';
// Conservative extraction: a candidate is reported only when name, unit and quantity
// are present on the same source line. No OCR, no inference of quantities.
const reader=require('./document-reader');
const {extractGeometry}=require('./table-geometry');
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
// Preserve coordinate-based rows, but reject narrative fragments and environmental tables.
function documentType(lines){const text=lines.slice(0,250).map(x=>x.text).join(' ').toLowerCase();if(/оцінк[аи] впливу|викид[иів] забруднюючих|охорон[аи] навколишнього середовища/.test(text))return 'environment';if(/специфікаці[яї]|відомість обладнання|відомість матеріалів/.test(text))return 'specification';if(/релейн(ий|ого) захист|автоматик[аи]|рза/.test(text))return 'relay-protection';if(/пояснювальн[аи] записка/.test(text))return 'explanatory';return 'unknown'}
function extractFromLines(lines){const items=[];let rejected=0;
 const unit=String.raw`(?:шт\.?|компл\.?|комплект(?:ів|и)?|м\.?п\.?|п\.?м\.?|км|м|m|pcs|м²|м2|м³|м3|кг|т)`;
 const tail=new RegExp(String.raw`^(.{5,240}?)\s+(${unit})\s+([\d\s]+(?:[.,]\d+)?)\s*$`,'iu');
 const numberFirst=new RegExp(String.raw`^\s*\d{1,4}[.)]?\s+(.{5,220}?)\s+(${unit})\s+([\d\s]+(?:[.,]\d+)?)\s*$`,'iu');
 for(const row of lines){const t=clean(row.text);if(!t||t.length>350)continue;
 const geometry=extractGeometry(row);if(geometry){if(!isNonSpecification(geometry))items.push(geometry);else rejected++;continue;}
 // Never infer quantities from a flattened PDF row with lost column boundaries.
 if(row.parts&&row.parts.length>1)continue;
 const m=t.match(numberFirst)||t.match(tail);if(!m)continue;
 const name=clean(m[1]);const qty=numeric(m[3]);
 if(qty===null||/^(разом|всього|усього|підсум|найменування)/iu.test(name)||isNonSpecification({name,source:t})||!/[\p{L}]/u.test(name)){rejected++;continue}
 items.push({name,unit:clean(m[2]),qty,page:row.page||null,line:row.line||null,source:row.text,sourceMethod:row.sourceMethod||'text',confidence:'Потребує перевірки'});
 }return items}
async function analyze(file,options={}){if(typeof file!=='string'||!path.isAbsolute(file)||!fs.existsSync(file))throw Error('Файл не знайдено');const ext=path.extname(file).toLowerCase();let items=[],warnings=[],pages=null;
 if(ext==='.pdf'){const pdf=await require('./pdf-enhanced').pdfLines(file,{ocr:options.ocr===true});items=extractFromLines(pdf.lines);warnings=pdf.warnings;pages=pdf.pages;var classification=documentType(pdf.lines);if(classification==='environment')warnings.push('Документ класифіковано як екологічний: знайдені рядки не є підтвердженою специфікацією обладнання');
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
 return {file:path.basename(file),pages,items:items.slice(0,5000),totalFound:items.length,warnings,documentType:typeof classification==='undefined'?'table':classification};
}
function normalizeName(v){return key(v).replace(/[×хxХфøØ]/g,'x').replace(/(\d),(\d)/g,'$1.$2').replace(/\b(діам(?:етр)?|diameter)\b/g,'d').replace(/\b(шт\.?|штук|pcs)\b/g,' ').replace(/[^\p{L}\p{N}.]+/gu,' ').replace(/\s+/g,' ').trim()}
const generic=new Set(['для','та','або','від','типу','із','на','по','до','шт','комплект','виріб','монтаж','установка','робіт','обладнання','електричний','електрична','система','робота','виконання','з','у','і','й']);
function technicalTokens(name){return [...new Set((normalizeName(name).match(/[\p{L}\d]+(?:[.\-/][\p{L}\d]+)*/gu)||[]).filter(t=>t.length>2&&!generic.has(t)))];}
function specsOf(name){
 const s=normalizeName(name);const models=new Set((s.match(/\b(?=[a-zа-яіїєґ0-9.-]*\d)[a-zа-яіїєґ][a-zа-яіїєґ0-9.-]{3,}\b/giu)||[]).filter(t=>/\d/.test(t)));
 const dimensions=new Set((s.match(/\b\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?(?:\s*x\s*\d+(?:\.\d+)?)?\b/g)||[]).map(t=>t.replace(/\s/g,'')));
 const power=new Set((s.match(/(?<![\p{L}\d])\d+(?:\.\d+)?\s*(?:квт|вт|kw|w)(?![\p{L}\d])/giu)||[]).map(t=>t.replace(/\s/g,'')));
 const ip=new Set((s.match(/\bip\s*\d{2}\b/giu)||[]).map(t=>t.replace(/\s/g,'')));
 return {models,dimensions,power,ip};
}
// Technical constraints are safety gates, not evidence of a confirmed match.
function technicalValues(name){
 const s=normalizeName(name);const values={voltage:[],power:[],current:[],ip:[]};
 const rules={voltage:/(\d+(?:\.\d+)?)\s*(кв|kv|в|v)(?![\p{L}\d])/giu,power:/(\d+(?:\.\d+)?)\s*(квт|kw|вт|w)(?![\p{L}\d])/giu,current:/(\d+(?:\.\d+)?)\s*(а|amp)(?![\p{L}\d])/giu,ip:/\bip\s*(\d{2})\b/giu};
 for(const [type,re] of Object.entries(rules))for(const m of s.matchAll(re)){
  let n=Number(m[1]);if(type==='voltage'&&['в','v'].includes(m[2]))n/=1000;
  if(type==='power'&&['вт','w'].includes(m[2]))n/=1000;
  if(!values[type].includes(n))values[type].push(n);
 }return values;
}
function technicalConflicts(a,b){
 const x=technicalValues(a),y=technicalValues(b),conflicts=[];
 for(const field of ['voltage','power','current','ip'])if(x[field].length&&y[field].length&&!x[field].some(v=>y[field].some(w=>Math.abs(v-w)<1e-7)))conflicts.push(field);
 const xa=specsOf(a),xb=specsOf(b);
 if(xa.dimensions.size&&xb.dimensions.size&&![...xa.dimensions].some(v=>xb.dimensions.has(v)))conflicts.push('dimensions');
 return conflicts;
}
function candidateScore(a,b){
 if(technicalConflicts(a,b).length)return 0;
 const ta=technicalTokens(a),tb=technicalTokens(b);if(!ta.length||!tb.length)return 0;
 const aa=new Set(ta),bb=new Set(tb),shared=ta.filter(t=>bb.has(t));
 const sa=specsOf(a),sb=specsOf(b);
 for(const field of ['dimensions','power','ip'])if(sa[field].size&&sb[field].size&&![...sa[field]].some(t=>sb[field].has(t)))return 0;
 // Matching only a generic technical characteristic (e.g. 220V) is insufficient.
 const lexical=shared.filter(t=>!/^\d+(?:\.\d+)?$/.test(t));
 if(!lexical.length)return 0;
 const coverage=shared.length/Math.max(aa.size,bb.size);
 const distinctive=lexical.some(t=>t.length>=5||/\d/.test(t));
 const bonus=distinctive?0.12:0;
 return Math.min(1,coverage+bonus);
}
function suggestCandidates(item,est){
 const ua=unitOf(item.unit);
 return est.map((e,i)=>{const ub=unitOf(e.unit);let compatible=false;
  if(ua&&ub){try{compatible=canonical(ua,1).u===canonical(ub,1).u}catch{}}
  return {e,i,score:candidateScore(item.name,e.name),compatible};
 }).filter(x=>x.compatible&&x.score>=0.34).sort((a,b)=>b.score-a.score).slice(0,5);
}
function isNonSpecification(item){
 const name=key(item.name);const source=key(item.source||'');
 return /(?:газоподібні\s+фтористі\s+сполуки|окис\s+хрому|оксид\s+хрому|(?:оксид\s+(?:азоту|вуглецю|заліза|марганцю)|(?:азоту|вуглецю|заліза|марганцю)\s+оксид)|фториди\s+неорганічні|діоксид\s+(?:азоту|сірки)|викид[иів]|забруднююч[иа]|гранично\s+допустим)/u.test(name)||(/(?:викиди\s+забруднюючих|забруднюючих\s+речовин)/u.test(source)&&!/(?:кабель|вентилятор|болт|шафа)/u.test(name));
}
function quantityDiff(spec,estimate){const a=numeric(spec.qty),b=numeric(estimate.qty),ua=unitOf(spec.unit),ub=unitOf(estimate.unit);if(a===null||b===null||!ua||!ub)return null;try{const ca=canonical(ua,a),cb=canonical(ub,b);return ca.u===cb.u?Number((ca.q-cb.q).toFixed(6)):null}catch{return null}}
function compare(spec,estimate){
 if(!spec||!Array.isArray(spec.items)||!estimate||!Array.isArray(estimate.items))throw Error('Спочатку імпортуйте специфікацію та кошторис');
 const excluded=spec.items.filter(x=>x&&isNonSpecification(x));
 const specs=spec.items.filter(x=>x&&clean(x.name).length>4&&!isNonSpecification(x));
 const est=estimate.items.filter(x=>x&&clean(x.name).length>4);
 const rows=[],used=new Set();
 const normalizeCode=x=>key(x||'').replace(/\s+/g,'');
 for(const item of specs){
  const candidates=est.map((e,i)=>({e,i})).filter(({e})=>key(e.name)===key(item.name));
  let match=null,matchIndex=-1,status='Немає точного збігу назви (перевірити вручну)',diff=null;
  if(candidates.length===1&&!technicalConflicts(item.name,candidates[0].e.name).length){match=candidates[0].e;matchIndex=candidates[0].i}
  else if(candidates.length>1){
   const code=normalizeCode(item.code);
   const byCode=code?candidates.filter(({e})=>normalizeCode(e.code)===code):[];
   if(byCode.length===1&&!technicalConflicts(item.name,byCode[0].e.name).length){match=byCode[0].e;matchIndex=byCode[0].i}
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
  const best=suggestions[0];
  if(!match&&suggestions.length&&!status.startsWith('Неоднозначно')){status='Можливий відповідник — перевірити вручну';}
  if(!match&&candidates.some(x=>technicalConflicts(item.name,x.e.name).length))status='Конфлікт технічних параметрів — перевірити вручну';
  rows.push({candidateName:best?.e.name||'',candidateCode:best?.e.code||'',candidateQty:best?.e.qty??'',candidateUnit:best?.e.unit||'',candidateDiff:best?quantityDiff(item,best.e):null,candidateLocation:best?`${best.e.sheet||''}:${best.e.line??''}`:'',technicalCheck:match?'Перевірити за оригіналом':(status.startsWith('Конфлікт')?'Конфлікт параметрів':'Не підтверджено'),suggestions:suggestions.map(x=>({name:x.e.name,code:x.e.code||'',sheet:x.e.sheet||'',line:x.e.line??'',score:Number(x.score.toFixed(3)),qty:x.e.qty??'',unit:x.e.unit||'',difference:quantityDiff(item,x.e),index:x.i})),suggestedMatches:suggestions.map(x=>`${x.e.name} [${x.e.code||'без шифру'}; ${x.e.sheet||''}:${x.e.line||''}; ${Math.round(x.score*100)}%; кошторис ${x.e.qty??'—'} ${x.e.unit||''}; різниця ${quantityDiff(item,x.e)??'не визначено'}]`).join(' | '),sourceFile:item.sourceFile||spec.file||'',name:item.name,unitSpec:item.unit,qtySpec:item.qty,unitEstimate:match?.unit||'',qtyEstimate:match?.qty??'',diff,status,page:item.page??'',line:item.line??'',sheet:item.sheet||'',estimateSheet:match?.sheet||'',estimateLine:match?.line??'',estimateCode:match?.code||'',source:item.source||'',sourceMethod:item.sourceMethod||'text',review:'Попередня автоматична звірка: перевірити марку, характеристики, обсяги та креслення за оригіналами'});
 }
 // These are NOT automatically excess materials: drawings may have been incompletely read.
 est.forEach((e,i)=>{if(!used.has(i))rows.push({sourceFile:'',name:e.name,unitSpec:'',qtySpec:'',unitEstimate:e.unit||'',qtyEstimate:e.qty??'',diff:null,status:'Позиція кошторису без підтвердженого зіставлення',page:'',line:'',sheet:'',estimateSheet:e.sheet||'',estimateLine:e.line??'',estimateCode:e.code||'',source:'',sourceMethod:'estimate',review:'Не вважати зайвою: перевірити всі креслення та специфікації, зокрема нерозпізнані рядки'})});
 return {rows,summary:{excludedNonSpecification:excluded.length,spec:specs.length,estimate:est.length,matched:rows.filter(x=>x.status==='Текстовий збіг').length,review:rows.filter(x=>x.status!=='Текстовий збіг').length,unmatchedEstimate:rows.filter(x=>x.status==='Позиція кошторису без підтвердженого зіставлення').length}};
}
module.exports={analyze,compare,documentType,extractFromLines,extractGeometry,numeric,pdfLines,candidateScore,suggestCandidates,isNonSpecification,quantityDiff,technicalValues,technicalConflicts};
