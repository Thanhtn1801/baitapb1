export function validHTTPS(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error('Cần link HTTPS hợp lệ.');return u;}
export function validClientID(value){if(!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value||''))throw Error('Nhập Google OAuth Client ID hợp lệ, không phải Client Secret.');return value;}
export function driveID(value){const match=String(value).match(/\/folders\/([A-Za-z0-9_-]+)/);const id=match?match[1]:value;if(!/^[A-Za-z0-9_-]{10,}$/.test(id))throw Error('ID hoặc link thư mục Drive không hợp lệ.');return id;}
export function decode64(value){const binary=atob(value);return Uint8Array.from(binary,c=>c.charCodeAt(0));}
export function encode64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export async function rpc(message){const r=await chrome.runtime.sendMessage(message);if(!r?.ok)throw Error(r?.error||'Extension mất kết nối. Reload trang Flow.');return r.value;}
export function transitionAfterReload(job){if(['uploading','rendering','preparing'].includes(job.status))return {...job,status:job.video?'video_ready':'uncertain',error:job.video?'Video đã có, tiếp tục tải Drive.':'Phiên trước bị gián đoạn. Kiểm tra Flow trước khi thử lại để tránh tạo trùng video.'};return job;}
