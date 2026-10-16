import {sendToFlow} from './flow.js';
import ExcelJS from 'exceljs';
import {cellText,imageURL,driveURL} from './core.cjs';
const $=id=>document.getElementById(id);
let book,sheet,column,items=[];let urls=[];
const status=text=>$('status').textContent=text;
function cleanup(){urls.forEach(URL.revokeObjectURL);urls=[];$('rows').replaceChildren();items=[];$('export').disabled=true;}
function columns(){cleanup();sheet=book.getWorksheet(Number($('sheet').value));$('column').replaceChildren();for(let c=1;c<=sheet.columnCount;c++){const o=document.createElement('option');o.value=c;o.textContent=`${c}: ${cellText(sheet.getCell(1,c)) || '(không tiêu đề)'}`;$('column').append(o);}}
$('excel').onchange=async()=>{try{cleanup();$('mapping').hidden=true;book=new ExcelJS.Workbook();await book.xlsx.load(await $('excel').files[0].arrayBuffer());$('sheet').replaceChildren();for(const s of book.worksheets){const o=document.createElement('option');o.value=s.id;o.textContent=s.name;$('sheet').append(o);}columns();$('mapping').hidden=false;status('Chọn cột ảnh. Dòng 1 được dùng làm tiêu đề.');}catch(e){status(e.message);}};
$('sheet').onchange=columns;
$('load').onclick=async()=>{
 column=Number($('column').value);
 const candidates=[];sheet.eachRow((row,n)=>{if(n>1&&cellText(row.getCell(column)).trim())candidates.push({n,source:cellText(row.getCell(column)).trim()});});
 // Permission request stays directly inside the user gesture.
 let origins;try{origins=[...new Set(candidates.map(x=>imageURL(x.source).origin+'/*'))];}catch(e){status(e.message);return;}
 if(origins.length && !await chrome.permissions.request({origins})){status('Chưa được cấp quyền đọc các địa chỉ ảnh.');return;}
 cleanup();$('load').disabled=true;$('sheet').disabled=true;$('column').disabled=true;$('excel').disabled=true;
 try{for(const item of candidates){items.push(item);const card=document.createElement('article');const title=document.createElement('strong');title.textContent=`Dòng ${item.n}`;card.append(title);const note=document.createElement('p');card.append(note);$('rows').append(card);
 try{const response=await fetch(item.source,{credentials:'omit',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);if(!response.headers.get('content-type')?.startsWith('image/'))throw Error('Link không trả về ảnh trực tiếp. Hãy dùng URL ảnh thay cho link bài đăng Facebook.');const blob=await response.blob();if(blob.size>25*1024*1024)throw Error('Ảnh vượt quá 25 MB.');const url=URL.createObjectURL(blob);urls.push(url);const img=document.createElement('img');img.src=url;img.alt=`Ảnh dòng ${item.n}`;card.append(img);await img.decode();const download=document.createElement('a');download.href=url;download.download=`dong-${item.n}.${blob.type.split('/')[1]?.replace('jpeg','jpg') || 'jpg'}`;download.textContent='Tải ảnh để đưa vào Flow';card.append(download);const send=document.createElement('button');send.textContent='Gửi ảnh và prompt sang Flow';send.onclick=async()=>{send.disabled=true;try{note.textContent=await sendToFlow(blob,item.n,$('prompt').value);}catch(e){note.textContent=e.message;}finally{send.disabled=false;}};card.append(document.createElement('br'),send);note.textContent='Ảnh đã đọc được.';}catch(e){note.textContent=e.message;note.className='error';}
 const input=document.createElement('input');input.type='url';input.placeholder='Dán link video Google Drive của dòng này';input.setAttribute('aria-label',`Link video Drive dòng ${item.n}`);input.oninput=()=>{item.drive=input.value.trim();};card.append(document.createElement('br'),input);status(`Đã xử lý ${items.length}/${candidates.length} dòng.`);
 }$('export').disabled=!items.length;
 }finally{$('load').disabled=false;$('sheet').disabled=false;$('column').disabled=false;$('excel').disabled=false;}
};
$('export').onclick=async()=>{try{const completed=items.filter(x=>x.drive);for(const item of completed)driveURL(item.drive);const output=new ExcelJS.Workbook();await output.xlsx.load(await $('excel').files[0].arrayBuffer());const target=output.getWorksheet(sheet.id);for(const item of completed)target.getCell(item.n,column).value={text:item.drive,hyperlink:item.drive};const blob=new Blob([await output.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const url=URL.createObjectURL(blob);urls.push(url);const a=document.createElement('a');a.href=url;a.download='ket-qua-video.xlsx';a.click();status(`Đã xuất: ${completed.length} link được thay; ${items.length-completed.length} dòng chưa có video giữ nguyên link ảnh.`);}catch(e){status(e.message);}};
