'use strict';
// Conservative validation: flag unreliable fragments instead of fabricating positions.
const tidy=v=>String(v??'').replace(/\s+/g,' ').trim();
const units=/^(?:шт\.?|м|м²|м³|км|кг|т|м\.п\.?|п\.м\.?)$/iu;
function quality(item){
 const n=tidy(item.name),tokens=n.split(/\s+/),issues=[];
 if(!/[\p{L}]{3,}/u.test(n))issues.push('no-descriptive-word');
 if(tokens.length>=2&&tokens.filter(x=>units.test(x)).length>=Math.ceil(tokens.length*.6))issues.push('unit-only-name');
 if(/^(?:погоджено|розробив|перевірив|інв\.?\s*№|реконструкція\s+пс(?=\s|$))/iu.test(n))issues.push('drawing-title-or-stamp');
 if(/^\s*(?:\d+[.,]?\d*\s*)?(?:шафа|кабель|провід|муфта|коробка|вентилятор|конвектор)\s+[\p{L}]\s*$/iu.test(n))issues.push('truncated-name');
 return {reliable:issues.length===0,issues};
}
function splitQuality(items){const accepted=[],quarantined=[];for(const item of items){const q=quality(item);if(q.reliable)accepted.push(item);else quarantined.push({...item,qualityIssues:q.issues})}return {accepted,quarantined};}
module.exports={quality,splitQuality};
