'use strict';
// Structured PDF text extraction with optional, explicitly requested OCR.
// No fabricated units/quantities: downstream parser accepts only complete rows.
const fs=require('fs'),path=require('path');
const MAX=25*1024*1024, MAX_PAGES=150, OCR_PAGES=12;
function tidy(v){return String(v||'').replace(/\s+/g,' ').trim()}
function requirePdf(){try{return require('pdfjs-dist/legacy/build/pdf.js')}catch(e){throw Error('PDF.js недоступний. Перевірте встановлення залежності pdfjs-dist: '+e.message)}}
function makeLines(items,page){
 const groups=[];
 for(const it of items){const str=tidy(it.str);if(!str)continue;
  const x=Number(it.transform?.[4]||0),y=Number(it.transform?.[5]||0),height=Math.abs(Number(it.height||it.transform?.[0]||10));
  let group=groups.find(g=>Math.abs(g.y-y)<=Math.max(2.5,Math.min(5,height*.3)));
  if(!group){group={y,parts:[]};groups.push(group)}group.parts.push({x,str,width:Math.abs(Number(it.width||0))});
 }
 return groups.sort((a,b)=>b.y-a.y).map((g,i)=>{
  const sorted=g.parts.sort((a,b)=>a.x-b.x);let text='',prev=null;
  for(const p of sorted){const gap=prev?p.x-(prev.x+prev.width):0;
   if(text && (gap>1.5 || !/\s$/.test(text)))text+=' ';
   text+=p.str;prev=p;
  }
  return {page,line:i+1,y:g.y,text:tidy(text),parts:sorted,sourceMethod:'pdfjs-text'};
 }).filter(x=>x.text);
}
async function ocrPage(page,pageNumber,warnings){
 let canvasMod,tesseract;
 try{canvasMod=require('@napi-rs/canvas');tesseract=require('tesseract.js')}catch(e){warnings.push('OCR стор. '+pageNumber+': відсутні модулі @napi-rs/canvas / tesseract.js ('+e.message+')');return []}
 let worker;
 try{
  const viewport=page.getViewport({scale:1.7});const pixels=viewport.width*viewport.height;
  if(pixels>16000000){warnings.push('OCR стор. '+pageNumber+': надто велика сторінка');return []}
  const canvas=canvasMod.createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));const ctx=canvas.getContext('2d');
  await page.render({canvasContext:ctx,viewport}).promise;
  // Tesseract language data may require first-time download; no fake OCR on failure.
  worker=await tesseract.createWorker('ukr+eng',1);
  const result=await worker.recognize(canvas.toBuffer('image/png'));
  const raw=String(result?.data?.text||'');
  if(!raw.trim()){warnings.push('OCR стор. '+pageNumber+': текст не розпізнано');return []}
  return raw.split(/\r?\n/).map((text,i)=>({page:pageNumber,line:i+1,text:tidy(text),sourceMethod:'ocr-ukr-eng'})).filter(x=>x.text);
 }catch(e){warnings.push('OCR стор. '+pageNumber+': '+e.message+' (перевірте доступність мовних даних ukr+eng)');return []}
 finally{if(worker)await worker.terminate().catch(()=>{})}
}
async function pdfLines(file,options={}){
 if(typeof file!=='string'||!path.isAbsolute(file)||!fs.existsSync(file))throw Error('PDF не знайдено');
 const stat=fs.statSync(file);if(!stat.isFile()||stat.size>MAX)throw Error('PDF понад 25 МБ або не є файлом');
 const pdfjs=requirePdf(),bytes=new Uint8Array(fs.readFileSync(file));
 const task=pdfjs.getDocument({data:bytes,useSystemFonts:true,disableFontFace:true,isEvalSupported:false});
 const warnings=[],lines=[];let doc;
 try{
  doc=await task.promise;const total=doc.numPages,limit=Math.min(total,MAX_PAGES);
  let usedOCR=0;
  for(let i=1;i<=limit;i++){
   const page=await doc.getPage(i);
   try{
    const content=await page.getTextContent({disableCombineTextItems:false});
    let pageLines=makeLines(content.items||[],i);
    const textChars=pageLines.reduce((n,r)=>n+r.text.length,0);
    if(options.ocr===true&&textChars<40&&usedOCR<OCR_PAGES){
     usedOCR++;const recognized=await ocrPage(page,i,warnings);
     if(recognized.length)pageLines=recognized;
    }else if(textChars<40){warnings.push('Стор. '+i+': текстовий шар відсутній або замалий'+(options.ocr===true?' (ліміт OCR — '+OCR_PAGES+' стор.)':'; увімкніть OCR для сканів'))}
    lines.push(...pageLines);
   }finally{page.cleanup()}
  }
  if(total>MAX_PAGES)warnings.push('Проаналізовано лише перші '+MAX_PAGES+' сторінок');
  if(options.ocr===true)warnings.push('OCR увімкнено лише для сторінок без достатнього текстового шару; не більше '+OCR_PAGES+' сторінок. Мовні дані можуть завантажуватися при першому запуску.');
  return {lines,warnings,pages:total,engine:'pdfjs-dist',ocr:options.ocr===true};
 }finally{if(doc)await doc.destroy().catch(()=>{});else await task.destroy().catch(()=>{})}
}
module.exports={pdfLines,makeLines,ocrPage};
