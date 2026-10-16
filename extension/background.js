var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/shared.js
function validHTTPS(value) {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password) throw Error("C\u1EA7n link HTTPS h\u1EE3p l\u1EC7.");
  return u;
}
function validClientID(value) {
  if (!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value || "")) throw Error("Nh\u1EADp Google OAuth Client ID h\u1EE3p l\u1EC7, kh\xF4ng ph\u1EA3i Client Secret.");
  return value;
}
function driveID(value) {
  const match = String(value).match(/\/folders\/([A-Za-z0-9_-]+)/);
  const id = match ? match[1] : value;
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) throw Error("ID ho\u1EB7c link th\u01B0 m\u1EE5c Drive kh\xF4ng h\u1EE3p l\u1EC7.");
  return id;
}
function decode64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
function encode64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
var init_shared = __esm({
  "src/shared.js"() {
  }
});

// src/background.js
var require_background = __commonJS({
  "src/background.js"() {
    init_shared();
    var API = "https://www.googleapis.com";
    chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
    async function token() {
      const { auth } = await chrome.storage.session.get("auth");
      if (!auth || auth.expires < Date.now() + 6e4) throw Error("Phi\xEAn Drive h\u1EBFt h\u1EA1n. B\u1EA5m K\u1EBFt n\u1ED1i Drive l\u1EA1i.");
      return auth.token;
    }
    async function api(url, options = {}) {
      const r = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${await token()}` } });
      if (!r.ok) {
        if (r.status === 401) await chrome.storage.session.remove("auth");
        throw Error(`Drive HTTP ${r.status}: ${(await r.text()).slice(0, 400)}`);
      }
      return r;
    }
    async function connect(clientID) {
      validClientID(clientID);
      const state = crypto.randomUUID();
      const redirect = chrome.identity.getRedirectURL("drive");
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({ client_id: clientID, redirect_uri: redirect, response_type: "token", scope: "https://www.googleapis.com/auth/drive.file", state, prompt: "select_account" });
      const callback = await chrome.identity.launchWebAuthFlow({ url: url.href, interactive: true });
      const u = new URL(callback);
      if (u.origin + u.pathname !== redirect) throw Error("OAuth redirect kh\xF4ng h\u1EE3p l\u1EC7.");
      const params = new URLSearchParams(u.hash.slice(1));
      if (params.get("state") !== state) throw Error("OAuth state kh\xF4ng h\u1EE3p l\u1EC7.");
      if (params.get("error")) throw Error(params.get("error"));
      const access = params.get("access_token");
      const expires = Number(params.get("expires_in"));
      if (!access || !expires) throw Error("Google kh\xF4ng tr\u1EA3 v\u1EC1 token Drive.");
      await chrome.storage.session.set({ auth: { token: access, expires: Date.now() + expires * 1e3, clientID } });
      return { connected: true };
    }
    async function handle(m, sender) {
      if (!sender.url?.startsWith(chrome.runtime.getURL("")) && !(sender.tab && sender.url?.startsWith("https://flow.google.com/"))) throw Error("Ngu\u1ED3n y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7.");
      switch (m.type) {
        case "TAB":
          return sender.tab?.id;
        case "JOB_EVENT": {
          if (!sender.tab) throw Error("S\u1EF1 ki\u1EC7n kh\xF4ng h\u1EE3p l\u1EC7.");
          await chrome.runtime.sendMessage({ type: "JOB_UPDATE", tabID: sender.tab.id, id: m.id, status: m.status, video: m.video, progress: m.progress }).catch(() => {
          });
          return true;
        }
        case "AUTH_STATUS": {
          const { auth } = await chrome.storage.session.get("auth");
          return { connected: !!auth && auth.expires > Date.now() + 6e4, redirect: chrome.identity.getRedirectURL("drive") };
        }
        case "CONNECT":
          return connect(m.clientID);
        case "DISCONNECT": {
          const { auth } = await chrome.storage.session.get("auth");
          await chrome.storage.session.remove("auth");
          if (auth) await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: auth.token }) }).catch(() => {
          });
          return true;
        }
        case "FETCH_IMAGE": {
          const url = validHTTPS(m.url);
          if (!await chrome.permissions.contains({ origins: [url.origin + "/*"] })) throw Error(`Ch\u01B0a c\u1EA5p quy\u1EC1n \u0111\u1ECDc \u1EA3nh t\u1EEB ${url.hostname}.`);
          const r = await fetch(url.href, { credentials: "omit", signal: AbortSignal.timeout(45e3) });
          if (!r.ok) throw Error(`\u1EA2nh HTTP ${r.status}. Link Facebook c\xF3 th\u1EC3 \u0111\xE3 h\u1EBFt h\u1EA1n.`);
          const mime = (r.headers.get("content-type") || "").split(";")[0];
          if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) throw Error("Link tr\u1EA3 v\u1EC1 trang web, kh\xF4ng ph\u1EA3i \u1EA3nh. C\u1EA7n link \u1EA3nh tr\u1EF1c ti\u1EBFp.");
          const b = await r.blob();
          if (b.size > 20 * 1024 * 1024) throw Error("\u1EA2nh v\u01B0\u1EE3t qu\xE1 20 MB.");
          const bytes = new Uint8Array(await b.arrayBuffer());
          let binary = "";
          for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          return { base64: btoa(binary), mime };
        }
        case "CALIBRATE": {
          const tab = await chrome.tabs.get(m.tabID);
          if (!tab.url?.startsWith("https://flow.google.com/")) throw Error("M\u1EDF d\u1EF1 \xE1n Flow tr\u01B0\u1EDBc.");
          return chrome.tabs.sendMessage(m.tabID, { type: "PICK_SELECTORS" }, { frameId: 0 });
        }
        case "PREPARE_RUN": {
          const tab = await chrome.tabs.get(m.tabID);
          if (!tab.url?.startsWith("https://flow.google.com/")) throw Error("Tab Flow \u0111\xE3 \u0111\xF3ng ho\u1EB7c \u0111\u1ED5i \u0111\u1ECBa ch\u1EC9.");
          await chrome.storage.session.remove("stop:" + m.tabID);
          return true;
        }
        case "STOP": {
          await chrome.storage.session.set({ ["stop:" + m.tabID]: true });
          return chrome.tabs.sendMessage(m.tabID, { type: "STOP_FLOW" }, { frameId: 0 });
        }
        case "UPLOAD_REMOTE": {
          const url = validHTTPS(m.url);
          if (!await chrome.permissions.contains({ origins: [url.origin + "/*"] })) throw Error(`C\u1EA7n quy\u1EC1n t\u1EA3i video t\u1EEB ${url.hostname}. Th\xEAm quy\u1EC1n host n\xE0y r\u1ED3i th\u1EED t\u1EA3i Drive l\u1EA1i.`);
          const response = await fetch(url.href, { credentials: "omit", signal: AbortSignal.timeout(12e4) });
          if (!response.ok) throw Error(`Video HTTP ${response.status}.`);
          const blob = await response.blob();
          if (!blob.type.startsWith("video/")) throw Error("K\u1EBFt qu\u1EA3 kh\xF4ng ph\u1EA3i video.");
          const { id } = await handle({ type: "UPLOAD_START", size: blob.size, name: `flow-row-${m.job.row}-${m.job.id.slice(0, 8)}.mp4`, folder: m.settings.folder, mime: blob.type }, sender);
          await handle({ type: "JOB_EVENT", id: m.job.id, status: "uploading", video: url.href }, sender);
          let final;
          for (let offset = 0; offset < blob.size; offset += 2 * 1024 * 1024) {
            const stop = (await chrome.storage.session.get("stop:" + sender.tab.id))["stop:" + sender.tab.id];
            if (stop) throw Error("\u0110\xE3 d\u1EEBng t\u1EA3i Drive.");
            const bytes = new Uint8Array(await blob.slice(offset, offset + 2 * 1024 * 1024).arrayBuffer());
            final = await handle({ type: "UPLOAD_CHUNK", id, offset, base64: encode64(bytes) }, sender);
            await handle({ type: "JOB_EVENT", id: m.job.id, status: "uploading", progress: Math.min(100, Math.round((offset + bytes.length) / blob.size * 100)) }, sender);
          }
          if (!final?.done) throw Error("Ch\u01B0a x\xE1c nh\u1EADn k\u1EBFt qu\u1EA3 t\u1EA3i Drive.");
          return { drive: final.url };
        }
        case "UPLOAD_START": {
          if (!Number.isSafeInteger(m.size) || m.size <= 0 || m.size > 1024 * 1024 * 1024) throw Error("Video r\u1ED7ng ho\u1EB7c l\u1EDBn h\u01A1n 1 GB.");
          const meta = { name: m.name, mimeType: "video/mp4" };
          if (m.folder) meta.parents = [driveID(m.folder)];
          const r = await api(`${API}/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink`, { method: "POST", headers: { "Content-Type": "application/json", "X-Upload-Content-Type": m.mime || "video/mp4", "X-Upload-Content-Length": String(m.size) }, body: JSON.stringify(meta) });
          const location = r.headers.get("location");
          if (!location || new URL(location).origin !== API) throw Error("Drive kh\xF4ng tr\u1EA3 v\u1EC1 phi\xEAn t\u1EA3i h\u1EE3p l\u1EC7.");
          const id = crypto.randomUUID();
          await chrome.storage.session.set({ ["upload:" + id]: { location, size: m.size, offset: 0 } });
          return { id };
        }
        case "UPLOAD_CHUNK": {
          const key = "upload:" + m.id;
          const entry = (await chrome.storage.session.get(key))[key];
          if (!entry) throw Error("Phi\xEAn upload \u0111\xE3 m\u1EA5t. Ch\u1EA1y l\u1EA1i b\u01B0\u1EDBc t\u1EA3i Drive.");
          const bytes = decode64(m.base64);
          if (!bytes.length || bytes.length > 4 * 1024 * 1024 || m.offset !== entry.offset || m.offset + bytes.length > entry.size) throw Error("Chunk upload kh\xF4ng h\u1EE3p l\u1EC7.");
          const end = m.offset + bytes.length - 1;
          const r = await fetch(entry.location, { method: "PUT", headers: { Authorization: `Bearer ${await token()}`, "Content-Range": `bytes ${m.offset}-${end}/${entry.size}` }, body: bytes });
          if (r.status === 308) {
            const range = r.headers.get("range");
            const accepted = range ? Number(range.split("-")[1]) + 1 : 0;
            if (accepted !== end + 1) throw Error("Drive ch\u01B0a nh\u1EADn \u0111\u1EE7 chunk; d\u1EEBng \u0111\u1EC3 tr\xE1nh h\u1ECFng video.");
            entry.offset = accepted;
            await chrome.storage.session.set({ [key]: entry });
            return { offset: accepted };
          }
          if (!r.ok) throw Error(`T\u1EA3i Drive th\u1EA5t b\u1EA1i: HTTP ${r.status}.`);
          const file = await r.json();
          if (end + 1 !== entry.size || !file.id) throw Error("Drive tr\u1EA3 k\u1EBFt qu\u1EA3 t\u1EA3i kh\xF4ng \u0111\u1EA7y \u0111\u1EE7.");
          await chrome.storage.session.remove(key);
          return { url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`, done: true };
        }
        default:
          throw Error("Y\xEAu c\u1EA7u kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
      }
    }
    chrome.runtime.onMessage.addListener((m, sender, respond) => {
      handle(m, sender).then((value) => respond({ ok: true, value }), (e) => respond({ ok: false, error: e.message }));
      return true;
    });
    chrome.action.onClicked.addListener(async (tab) => {
      if (tab.url?.startsWith("https://flow.google.com/")) await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" }, { frameId: 0 }).catch(() => {
      });
      else await chrome.tabs.create({ url: "https://flow.google.com/" });
    });
  }
});
export default require_background();
