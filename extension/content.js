(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/shared.js
  function encode64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(s);
  }
  async function rpc(message) {
    const r = await chrome.runtime.sendMessage(message);
    if (!r?.ok) throw Error(r?.error || "Extension m\u1EA5t k\u1EBFt n\u1ED1i. Reload trang Flow.");
    return r.value;
  }
  var init_shared = __esm({
    "src/shared.js"() {
    }
  });

  // src/content.js
  var require_content = __commonJS({
    "src/content.js"() {
      init_shared();
      var host;
      var stopped = false;
      var running = false;
      var calibrating = false;
      function visible(el) {
        return el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
      }
      function nodes(selector) {
        try {
          return [...document.querySelectorAll(selector)];
        } catch {
          throw Error("CSS selector kh\xF4ng h\u1EE3p l\u1EC7: " + selector);
        }
      }
      function unique(selector, label2, hidden = false) {
        const els = nodes(selector).filter((el) => hidden || visible(el));
        if (els.length !== 1) throw Error(`${label2}: c\u1EA7n \u0111\xFAng 1 ph\u1EA7n t\u1EED, t\xECm th\u1EA5y ${els.length}. M\u1EDF C\u1EA5u h\xECnh \u2192 B\u1ED9 ch\u1ECDn Flow \u0111\u1EC3 \u0111i\u1EC1u ch\u1EC9nh.`);
        return els[0];
      }
      function check() {
        if (stopped) throw Error("\u0110\xE3 d\u1EEBng. N\u1EBFu Flow \u0111\xE3 nh\u1EADn l\u1EC7nh t\u1EA1o, video v\u1EABn ti\u1EBFp t\u1EE5c render trong Flow.");
      }
      async function waitFor(fn, timeout, label2) {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          check();
          const value = fn();
          if (value) return value;
          await new Promise((r) => setTimeout(r, 500));
        }
        throw Error(`H\u1EBFt th\u1EDDi gian ch\u1EDD ${label2}. Ki\u1EC3m tra Flow; kh\xF4ng t\u1EF1 g\u1EEDi l\u1EA1i l\u1EC7nh t\u1EA1o.`);
      }
      function label(el) {
        return ((el.getAttribute("aria-label") || "") + " " + (el.getAttribute("title") || "") + " " + el.textContent).trim();
      }
      function buttonByText(pattern) {
        const matches = nodes("button,[role=button],[role=menuitem]").filter(visible).filter((el) => pattern.test(label(el)));
        if (matches.length === 1) return matches[0];
        return null;
      }
      function composer(settings) {
        const prompt = unique(settings.promptSelector, "\xD4 prompt");
        return prompt.closest("form") || prompt.parentElement?.parentElement;
      }
      async function attach(job, settings) {
        const existing = nodes(settings.attachmentSelector).filter(visible);
        if (existing.length) {
          if (!settings.removeSelector) throw Error("Flow c\xF2n \u1EA3nh \u0111\xEDnh k\xE8m t\u1EEB d\xF2ng tr\u01B0\u1EDBc. C\u1EA5u h\xECnh selector n\xFAt x\xF3a \u1EA3nh \u0111\u1EC3 t\u1EF1 chuy\u1EC3n d\xF2ng an to\xE0n.");
          for (let i = 0; i < existing.length; i++) {
            check();
            unique(settings.removeSelector, "N\xFAt x\xF3a \u1EA3nh c\u0169").click();
            await new Promise((r) => setTimeout(r, 300));
          }
          await waitFor(() => nodes(settings.attachmentSelector).filter(visible).length === 0, 1e4, "x\xF3a \u1EA3nh c\u0169");
        }
        let input = nodes(settings.fileSelector).filter((el) => !el.disabled && (el.accept.includes("image") || !el.accept));
        if (input.length !== 1) {
          const plus = settings.addSelector ? unique(settings.addSelector, "N\xFAt th\xEAm \u1EA3nh") : [...composer(settings).querySelectorAll("button")].filter(visible).find((el) => /^(add|add_2|\+)$/.test(el.textContent.trim()) || /^(Thêm|Add)( image| ảnh)?$/i.test(el.getAttribute("aria-label") || ""));
          if (!plus) throw Error("Kh\xF4ng t\xECm \u0111\u01B0\u1EE3c n\xFAt +. C\u1EA5u h\xECnh selector n\xFAt th\xEAm \u1EA3nh.");
          plus.click();
          await new Promise((r) => setTimeout(r, 600));
          const upload2 = settings.uploadSelector ? unique(settings.uploadSelector, "M\u1EE5c t\u1EA3i \u1EA3nh") : buttonByText(/^(upload|tải lên|tải ảnh|upload image|upload an image)(\s|$)/i);
          if (upload2) upload2.click();
          input = await waitFor(() => {
            const matches = nodes(settings.fileSelector).filter((el) => !el.disabled && (el.accept.includes("image") || !el.accept));
            return matches.length === 1 ? matches : null;
          }, 1e4, "\xF4 t\u1EA3i \u1EA3nh");
        }
        const before = new Set(nodes(settings.attachmentSelector).map((el) => el.src || el.getAttribute("data-id")));
        const bytes = Uint8Array.from(atob(job.image.base64), (c) => c.charCodeAt(0));
        const file = new File([bytes], `row-${job.row}.${job.image.mime.split("/")[1]}`, { type: job.image.mime });
        const dt = new DataTransfer();
        dt.items.add(file);
        input[0].files = dt.files;
        input[0].dispatchEvent(new Event("input", { bubbles: true }));
        input[0].dispatchEvent(new Event("change", { bubbles: true }));
        await waitFor(() => nodes(settings.attachmentSelector).filter(visible).some((el) => el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0 && !before.has(el.src)), 45e3, "\u1EA3nh \u0111\xEDnh k\xE8m trong v\xF9ng so\u1EA1n th\u1EA3o");
      }
      function fillPrompt(settings, prompt) {
        const el = unique(settings.promptSelector, "\xD4 prompt");
        el.focus();
        if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
          Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value").set.call(el, prompt);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          const r = document.createRange();
          r.selectNodeContents(el);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
          if (!document.execCommand("insertText", false, prompt)) throw Error("Flow kh\xF4ng nh\u1EADn prompt.");
        }
        if ((el.value ?? el.textContent).trim() !== prompt.trim()) throw Error("Prompt ch\u01B0a \u0111\u01B0\u1EE3c \u0111i\u1EC1n \u0111\u1EA7y \u0111\u1EE7.");
      }
      async function run(job, settings) {
        if (running || calibrating) throw Error("Flow \u0111ang x\u1EED l\xFD m\u1ED9t d\xF2ng kh\xE1c ho\u1EB7c \u0111ang nh\u1EADn di\u1EC7n n\xFAt.");
        running = true;
        stopped = false;
        try {
          if (job.video) return await upload(job.video, job, settings);
          if (!settings.attachmentSelector) throw Error("C\u1EA7n c\u1EA5u h\xECnh selector \u1EA3nh \u0111\xEDnh k\xE8m tr\u01B0\u1EDBc khi ch\u1EA1y t\u1EF1 \u0111\u1ED9ng.");
          const summary = settings.summarySelector ? unique(settings.summarySelector, "V\xF9ng c\u1EA5u h\xECnh Video") : composer(settings);
          const mode = settings.summarySelector ? label(summary) : [...summary.querySelectorAll("button,[role=button]")].filter(visible).map(label).join(" ");
          if (!/video/i.test(mode) || !/(?:x|×)\s*1(?!\d)|\b1\s*(?:x|×)/i.test(mode) || /(?:x|×)\s*[234](?!\d)/i.test(mode)) throw Error("Ch\u01B0a x\xE1c nh\u1EADn \u0111\u01B0\u1EE3c Video \xB7 x1. Ch\u1ECDn Video v\xE0 x1 tr\xEAn Flow, ho\u1EB7c c\u1EA5u h\xECnh selector v\xF9ng hi\u1EC3n th\u1ECB ch\u1EBF \u0111\u1ED9.");
          const oldElements = new Set(nodes(settings.videoSelector));
          const oldVideos = new Set(nodes(settings.videoSelector).map((el) => el.currentSrc || el.src).filter(Boolean));
          await attach(job, settings);
          check();
          fillPrompt(settings, job.prompt);
          const generate = settings.generateSelector ? unique(settings.generateSelector, "N\xFAt t\u1EA1o video") : [...composer(settings).querySelectorAll("button")].filter(visible).find((el) => /^(arrow_forward|arrow_upward)$/.test(el.textContent.trim()) || /^(generate|create|tạo|tạo video)$/i.test(el.getAttribute("aria-label") || ""));
          if (!generate || generate.disabled || generate.getAttribute("aria-disabled") === "true") throw Error("N\xFAt t\u1EA1o video ch\u01B0a s\u1EB5n s\xE0ng ho\u1EB7c kh\xF4ng x\xE1c \u0111\u1ECBnh \u0111\u01B0\u1EE3c.");
          nodes(settings.videoSelector).forEach((el) => {
            if (el.currentSrc || el.src) oldVideos.add(el.currentSrc || el.src);
          });
          generate.click();
          await rpc({ type: "JOB_EVENT", id: job.id, status: "rendering" }).catch(() => {
          });
          const video = await waitFor(() => {
            const fresh = nodes(settings.videoSelector).filter((el) => {
              const src2 = el.currentSrc || el.src;
              return src2 && !oldElements.has(el) && !oldVideos.has(src2) && el.readyState >= 2;
            });
            if (fresh.length > 1) throw Error("C\xF3 nhi\u1EC1u video m\u1EDBi. D\u1EEBng \u0111\u1EC3 tr\xE1nh gh\xE9p sai d\xF2ng; h\xE3y \u0111\u1EB7t Flow xu\u1EA5t x1.");
            return fresh[0];
          }, settings.timeoutMinutes * 6e4, "video m\u1EDBi");
          const src = video.currentSrc || video.src;
          await rpc({ type: "JOB_EVENT", id: job.id, status: "video_ready", video: src });
          check();
          return await upload(src, job, settings);
        } finally {
          running = false;
        }
      }
      async function upload(src, job, settings) {
        check();
        const u = new URL(src, location.href);
        if (!["https:", "blob:"].includes(u.protocol)) throw Error("Ngu\u1ED3n video kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
        if (u.protocol === "https:") return rpc({ type: "UPLOAD_REMOTE", url: u.href, job, settings });
        const r = await fetch(u.href, { signal: AbortSignal.timeout(12e4) });
        if (!r.ok) throw Error(`Kh\xF4ng t\u1EA3i \u0111\u01B0\u1EE3c video: HTTP ${r.status}.`);
        const blob = await r.blob();
        if (!blob.type.startsWith("video/")) throw Error("K\u1EBFt qu\u1EA3 kh\xF4ng ph\u1EA3i t\u1EC7p video.");
        const { id } = await rpc({ type: "UPLOAD_START", size: blob.size, name: `flow-row-${job.row}-${job.id.slice(0, 8)}.mp4`, folder: settings.folder, mime: blob.type });
        await rpc({ type: "JOB_EVENT", id: job.id, status: "uploading", video: src });
        let final;
        for (let offset = 0; offset < blob.size; offset += 2 * 1024 * 1024) {
          check();
          const bytes = new Uint8Array(await blob.slice(offset, offset + 2 * 1024 * 1024).arrayBuffer());
          final = await rpc({ type: "UPLOAD_CHUNK", id, offset, base64: encode64(bytes) });
          await rpc({ type: "JOB_EVENT", id: job.id, status: "uploading", progress: Math.min(100, Math.round((offset + bytes.length) / blob.size * 100)) });
        }
        if (!final?.done || !final.url) throw Error("Ch\u01B0a x\xE1c nh\u1EADn \u0111\u01B0\u1EE3c k\u1EBFt qu\u1EA3 t\u1EA3i Drive.");
        return { drive: final.url };
      }
      async function mount() {
        if (host) return;
        host = document.createElement("div");
        host.id = "flow-studio-host";
        host.style.cssText = "position:fixed;top:12px;right:12px;bottom:12px;width:min(460px,calc(100vw - 24px));z-index:2147483647;";
        const shadow = host.attachShadow({ mode: "closed" });
        const frame = document.createElement("iframe");
        frame.title = "Flow Studio \u2014 Excel to Video";
        frame.style.cssText = "width:100%;height:100%;border:1px solid #373444;border-radius:22px;box-shadow:0 20px 90px #0009;background:#111116;";
        const tabID = await rpc({ type: "TAB" });
        frame.src = chrome.runtime.getURL(`index.html?tab=${tabID}`);
        shadow.append(frame);
        document.documentElement.append(host);
      }
      function selectorFor(el) {
        for (const attr of ["id", "data-testid", "aria-label", "name"]) {
          const value = el.getAttribute(attr);
          if (value) {
            const selector = el.tagName.toLowerCase() + "[" + attr + "=" + JSON.stringify(value) + "]";
            if (nodes(selector).length === 1) return selector;
          }
        }
        const parts = [];
        let node = el;
        while (node && node !== document.documentElement) {
          const siblings = node.parentElement ? [...node.parentElement.children].filter((x) => x.tagName === node.tagName) : [];
          parts.unshift(node.tagName.toLowerCase() + ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")");
          const path = parts.join(" > ");
          if (nodes(path).length === 1) return path;
          node = node.parentElement;
        }
        throw Error("Kh\xF4ng t\xECm \u0111\u01B0\u1EE3c selector duy nh\u1EA5t.");
      }
      async function calibrate() {
        if (running || calibrating) throw Error("\u0110ang ch\u1EA1y h\xE0ng \u0111\u1EE3i ho\u1EB7c nh\u1EADn di\u1EC7n n\xFAt.");
        calibrating = true;
        const instructions = [["promptSelector", "B\u1EA5m \xF4 nh\u1EADp prompt", "textarea,[contenteditable=true],input[type=text]"], ["addSelector", "B\u1EA5m n\xFAt + \u0111\u1EC3 th\xEAm \u1EA3nh", "button,[role=button]"], ["attachmentSelector", "B\u1EA5m \u0111\xFAng \u1EA3nh m\u1EABu \u0111\xE3 \u0111\xEDnh k\xE8m trong v\xF9ng so\u1EA1n th\u1EA3o", "img"], ["removeSelector", "B\u1EA5m n\xFAt x\xF3a \u1EA3nh m\u1EABu (ch\u1EC9 ghi nh\u1EDB, kh\xF4ng x\xF3a)", "button,[role=button]"], ["generateSelector", "B\u1EA5m n\xFAt m\u0169i t\xEAn t\u1EA1o video (ch\u1EC9 ghi nh\u1EDB, kh\xF4ng t\u1EA1o)", "button,[role=button]"]];
        const guide = document.createElement("div");
        guide.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#241b35;color:#f2e9ff;border:1px solid #b391e5;padding:16px 24px;border-radius:12px;z-index:2147483647;font:14px system-ui;pointer-events:none;box-shadow:0 10px 40px #0009;";
        document.documentElement.append(guide);
        host.style.display = "none";
        const result = {};
        try {
          for (let i = 0; i < instructions.length; i++) {
            const [key, text, match] = instructions[i];
            guide.textContent = `Flow Studio \xB7 ${i + 1}/5: ${text} \xB7 Esc \u0111\u1EC3 h\u1EE7y`;
            const element = await new Promise((resolve, reject) => {
              const cleanup = () => {
                document.removeEventListener("click", click, true);
                document.removeEventListener("keydown", keyboard, true);
                clearTimeout(timer);
              };
              const click = (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                const candidate = e.target.closest(match);
                if (!candidate) {
                  guide.textContent = "Ch\u01B0a \u0111\xFAng lo\u1EA1i ph\u1EA7n t\u1EED. " + text + " \xB7 Esc \u0111\u1EC3 h\u1EE7y";
                  return;
                }
                cleanup();
                resolve(candidate);
              };
              const keyboard = (e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopImmediatePropagation();
                  cleanup();
                  reject(Error("\u0110\xE3 h\u1EE7y nh\u1EADn di\u1EC7n."));
                }
              };
              const timer = setTimeout(() => {
                cleanup();
                reject(Error("H\u1EBFt th\u1EDDi gian nh\u1EADn di\u1EC7n."));
              }, 12e4);
              document.addEventListener("click", click, true);
              document.addEventListener("keydown", keyboard, true);
            });
            result[key] = selectorFor(element);
          }
          return result;
        } finally {
          guide.remove();
          host.style.display = "";
          calibrating = false;
        }
      }
      chrome.runtime.onMessage.addListener((m, sender, respond) => {
        if (sender.id !== chrome.runtime.id) return;
        if (m.type === "PICK_SELECTORS") {
          calibrate().then((value) => respond({ ok: true, value }), (e) => respond({ ok: false, error: e.message }));
          return true;
        } else if (m.type === "TOGGLE_PANEL") {
          if (host) host.style.display = host.style.display === "none" ? "" : "none";
          else mount();
          respond({ ok: true });
        } else if (m.type === "STOP_FLOW") {
          stopped = true;
          respond({ ok: true });
        } else if (m.type === "RUN_FLOW") {
          run(m.job, m.settings).then((value) => respond({ ok: true, value }), (e) => respond({ ok: false, error: e.message }));
          return true;
        }
      });
      mount();
    }
  });
  require_content();
})();
