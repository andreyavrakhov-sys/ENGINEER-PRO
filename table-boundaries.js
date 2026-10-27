'use strict';
// Only remove well-formed section headings at the END of an equipment name.
// Never change quantities, units or inferred model numbers.
const tidy=s=>String(s??'').replace(/\s+/g,' ').trim();
const heading=/(?:\s+|^)(\d{1,2}\s*[.)]\s*(?:Кабельні\s+вироби|Електроустановочні\s+вироби|Матеріали|Обладнання|Кабелі\s+та\s+проводи))\s*$/iu;
function cleanSectionHeading(name){const source=tidy(name);const cleaned=source.replace(heading,'').trim();return {name:cleaned,removed:cleaned!==source,heading:cleaned!==source?source.slice(cleaned.length).trim():''};}
function applySectionBoundaries(items){let cleaned=0;const results=items.map(item=>{const r=cleanSectionHeading(item.name);if(!r.removed)return item;cleaned++;return {...item,name:r.name,originalName:item.originalName||item.name,sectionHeadingRemoved:r.heading};});return {items:results,cleaned};}
module.exports={cleanSectionHeading,applySectionBoundaries};
