// Runs inside the user's signed-in Flow tab. Never clicks Generate.
export async function prepareFlowImage(dataURL, filename, prompt) {
 const visible=el=>!!(el.getClientRects().length);
 const inputs=[...document.querySelectorAll('input[type=file]')].filter(el=>!el.disabled && (el.accept.includes('image') || !el.accept));
 if(inputs.length!==1)throw Error('Trong Flow, bấm + rồi mở mục tải ảnh để hiện ô chọn ảnh. Cần đúng một ô tải ảnh, sau đó bấm Gửi sang Flow lần nữa.');
 const editors=[...document.querySelectorAll('textarea,[contenteditable=true],[role=textbox]')].filter(visible).filter(el=>!el.closest('[role=dialog]'));
 const matches=editors.filter(el=>/Bạn muốn|want to|prompt|describe/i.test((el.getAttribute('placeholder')||'')+' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('data-placeholder')||'')));
 const editor=matches.length===1?matches[0]:editors.length===1?editors[0]:null;
 if(!editor)throw Error('Không xác định được ô prompt. Đóng hộp thoại không cần thiết rồi thử lại.');
 const blob=await (await fetch(dataURL)).blob();const file=new File([blob],filename,{type:blob.type});
 const transfer=new DataTransfer();transfer.items.add(file);inputs[0].files=transfer.files;
 inputs[0].dispatchEvent(new Event('input',{bubbles:true}));inputs[0].dispatchEvent(new Event('change',{bubbles:true}));
 editor.focus();
 if(editor instanceof HTMLTextAreaElement){Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(editor,prompt);editor.dispatchEvent(new Event('input',{bubbles:true}));}
 else {const selection=window.getSelection();const range=document.createRange();range.selectNodeContents(editor);selection.removeAllRanges();selection.addRange(range);if(!document.execCommand('insertText',false,prompt))throw Error('Không điền được prompt. Hãy nhập prompt trực tiếp trong Flow.');}
 return 'Đã gửi sự kiện tải ảnh và điền prompt. Kiểm tra ảnh đã hiện trong Flow trước khi bấm tạo video.';
}
export async function sendToFlow(blob,row,prompt){
 const tabs=await chrome.tabs.query({url:'https://flow.google.com/*'});
 if(tabs.length!==1)throw Error('Hãy mở đúng một tab dự án tại https://flow.google.com/.');
 const dataURL=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
 const result=await chrome.scripting.executeScript({target:{tabId:tabs[0].id},func:prepareFlowImage,args:[dataURL,`dong-${row}.${blob.type.split('/')[1]||'jpg'}`,prompt]});
 await chrome.tabs.update(tabs[0].id,{active:true});return result[0].result;
}
