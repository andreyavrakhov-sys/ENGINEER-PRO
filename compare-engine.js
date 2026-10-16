'use strict';
const norm=s=>String(s??'').toLocaleLowerCase('uk-UA').replace(/[«»“”"']/g,'').replace(/[–—−]/g,'-').replace(/\s+/g,' ').trim();
const number=s=>{const t=String(s??'').replace(/\u00a0/g,' ').trim();if(!/^[+-]?[\d\s]+(?:[.,]\d+)?$/.test(t))return null;const n=Number(t.replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)?n:null};
const units={'м':'m','м.':'m','п.м':'m','пог.м':'m','км':'km','100 м':'100m','100м':'100m','м2':'m2','м²':'m2','м3':'m3','м³':'m3','шт':'pcs','шт.':'pcs','од':'pcs','од.':'pcs','компл':'set','комплект':'set','т':'t','кг':'kg','1000 м':'1000m'};
function unit(s){return units[norm(s).replace(/\s+/g,' ')]||''}
function canonical(u,q){const map={km:['m',1000],m:['m',1],'100m':['m',100],'1000m':['m',1000],t:['kg',1000],kg:['kg',1]};const v=map[u];return v?{u:v[0],q:q*v[1]}:{u,q}}
function guessHeaders(rows){const words={name:/найменуван|назва|опис|робіт|матеріал|обґрунтуван|позиці|description|item/i,qty:/кількіст|обсяг|quantity|^к-?сть$/i,unit:/одиниц|од\.?\s*вим|unit/i,code:/шифр|код|норм|обґрунтуван|code/i};let best={score:-1,index:0};rows.slice(0,35).forEach((r,i)=>{const found={};r.forEach((v,j)=>{for(const [k,re] of Object.entries(words))if(re.test(String(v))&&found[k]===undefined)found[k]=j});const score=Object.keys(found).length+(found.name!==undefined?2:0);if(score>best.score)best={score,index:i,found}});return best.score>=3?{header:best.index,...best.found}:{header:-1,name:1,unit:2,qty:3,code:0}}
function parse(rows,override){const c=override||guessHeaders(rows);const out=[];rows.slice(c.header+1).forEach((r,i)=>{const name=String(r[c.name]??'').trim();if(name.length<5||/^(разом|всього|підсум|усього)/i.test(name))return;const q=number(r[c.qty]);const u=unit(r[c.unit]);const code=String(r[c.code]??'').trim();if(q===null&&!u)return;out.push({line:i+c.header+2,name,code,unit:u||String(r[c.unit]??'').trim(),qty:q,raw:r.join(' | ')})});return {columns:c,items:out}}
function classify(item){
 const code=String(item.code||'').trim().toUpperCase();
 const name=norm(item.name);
 if(/^(С\d|С[0-9]|&С|М\d|\d{1,3}[-.]\d)/u.test(code)||/\b(кабель|провід|лоток|автоматичний вимикач|труба|муфта|клема|розетка|кріплення|матеріал|обладнання)\b/u.test(name))return 'Матеріал / обладнання (попередньо)';
 if(/^(КР|КБ|Е\d|ЕН|РН|М\d|Ц\d)/u.test(code)||/\b(монтаж|демонтаж|прокладання|установлення|влаштування|випробування|налагодження)\b/u.test(name))return 'Робота (попередньо)';
 return 'Тип не визначено';
}
function compare(a,b){const left=parse(a),right=parse(b);const byName=new Map();right.items.forEach((v,i)=>{const k=norm(v.name);if(!byName.has(k))byName.set(k,[]);byName.get(k).push({v,i})});const used=new Set(),results=[];for(const x of left.items){const matches=(byName.get(norm(x.name))||[]).filter(z=>!used.has(z.i));if(matches.length!==1){results.push({name:x.name,code:x.code,unitA:x.unit,qtyA:x.qty,unitB:'',qtyB:null,diff:null,status:matches.length?'Неоднозначно: кілька збігів':'Відсутня у B',lineA:x.line,lineB:'',rawA:x.raw,rawB:''});continue}const {v:y,i}=matches[0];used.add(i);let status='Збіг назви, обсяг не підтверджено',diff=null;if(x.qty!==null&&y.qty!==null){const cx=canonical(x.unit,x.qty),cy=canonical(y.unit,y.qty);if(cx.u&&cx.u===cy.u){diff=Number((cx.q-cy.q).toFixed(6));status=Math.abs(diff)<1e-7?'Збіг назви, одиниці та кількості':'Розбіжність кількості'}else status='Несумісні або невідомі одиниці'}results.push({name:x.name,code:x.code,unitA:x.unit,qtyA:x.qty,unitB:y.unit,qtyB:y.qty,diff,status,lineA:x.line,lineB:y.line,rawA:x.raw,rawB:y.raw})}
right.items.forEach((y,i)=>{if(!used.has(i))results.push({name:y.name,code:y.code,unitA:'',qtyA:null,unitB:y.unit,qtyB:y.qty,diff:null,status:'Додаткова позиція у B',lineA:'',lineB:y.line,rawA:'',rawB:y.raw})});
for(const r of results){
 r.type=classify({name:r.name,code:r.code});
 r.codeCheck=(r.lineA&&r.lineB)?'Перевірити відповідність шифру за оригіналом':'Шифр не зіставлено';
 r.review='Потребує перевірки за проєктом і кошторисними нормами';
}
return {results,summary:{rowsA:left.items.length,rowsB:right.items.length,matched:results.filter(x=>x.status==='Збіг назви, одиниці та кількості').length,discrepancies:results.filter(x=>x.status!=='Збіг назви, одиниці та кількості').length},columnsA:left.columns,columnsB:right.columns}}
module.exports={compare,parse,number,unit,canonical,classify};
