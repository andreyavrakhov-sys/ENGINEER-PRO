const {app,BrowserWindow,ipcMain,dialog,safeStorage,shell}=require('electron');
const fs=require('fs'),path=require('path'),os=require('os');
let win;const base=()=>app.getPath('userData');const store=(n)=>path.join(base(),n);
function read(n,fallback){try{return JSON.parse(fs.readFileSync(store(n),'utf8'))}catch{return fallback}}
function write(n,obj){fs.writeFileSync(store(n),JSON.stringify(obj,null,2),'utf8')}
function create(){win=new BrowserWindow({width:1480,height:920,minWidth:980,minHeight:560,backgroundColor:'#101318',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});win.loadFile('index.html');win.setMenuBarVisibility(false)}
const {autoUpdater}=require('electron-updater');
const updateConfig=require('./update-config.json');
const updateEnabled=Boolean(updateConfig.githubOwner&&updateConfig.githubRepo);
let updateState={status:updateEnabled?'Очікування перевірки':'Оновлення не налаштовані',version:app.getVersion()};
function emitUpdate(status,extra={}){updateState={...updateState,status,...extra};if(win&&!win.isDestroyed())win.webContents.send('update:status',updateState)}
if(updateEnabled){
 autoUpdater.autoDownload=true;
 autoUpdater.autoInstallOnAppQuit=true;
 autoUpdater.setFeedURL({provider:'github',owner:updateConfig.githubOwner,repo:updateConfig.githubRepo});
 autoUpdater.on('checking-for-update',()=>emitUpdate('Перевіряємо оновлення…'));
 autoUpdater.on('update-available',i=>emitUpdate('Завантажуємо версію '+i.version,{available:true,version:i.version,downloaded:false}));
 autoUpdater.on('update-not-available',()=>emitUpdate('Установлено останню версію',{available:false,downloaded:false}));
 autoUpdater.on('download-progress',p=>emitUpdate('Завантаження: '+Math.round(p.percent)+'%'));
 autoUpdater.on('update-downloaded',()=>emitUpdate('Оновлення завантажено. Перезапустіть програму.',{downloaded:true}));
 autoUpdater.on('error',e=>emitUpdate('Помилка оновлення: '+e.message));
}
ipcMain.handle('update:status',()=>updateState);
ipcMain.handle('update:check',async()=>{if(!updateEnabled)return updateState;if(!app.isPackaged){emitUpdate('Перевірка доступна лише у встановленій версії');return updateState}try{await autoUpdater.checkForUpdates()}catch(e){emitUpdate('Помилка: '+e.message)}return updateState});
ipcMain.handle('update:download',async()=>{if(!updateEnabled)throw Error('Оновлення не налаштовані');await autoUpdater.downloadUpdate();return true});
ipcMain.handle('update:install',()=>{if(updateState.downloaded)autoUpdater.quitAndInstall(false,true);return true});
app.whenReady().then(()=>{create();if(updateEnabled&&app.isPackaged)setTimeout(()=>autoUpdater.checkForUpdates().catch(e=>emitUpdate('Помилка: '+e.message)),12000)});app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)create()});
ipcMain.handle('data:get',()=>read('data.json',{tasks:[],notes:'',links:[],projects:[]}));
ipcMain.handle('data:save',(_e,v)=>{if(JSON.stringify(v).length>3e6)throw Error('Забагато даних');write('data.json',v);return true});
ipcMain.handle('system:stats',()=>({platform:os.platform(),hostname:os.hostname(),cpu:os.cpus()[0]?.model||'—',cores:os.cpus().length,free:os.freemem(),total:os.totalmem(),uptime:os.uptime(),load:os.loadavg(),drives:'Дані про диски не підключено'}));
ipcMain.handle('file:pick',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile','multiSelections'],filters:[{name:'Документи',extensions:['pdf','xlsx','xls','docx','csv','txt','md','json']},{name:'Усі файли',extensions:['*']} ]});return r.canceled?[]:r.filePaths.map(p=>({name:path.basename(p),path:p}))});
ipcMain.handle('file:open',async(_e,p)=>{if(typeof p!=='string'||!path.isAbsolute(p)||!fs.existsSync(p))throw Error('Файл не знайдено');return shell.openPath(p)});
ipcMain.handle('folder:open',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openDirectory']});if(r.canceled)return null;await shell.openPath(r.filePaths[0]);return r.filePaths[0]});
ipcMain.handle('file:text',async(_e,p)=>{if(!/\.(txt|md|csv|json)$/i.test(p))throw Error('Для цього формату потрібен модуль обробки документів');if(fs.statSync(p).size>2e6)throw Error('Файл понад 2 МБ');return fs.readFileSync(p,'utf8')});
ipcMain.handle('secrets:set',(_e,{provider,key})=>{if(!['openai','gemini','anthropic','openrouter'].includes(provider))throw Error('Невідомий провайдер');if(!safeStorage.isEncryptionAvailable())throw Error('Захищене сховище недоступне');const s=read('secrets.json',{});s[provider]=safeStorage.encryptString(key).toString('base64');write('secrets.json',s);return true});
ipcMain.handle('secrets:status',()=>Object.keys(read('secrets.json',{})));
const keyPages={openai:'https://platform.openai.com/api-keys',gemini:'https://aistudio.google.com/app/apikey',anthropic:'https://console.anthropic.com/settings/keys',openrouter:'https://openrouter.ai/settings/keys'};
ipcMain.handle('secrets:open-page',async(_e,provider)=>{if(!Object.hasOwn(keyPages,provider))throw Error('Невідомий провайдер');await shell.openExternal(keyPages[provider]);return true});
ipcMain.handle('secrets:import',async()=>{
 if(!safeStorage.isEncryptionAvailable())throw Error('Захищене сховище недоступне');
 const result=await dialog.showOpenDialog(win,{title:'Імпорт API-ключів',properties:['openFile'],filters:[{name:'Ключі JSON або TXT',extensions:['json','txt']}]});
 if(result.canceled)return {canceled:true};
 const file=result.filePaths[0];if(fs.statSync(file).size>32768)throw Error('Файл ключів має бути меншим за 32 КБ');
 const raw=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');let values={};
 if(/\.json$/i.test(file)){
  let parsed;try{parsed=JSON.parse(raw)}catch{throw Error('Некоректний JSON')}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Очікується JSON-об’єкт');
  values=parsed.keys&&typeof parsed.keys==='object'&&!Array.isArray(parsed.keys)?parsed.keys:parsed;
 }else{
  for(const line of raw.split(/\r?\n/)){
   const trimmed=line.trim();if(!trimmed||trimmed.startsWith('#'))continue;
   const match=trimmed.match(/^([a-zA-Z_]+)\s*=\s*(.+)$/);if(!match)throw Error('TXT: використовуйте формат openai=ключ');
   values[match[1].toLowerCase()]=match[2].trim().replace(/^['"]|['"]$/g,'');
  }
 }
 const aliases={OPENAI_API_KEY:'openai',GEMINI_API_KEY:'gemini',GOOGLE_API_KEY:'gemini',ANTHROPIC_API_KEY:'anthropic',OPENROUTER_API_KEY:'openrouter'};
 const normalized={};for(const [name,value] of Object.entries(values)){
  const provider=aliases[name]||name.toLowerCase();
  if(!Object.hasOwn(keyPages,provider))continue;
  if(typeof value!=='string'||!value.trim()||value.length>4096)throw Error('Некоректний ключ для '+provider);
  normalized[provider]=value.trim();
 }
 if(!Object.keys(normalized).length)throw Error('У файлі немає підтримуваних ключів: openai, gemini, anthropic, openrouter');
 const saved=read('secrets.json',{});for(const [provider,key] of Object.entries(normalized))saved[provider]=safeStorage.encryptString(key).toString('base64');
 write('secrets.json',saved);return {imported:Object.keys(normalized)};
});

function getKey(provider){const v=read('secrets.json',{})[provider];if(!v)throw Error('Додайте API-ключ у налаштуваннях');return safeStorage.decryptString(Buffer.from(v,'base64'))}
async function request(url,opts){const controller=new AbortController();const t=setTimeout(()=>controller.abort(),60000);try{const r=await fetch(url,{...opts,signal:controller.signal});const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{throw Error('Сервер повернув не-JSON відповідь')}if(!r.ok)throw Error(`HTTP ${r.status}: `+(data.error?.message||data.message||'Помилка API'));return data}finally{clearTimeout(t)}}
async function askOne({provider,model,prompt}){if(typeof prompt!=='string'||!prompt.trim()||prompt.length>30000)throw Error('Некоректний запит');if(!/^[\w.\-/:]{1,120}$/.test(model))throw Error('Некоректна назва моделі');if(provider==='openai'){const d=await request('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+getKey(provider)},body:JSON.stringify({model,messages:[{role:'user',content:prompt}]})});return d.choices?.[0]?.message?.content||'Порожня відповідь'}if(provider==='gemini'){const d=await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':getKey(provider)},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});return d.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n')||'Порожня відповідь'}if(provider==='anthropic'){const d=await request('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':getKey(provider),'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:2048,messages:[{role:'user',content:prompt}]})});return d.content?.map(c=>c.text||'').join('\n')||'Порожня відповідь'}if(provider==='openrouter'){const d=await request('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+getKey(provider),'HTTP-Referer':'https://github.com/andreyavrakhov-sys/ENGINEER-PRO','X-Title':'ENGINEER PRO'},body:JSON.stringify({model,messages:[{role:'user',content:prompt}]})});return d.choices?.[0]?.message?.content||'Порожня відповідь'}if(provider==='ollama'){const d=await request('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,prompt,stream:false})});return d.response||'Порожня відповідь'}throw Error('Невідомий провайдер')};
ipcMain.handle('ai:ask',async(_e,args)=>askOne(args));

// Auto mode: sequential fallback. Each candidate uses its own valid credentials.
// Never use paid APIs automatically. No key rotation to evade provider limits.
ipcMain.handle('ai:auto',async(_e,{prompt,allowPaid=false})=>{
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>30000)throw Error('Некоректний запит');
 const available=new Set(Object.keys(read('secrets.json',{})));
 const candidates=[
  ...(available.has('gemini')?[{provider:'gemini',model:'gemini-2.5-flash'}]:[]),
  ...(available.has('openrouter')?[{provider:'openrouter',model:'openrouter/free'}]:[]),
  {provider:'ollama',model:'llama3.2'},
  ...(allowPaid?[
   ...(available.has('openai')?[{provider:'openai',model:'gpt-4o-mini'}]:[]),
   ...(available.has('anthropic')?[{provider:'anthropic',model:'claude-3-5-haiku-latest'}]:[])
  ]:[])
 ];
 const attempts=[];
 for(const item of candidates){
  try{const answer=await askOne({...item,prompt});if(answer&&answer!=='Порожня відповідь')return {answer,provider:item.provider,model:item.model,attempts};throw Error('Порожня відповідь')}
  catch(e){attempts.push(item.provider+': '+e.message)}
 }
 throw Error('Усі доступні провайдери не відповіли. '+attempts.join(' | '));
});

const documentReader=require('./document-reader');
ipcMain.handle('document:read',async(_e,p)=>documentReader.read(p));

const {compare:compareEngineeringDocs}=require('./compare-engine');
ipcMain.handle('document:compare',(_event,{a,b})=>{if(!Array.isArray(a)||!Array.isArray(b)||a.length>3000||b.length>3000)throw Error('Некоректні або завеликі таблиці');return compareEngineeringDocs(a,b)});

const estimateImporter=require('./estimate-importer');
ipcMain.handle('estimate:import',(_e,p)=>estimateImporter.extractFile(p));
const specificationAnalyzer=require('./specification-analyzer');
ipcMain.handle('spec:analyze',(_e,args)=>specificationAnalyzer.analyze(typeof args==='string'?args:args.path,{ocr:args?.ocr===true}));
ipcMain.handle('spec:compare',(_e,{spec,estimate})=>specificationAnalyzer.compare(spec,estimate));

const {execFile}=require('child_process');
const crypto=require('crypto');
const shortcutsFile='launchers.json';
function getShortcuts(){return read(shortcutsFile,[])}
ipcMain.handle('launchers:list',()=>getShortcuts());
ipcMain.handle('launchers:add',async(_event,kind)=>{
 if(!['app','folder'].includes(kind))throw Error('Невідомий тип ярлика');
 const options=kind==='app'?{title:'Оберіть програму',properties:['openFile'],filters:[{name:'Програми Windows',extensions:['exe'] }]}:{title:'Оберіть папку',properties:['openDirectory']};
 const r=await dialog.showOpenDialog(win,options);
 if(r.canceled||!r.filePaths.length)return null;
 const p=r.filePaths[0];const stat=fs.statSync(p);
 if(kind==='app'&&(!stat.isFile()||path.extname(p).toLowerCase()!=='.exe'))throw Error('Потрібен файл .exe');
 if(kind==='folder'&&!stat.isDirectory())throw Error('Потрібна папка');
 const items=getShortcuts();if(items.some(x=>x.path.toLowerCase()===p.toLowerCase()))return null;
 const item={id:crypto.randomUUID(),kind,name:path.basename(p),path:p};items.push(item);write(shortcutsFile,items);return item;
});
ipcMain.handle('launchers:remove',(_event,id)=>{const items=getShortcuts();write(shortcutsFile,items.filter(x=>x.id!==id));return true});
ipcMain.handle('launchers:open',async(_event,id)=>{
 const item=getShortcuts().find(x=>x.id===id);if(!item)throw Error('Ярлик не знайдено');
 const p=item.path;if(!path.isAbsolute(p)||!fs.existsSync(p))throw Error('Шлях більше не існує');
 const stat=fs.statSync(p);
 if(item.kind==='folder'){if(!stat.isDirectory())throw Error('Це не папка');const error=await shell.openPath(p);if(error)throw Error(error);return true}
 if(item.kind!=='app'||!stat.isFile()||path.extname(p).toLowerCase()!=='.exe')throw Error('Неприпустимий файл програми');
 if(process.platform!=='win32')throw Error('Запуск EXE підтримується у Windows');
 await new Promise((resolve,reject)=>{const child=execFile(p,[],{cwd:path.dirname(p),windowsHide:false},err=>{if(err)console.error('Програма завершилась:',err.message)});child.once('spawn',resolve);child.once('error',reject)});
 return true;
});
