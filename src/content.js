import {rpc,encode64} from './shared.js';
let host,stopped=false,running=false,calibrating=false;
function visible(el){return el.getClientRects().length && getComputedStyle(el).visibility!=='hidden';}
function nodes(selector){try{return [...document.querySelectorAll(selector)];}catch{throw Error('CSS selector không hợp lệ: '+selector);}}
function unique(selector,label,hidden=false){const els=nodes(selector).filter(el=>hidden||visible(el));if(els.length!==1)throw Error(`${label}: cần đúng 1 phần tử, tìm thấy ${els.length}. Mở Cấu hình → Bộ chọn Flow để điều chỉnh.`);return els[0];}
function check(){if(stopped)throw Error('Đã dừng. Nếu Flow đã nhận lệnh tạo, video vẫn tiếp tục render trong Flow.');}
async function waitFor(fn,timeout,label){const deadline=Date.now()+timeout;while(Date.now()<deadline){check();const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,500));}throw Error(`Hết thời gian chờ ${label}. Kiểm tra Flow; không tự gửi lại lệnh tạo.`);}
function label(el){return ((el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||'')+' '+el.textContent).trim();}
function buttonByText(pattern){const matches=nodes('button,[role=button],[role=menuitem]').filter(visible).filter(el=>pattern.test(label(el)));if(matches.length===1)return matches[0];return null;}
function composer(settings){const prompt=unique(settings.promptSelector,'Ô prompt');return prompt.closest('form')||prompt.parentElement?.parentElement;}
async function attach(job,settings){
 const existing=nodes(settings.attachmentSelector).filter(visible);
 if(existing.length){
  if(!settings.removeSelector)throw Error('Flow còn ảnh đính kèm từ dòng trước. Cấu hình selector nút xóa ảnh để tự chuyển dòng an toàn.');
  for(let i=0;i<existing.length;i++){check();unique(settings.removeSelector,'Nút xóa ảnh cũ').click();await new Promise(r=>setTimeout(r,300));}
  await waitFor(()=>nodes(settings.attachmentSelector).filter(visible).length===0,10000,'xóa ảnh cũ');
 }

 let input=nodes(settings.fileSelector).filter(el=>!el.disabled && (el.accept.includes('image')||!el.accept));
 if(input.length!==1){const plus=settings.addSelector?unique(settings.addSelector,'Nút thêm ảnh'): [...composer(settings).querySelectorAll('button')].filter(visible).find(el=>/^(add|add_2|\+)$/.test(el.textContent.trim())||/^(Thêm|Add)( image| ảnh)?$/i.test(el.getAttribute('aria-label')||''));if(!plus)throw Error('Không tìm được nút +. Cấu hình selector nút thêm ảnh.');plus.click();await new Promise(r=>setTimeout(r,600));const upload=settings.uploadSelector?unique(settings.uploadSelector,'Mục tải ảnh'):buttonByText(/^(upload|tải lên|tải ảnh|upload image|upload an image)(\s|$)/i);if(upload)upload.click();input=await waitFor(()=>{const matches=nodes(settings.fileSelector).filter(el=>!el.disabled&&(el.accept.includes('image')||!el.accept));return matches.length===1?matches:null;},10000,'ô tải ảnh');}
 const before=new Set(nodes(settings.attachmentSelector).map(el=>el.src||el.getAttribute('data-id')));
 const bytes=Uint8Array.from(atob(job.image.base64),c=>c.charCodeAt(0));const file=new File([bytes],`row-${job.row}.${job.image.mime.split('/')[1]}`,{type:job.image.mime});const dt=new DataTransfer();dt.items.add(file);input[0].files=dt.files;input[0].dispatchEvent(new Event('input',{bubbles:true}));input[0].dispatchEvent(new Event('change',{bubbles:true}));
 await waitFor(()=>nodes(settings.attachmentSelector).filter(visible).some(el=>el instanceof HTMLImageElement && el.complete && el.naturalWidth>0&&!before.has(el.src)),45000,'ảnh đính kèm trong vùng soạn thảo');
}
function fillPrompt(settings,prompt){const el=unique(settings.promptSelector,'Ô prompt');el.focus();if(el instanceof HTMLTextAreaElement||el instanceof HTMLInputElement){Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,prompt);el.dispatchEvent(new Event('input',{bubbles:true}));}else{const r=document.createRange();r.selectNodeContents(el);const s=window.getSelection();s.removeAllRanges();s.addRange(r);if(!document.execCommand('insertText',false,prompt))throw Error('Flow không nhận prompt.');}if((el.value??el.textContent).trim()!==prompt.trim())throw Error('Prompt chưa được điền đầy đủ.');}
async function run(job,settings){
 if(running||calibrating)throw Error('Flow đang xử lý một dòng khác hoặc đang nhận diện nút.');running=true;stopped=false;
 try{
 if(job.video)return await upload(job.video,job,settings);
 if(!settings.attachmentSelector)throw Error('Cần cấu hình selector ảnh đính kèm trước khi chạy tự động.');
 const summary=settings.summarySelector?unique(settings.summarySelector,'Vùng cấu hình Video'):composer(settings);
 const mode=settings.summarySelector?label(summary):[...summary.querySelectorAll('button,[role=button]')].filter(visible).map(label).join(' ');if(!/video/i.test(mode)||!/(?:x|×)\s*1(?!\d)|\b1\s*(?:x|×)/i.test(mode)||/(?:x|×)\s*[234](?!\d)/i.test(mode))throw Error('Chưa xác nhận được Video · x1. Chọn Video và x1 trên Flow, hoặc cấu hình selector vùng hiển thị chế độ.');
 const oldElements=new Set(nodes(settings.videoSelector));
 const oldVideos=new Set(nodes(settings.videoSelector).map(el=>el.currentSrc||el.src).filter(Boolean));
 // Never generate until upload readiness has been observed.
 await attach(job,settings);check();fillPrompt(settings,job.prompt);
 const generate=settings.generateSelector?unique(settings.generateSelector,'Nút tạo video'):[...composer(settings).querySelectorAll('button')].filter(visible).find(el=>/^(arrow_forward|arrow_upward)$/.test(el.textContent.trim())||/^(generate|create|tạo|tạo video)$/i.test(el.getAttribute('aria-label')||''));
 if(!generate||generate.disabled||generate.getAttribute('aria-disabled')==='true')throw Error('Nút tạo video chưa sẵn sàng hoặc không xác định được.');
 // Snapshot immediately before clicking, so media from preparation isn't mistaken for output.
 nodes(settings.videoSelector).forEach(el=>{if(el.currentSrc||el.src)oldVideos.add(el.currentSrc||el.src);});
 generate.click();await rpc({type:'JOB_EVENT',id:job.id,status:'rendering'}).catch(()=>{});
 const video=await waitFor(()=>{const fresh=nodes(settings.videoSelector).filter(el=>{const src=el.currentSrc||el.src;return src&&!oldElements.has(el)&&!oldVideos.has(src)&&el.readyState>=2;});if(fresh.length>1)throw Error('Có nhiều video mới. Dừng để tránh ghép sai dòng; hãy đặt Flow xuất x1.');return fresh[0];},settings.timeoutMinutes*60000,'video mới');
 const src=video.currentSrc||video.src;await rpc({type:'JOB_EVENT',id:job.id,status:'video_ready',video:src});check();return await upload(src,job,settings);
 }finally{running=false;}
}
async function upload(src,job,settings){
 check();const u=new URL(src,location.href);if(!['https:','blob:'].includes(u.protocol))throw Error('Nguồn video không được hỗ trợ.');
 if(u.protocol==='https:')return rpc({type:'UPLOAD_REMOTE',url:u.href,job,settings});
 const r=await fetch(u.href,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`Không tải được video: HTTP ${r.status}.`);const blob=await r.blob();if(!blob.type.startsWith('video/'))throw Error('Kết quả không phải tệp video.');
 const {id}=await rpc({type:'UPLOAD_START',size:blob.size,name:`flow-row-${job.row}-${job.id.slice(0,8)}.mp4`,folder:settings.folder,mime:blob.type});
 await rpc({type:'JOB_EVENT',id:job.id,status:'uploading',video:src});let final;
 for(let offset=0;offset<blob.size;offset+=2*1024*1024){check();const bytes=new Uint8Array(await blob.slice(offset,offset+2*1024*1024).arrayBuffer());final=await rpc({type:'UPLOAD_CHUNK',id,offset,base64:encode64(bytes)});await rpc({type:'JOB_EVENT',id:job.id,status:'uploading',progress:Math.min(100,Math.round((offset+bytes.length)/blob.size*100))});}
 if(!final?.done||!final.url)throw Error('Chưa xác nhận được kết quả tải Drive.');return {drive:final.url};
}
async function mount(){if(host)return;host=document.createElement('div');host.id='flow-studio-host';host.style.cssText='position:fixed;top:12px;right:12px;bottom:12px;width:min(460px,calc(100vw - 24px));z-index:2147483647;';const shadow=host.attachShadow({mode:'closed'});const frame=document.createElement('iframe');frame.title='Flow Studio — Excel to Video';frame.style.cssText='width:100%;height:100%;border:1px solid #373444;border-radius:22px;box-shadow:0 20px 90px #0009;background:#111116;';const tabID=await rpc({type:'TAB'});frame.src=chrome.runtime.getURL(`index.html?tab=${tabID}`);shadow.append(frame);document.documentElement.append(host);}
function selectorFor(el){
 for(const attr of ['id','data-testid','aria-label','name']){const value=el.getAttribute(attr);if(value){const selector=el.tagName.toLowerCase()+'['+attr+'='+JSON.stringify(value)+']';if(nodes(selector).length===1)return selector;}}
 const parts=[];let node=el;while(node&&node!==document.documentElement){const siblings=node.parentElement?[...node.parentElement.children].filter(x=>x.tagName===node.tagName):[];parts.unshift(node.tagName.toLowerCase()+':nth-of-type('+(siblings.indexOf(node)+1)+')');const path=parts.join(' > ');if(nodes(path).length===1)return path;node=node.parentElement;}throw Error('Không tìm được selector duy nhất.');
}
async function calibrate(){
 if(running||calibrating)throw Error('Đang chạy hàng đợi hoặc nhận diện nút.');calibrating=true;
 const instructions=[['promptSelector','Bấm ô nhập prompt','textarea,[contenteditable=true],input[type=text]'],['addSelector','Bấm nút + để thêm ảnh','button,[role=button]'],['attachmentSelector','Bấm đúng ảnh mẫu đã đính kèm trong vùng soạn thảo','img'],['removeSelector','Bấm nút xóa ảnh mẫu (chỉ ghi nhớ, không xóa)','button,[role=button]'],['generateSelector','Bấm nút mũi tên tạo video (chỉ ghi nhớ, không tạo)','button,[role=button]']];
 const guide=document.createElement('div');guide.style.cssText='position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#241b35;color:#f2e9ff;border:1px solid #b391e5;padding:16px 24px;border-radius:12px;z-index:2147483647;font:14px system-ui;pointer-events:none;box-shadow:0 10px 40px #0009;';document.documentElement.append(guide);host.style.display='none';const result={};
 try{for(let i=0;i<instructions.length;i++){const [key,text,match]=instructions[i];guide.textContent=`Flow Studio · ${i+1}/5: ${text} · Esc để hủy`;
 const element=await new Promise((resolve,reject)=>{const cleanup=()=>{document.removeEventListener('click',click,true);document.removeEventListener('keydown',keyboard,true);clearTimeout(timer);};const click=e=>{e.preventDefault();e.stopImmediatePropagation();const candidate=e.target.closest(match);if(!candidate){guide.textContent='Chưa đúng loại phần tử. '+text+' · Esc để hủy';return;}cleanup();resolve(candidate);};const keyboard=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cleanup();reject(Error('Đã hủy nhận diện.'));}};const timer=setTimeout(()=>{cleanup();reject(Error('Hết thời gian nhận diện.'));},120000);document.addEventListener('click',click,true);document.addEventListener('keydown',keyboard,true);});result[key]=selectorFor(element);}
 return result;
 }finally{guide.remove();host.style.display='';calibrating=false;}
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{if(sender.id!==chrome.runtime.id)return;if(m.type==='PICK_SELECTORS'){calibrate().then(value=>respond({ok:true,value}),e=>respond({ok:false,error:e.message}));return true;}else if(m.type==='TOGGLE_PANEL'){if(host)host.style.display=host.style.display==='none'?'':'none';else mount();respond({ok:true});}else if(m.type==='STOP_FLOW'){stopped=true;respond({ok:true});}else if(m.type==='RUN_FLOW'){run(m.job,m.settings).then(value=>respond({ok:true,value}),e=>respond({ok:false,error:e.message}));return true;}});
mount();
