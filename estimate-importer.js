'use strict';
const fs=require('fs');
const {read}=require('./document-reader');
const numeric=s=>{const t=String(s??'').trim().replace(/\s/g,'').replace(',','.');return /^[-+]?\d+(\.\d+)?$/.test(t)?Number(t):null};
const clean=s=>String(s??'').replace(/\r/g,'').trim();
function extractRows(rows,sheet='Аркуш'){
 let estimate='',section='',out=[],warnings=[],last=null,skipped=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],a=clean(r[0]),b=clean(r[1]),c=clean(r[2]),d=clean(r[3]),e=numeric(r[4]);
  const title=(a+' '+b+' '+c).match(/Локальний кошторис на [^\n]*?№\s*([\d-]+)/i);
  if(title)estimate=title[1];
  if(!a&&!b&&/^Розділ\s*№/i.test(c)){section=c;continue}
  if(!/^\d+$/.test(a)||!b||!c||e===null||!/[А-ЯІЇЄҐA-Z]/iu.test(b)||/^\d+$/.test(c)){if(/^\d+$/.test(a)&&b&&c&&e===null)skipped++;continue}
  const code=(b.match(/^\s*([А-ЯІЇЄҐA-Z]{1,6}\s*\d+[-.\d]*)/iu)||[])[1]||b.split('\n')[0];
  const coeffs=[...b.matchAll(/\bK\d+\s*=\s*[\d,.]+/gi)].map(m=>m[0]);
  const item={sheet,estimate,section,line:i+1,number:Number(a),code:clean(code),basis:b,name:c,unit:d,qty:e,unitPrice:numeric(r[5]),total:numeric(r[7]),coefficients:coeffs,kind:/^(КБ|КР|КМ|КП|ЕН|Е\d)/iu.test(code)?'Робота (за префіксом)':/^С\d/iu.test(code)?'Ресурс / перевезення (за префіксом)':'Тип потребує перевірки'};
  if(last&&last.number===item.number&&last.code===item.code&&last.name===item.name){warnings.push(`Повтор позиції ${a} у рядку ${i+1}: пропущено дубль`);continue}
  out.push(item);last=item;
 }
 return {items:out,skipped,warnings,estimate};
}
function extractFile(p){const data=read(p);if(!data.rows)throw Error('Потрібен XLSX/CSV з табличними даними');const sheets=data.sheets||[{name:data.name,rows:data.rows}];const items=[],warnings=[];for(const s of sheets){const parsed=extractRows(s.rows,s.name);items.push(...parsed.items);warnings.push(...parsed.warnings.slice(0,10));}
 return {filename:data.name,sheetCount:sheets.length,items,warnings,notice:data.notice||'',counts:{total:items.length,works:items.filter(x=>x.kind.startsWith('Робота')).length,resources:items.filter(x=>x.kind.startsWith('Ресурс')).length,unknown:items.filter(x=>x.kind.startsWith('Тип')).length}};
}
module.exports={extractRows,extractFile};
