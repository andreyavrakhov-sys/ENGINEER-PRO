const {app,BrowserWindow,ipcMain,dialog,safeStorage,shell}=require('electron');
const fs=require('fs'),path=require('path'),os=require('os');
let win;const base=()=>app.getPath('userData');const store=(n)=>path.join(base(),n);
function read(n,fallback){try{return JSON.parse(fs.readFileSync(store(n),'utf8'))}catch{return fallback}}
function write(n,obj){fs.writeFileSync(store(n),JSON.stringify(obj,null,2),'utf8')}
function create(){win=new BrowserWindow({width:1480,height:920,minWidth:980,minHeight:650,backgroundColor:'#101318',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});win.loadFile('index.html');win.setMenuBarVisibility(false)}
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
ipcMain.handle('secrets:set',(_e,{provider,key})=>{if(!['openai','gemini','anthropic'].includes(provider))throw Error('Невідомий провайдер');if(!safeStorage.isEncryptionAvailable())throw Error('Захищене сховище недоступне');const s=read('secrets.json',{});s[provider]=safeStorage.encryptString(key).toString('base64');write('secrets.json',s);return true});
ipcMain.handle('secrets:status',()=>Object.keys(read('secrets.json',{})));
function getKey(provider){const v=read('secrets.json',{})[provider];if(!v)throw Error('Додайте API-ключ у налаштуваннях');return safeStorage.decryptString(Buffer.from(v,'base64'))}
async function request(url,opts){const controller=new AbortController();const t=setTimeout(()=>controller.abort(),60000);try{const r=await fetch(url,{...opts,signal:controller.signal});const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{throw Error('Сервер повернув не-JSON відповідь')}if(!r.ok)throw Error(data.error?.message||data.message||`HTTP ${r.status}`);return data}finally{clearTimeout(t)}}
ipcMain.handle('ai:ask',async(_e,{provider,model,prompt})=>{if(typeof prompt!=='string'||!prompt.trim()||prompt.length>30000)throw Error('Некоректний запит');if(!/^[\w.\-/:]{1,120}$/.test(model))throw Error('Некоректна назва моделі');if(provider==='openai'){const d=await request('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+getKey(provider)},body:JSON.stringify({model,messages:[{role:'user',content:prompt}]})});return d.choices?.[0]?.message?.content||'Порожня відповідь'}if(provider==='gemini'){const d=await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':getKey(provider)},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});return d.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n')||'Порожня відповідь'}if(provider==='anthropic'){const d=await request('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':getKey(provider),'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:2048,messages:[{role:'user',content:prompt}]})});return d.content?.map(c=>c.text||'').join('\n')||'Порожня відповідь'}if(provider==='ollama'){const d=await request('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,prompt,stream:false})});return d.response||'Порожня відповідь'}throw Error('Невідомий провайдер')});
