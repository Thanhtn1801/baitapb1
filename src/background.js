import {validHTTPS, validClientID, decode64, encode64, driveID} from './shared.js';
const API='https://www.googleapis.com';
chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
async function token(){const {auth}=await chrome.storage.session.get('auth');if(!auth || auth.expires<Date.now()+60000)throw Error('Phiên Drive hết hạn. Bấm Kết nối Drive lại.');return auth.token;}
async function api(url,options={}){const r=await fetch(url,{...options,headers:{...options.headers,Authorization:`Bearer ${await token()}`}});if(!r.ok){if(r.status===401)await chrome.storage.session.remove('auth');throw Error(`Drive HTTP ${r.status}: ${(await r.text()).slice(0,400)}`);}return r;}
async function connect(clientID){
 validClientID(clientID);const state=crypto.randomUUID();const redirect=chrome.identity.getRedirectURL('drive');
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:clientID,redirect_uri:redirect,response_type:'token',scope:'https://www.googleapis.com/auth/drive.file',state,prompt:'select_account'});
 const callback=await chrome.identity.launchWebAuthFlow({url:url.href,interactive:true});const u=new URL(callback);if(u.origin+u.pathname!==redirect)throw Error('OAuth redirect không hợp lệ.');const params=new URLSearchParams(u.hash.slice(1));if(params.get('state')!==state)throw Error('OAuth state không hợp lệ.');if(params.get('error'))throw Error(params.get('error'));const access=params.get('access_token');const expires=Number(params.get('expires_in'));if(!access || !expires)throw Error('Google không trả về token Drive.');await chrome.storage.session.set({auth:{token:access,expires:Date.now()+expires*1000,clientID}});return {connected:true};
}
async function handle(m,sender){
 if(!sender.url?.startsWith(chrome.runtime.getURL('')) && !(sender.tab && sender.url?.startsWith('https://flow.google.com/')))throw Error('Nguồn yêu cầu không hợp lệ.');
 switch(m.type){
 case 'TAB':return sender.tab?.id;
 case 'JOB_EVENT':{if(!sender.tab)throw Error('Sự kiện không hợp lệ.');await chrome.runtime.sendMessage({type:'JOB_UPDATE',tabID:sender.tab.id,id:m.id,status:m.status,video:m.video,progress:m.progress}).catch(()=>{});return true;}
 case 'AUTH_STATUS':{const {auth}=await chrome.storage.session.get('auth');return {connected:!!auth && auth.expires>Date.now()+60000,redirect:chrome.identity.getRedirectURL('drive')};}
 case 'CONNECT':return connect(m.clientID);
 case 'DISCONNECT':{const {auth}=await chrome.storage.session.get('auth');await chrome.storage.session.remove('auth');if(auth)await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:auth.token})}).catch(()=>{});return true;}
 case 'FETCH_IMAGE':{
  const url=validHTTPS(m.url);if(!await chrome.permissions.contains({origins:[url.origin+'/*']}))throw Error(`Chưa cấp quyền đọc ảnh từ ${url.hostname}.`);
  const r=await fetch(url.href,{credentials:'omit',signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`Ảnh HTTP ${r.status}. Link Facebook có thể đã hết hạn.`);const mime=(r.headers.get('content-type')||'').split(';')[0];if(!['image/jpeg','image/png','image/webp','image/gif'].includes(mime))throw Error('Link trả về trang web, không phải ảnh. Cần link ảnh trực tiếp.');const b=await r.blob();if(b.size>20*1024*1024)throw Error('Ảnh vượt quá 20 MB.');const bytes=new Uint8Array(await b.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {base64:btoa(binary),mime};
 }
 case 'CALIBRATE':{const tab=await chrome.tabs.get(m.tabID);if(!tab.url?.startsWith('https://flow.google.com/'))throw Error('Mở dự án Flow trước.');return chrome.tabs.sendMessage(m.tabID,{type:'PICK_SELECTORS'},{frameId:0});}
 case 'PREPARE_RUN':{const tab=await chrome.tabs.get(m.tabID);if(!tab.url?.startsWith('https://flow.google.com/'))throw Error('Tab Flow đã đóng hoặc đổi địa chỉ.');await chrome.storage.session.remove('stop:'+m.tabID);return true;}
 case 'STOP':{await chrome.storage.session.set({['stop:'+m.tabID]:true});return chrome.tabs.sendMessage(m.tabID,{type:'STOP_FLOW'},{frameId:0});}
 case 'UPLOAD_REMOTE':{
  const url=validHTTPS(m.url);if(!await chrome.permissions.contains({origins:[url.origin+'/*']}))throw Error(`Cần quyền tải video từ ${url.hostname}. Thêm quyền host này rồi thử tải Drive lại.`);
  const response=await fetch(url.href,{credentials:'omit',signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error(`Video HTTP ${response.status}.`);const blob=await response.blob();if(!blob.type.startsWith('video/'))throw Error('Kết quả không phải video.');
  const {id}=await handle({type:'UPLOAD_START',size:blob.size,name:`flow-row-${m.job.row}-${m.job.id.slice(0,8)}.mp4`,folder:m.settings.folder,mime:blob.type},sender);
  await handle({type:'JOB_EVENT',id:m.job.id,status:'uploading',video:url.href},sender);let final;
  for(let offset=0;offset<blob.size;offset+=2*1024*1024){const stop=(await chrome.storage.session.get('stop:'+sender.tab.id))['stop:'+sender.tab.id];if(stop)throw Error('Đã dừng tải Drive.');const bytes=new Uint8Array(await blob.slice(offset,offset+2*1024*1024).arrayBuffer());final=await handle({type:'UPLOAD_CHUNK',id,offset,base64:encode64(bytes)},sender);await handle({type:'JOB_EVENT',id:m.job.id,status:'uploading',progress:Math.min(100,Math.round((offset+bytes.length)/blob.size*100))},sender);}
  if(!final?.done)throw Error('Chưa xác nhận kết quả tải Drive.');return {drive:final.url};
 }
 case 'UPLOAD_START':{
  if(!Number.isSafeInteger(m.size)||m.size<=0||m.size>1024*1024*1024)throw Error('Video rỗng hoặc lớn hơn 1 GB.');
  const meta={name:m.name,mimeType:'video/mp4'};if(m.folder)meta.parents=[driveID(m.folder)];
  const r=await api(`${API}/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink`,{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':m.mime||'video/mp4','X-Upload-Content-Length':String(m.size)},body:JSON.stringify(meta)});
  const location=r.headers.get('location');if(!location || new URL(location).origin!==API)throw Error('Drive không trả về phiên tải hợp lệ.');const id=crypto.randomUUID();await chrome.storage.session.set({['upload:'+id]:{location,size:m.size,offset:0}});return {id};
 }
 case 'UPLOAD_CHUNK':{
  const key='upload:'+m.id;const entry=(await chrome.storage.session.get(key))[key];if(!entry)throw Error('Phiên upload đã mất. Chạy lại bước tải Drive.');const bytes=decode64(m.base64);if(!bytes.length || bytes.length>4*1024*1024 || m.offset!==entry.offset || m.offset+bytes.length>entry.size)throw Error('Chunk upload không hợp lệ.');
  const end=m.offset+bytes.length-1;const r=await fetch(entry.location,{method:'PUT',headers:{Authorization:`Bearer ${await token()}`,'Content-Range':`bytes ${m.offset}-${end}/${entry.size}`},body:bytes});
  if(r.status===308){const range=r.headers.get('range');const accepted=range?Number(range.split('-')[1])+1:0;if(accepted!==end+1)throw Error('Drive chưa nhận đủ chunk; dừng để tránh hỏng video.');entry.offset=accepted;await chrome.storage.session.set({[key]:entry});return {offset:accepted};}
  if(!r.ok)throw Error(`Tải Drive thất bại: HTTP ${r.status}.`);const file=await r.json();if(end+1!==entry.size || !file.id)throw Error('Drive trả kết quả tải không đầy đủ.');await chrome.storage.session.remove(key);return {url:file.webViewLink||`https://drive.google.com/file/d/${file.id}/view`,done:true};
 }
 default:throw Error('Yêu cầu không được hỗ trợ.');
 }
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{handle(m,sender).then(value=>respond({ok:true,value}),e=>respond({ok:false,error:e.message}));return true;});
chrome.action.onClicked.addListener(async tab=>{if(tab.url?.startsWith('https://flow.google.com/'))await chrome.tabs.sendMessage(tab.id,{type:'TOGGLE_PANEL'},{frameId:0}).catch(()=>{});else await chrome.tabs.create({url:'https://flow.google.com/'});});
