function cellText(cell) {
 const v=cell.value;
 if(v && typeof v==='object') return v.hyperlink || v.text || v.result || (v.richText || []).map(x=>x.text).join('');
 return v==null?'':String(v);
}
function imageURL(value) {
 const u=new URL(value);
 if(u.protocol!=='https:') throw Error('Link ảnh phải dùng HTTPS.');
 return u;
}
function driveURL(value) {
 const u=new URL(value);
 if(u.protocol!=='https:' || u.hostname!=='drive.google.com' || !/^\/(file\/d\/|open\b|uc\b)/.test(u.pathname)) throw Error('Cần link tệp video tại drive.google.com.');
 return u.href;
}
module.exports={cellText,imageURL,driveURL};
