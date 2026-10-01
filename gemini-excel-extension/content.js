if (!window.__geminiPromptSenderInjected) {
  window.__geminiPromptSenderInjected = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SEND_PROMPTS") sendPrompts(message.prompts);
  });
}

async function sendPrompts(prompts) {
  window.__geminiStopRequested = false;
  createOverlay();
  const total = prompts.length;
  let sent = 0;

  try {
    for (let i = 0; i < total; i++) {
      if (window.__geminiStopRequested) break;
      if (i > 0) await wait(2000);
      if (window.__geminiStopRequested) break;

      const editor = document.querySelector(".ql-editor");
      if (!editor) throw new Error("Input box not found on the page");
      editor.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, prompts[i]);

      const ready = await waitForSendButtonReady(i + 1, total);
      if (!ready) break;

      const sendBtn = document.querySelector('button[aria-label="Send message"]');
      if (!sendBtn) throw new Error("Send button not found on the page");
      sendBtn.click();
      sent++;
      setOverlayText(`Sent ${sent}/${total}`);
    }
  } catch (err) {
    setOverlayText(`Stopped by an error after ${sent}/${total} sent: ${err.message}`);
    hideStopButton();
    return;
  }

  setOverlayText(
    window.__geminiStopRequested
      ? `Stopped. Sent ${sent}/${total} prompts.`
      : `All ${sent}/${total} prompts sent successfully.`
  );
  hideStopButton();
}

function waitForSendButtonReady(current, total) {
  const REQUIRED_STABLE_MS = 7000;
  return new Promise(resolve => {
    let waited = 0;
    let stableFor = 0;
    const check = () => {
      if (window.__geminiStopRequested) return resolve(false);
      const btn = document.querySelector('button[aria-label="Send message"]');
      if (btn && !btn.disabled) {
        stableFor += 500;
        setOverlayText(`Gemini looks done, confirming... (prompt ${current}/${total})`);
        if (stableFor >= REQUIRED_STABLE_MS) return resolve(true);
      } else {
        stableFor = 0;
        waited += 0.5;
        setOverlayText(`Waiting for Gemini to finish (prompt ${current}/${total}, ${waited.toFixed(1)}s)...`);
      }
      setTimeout(check, 500);
    };
    check();
  });
}

function createOverlay() {
  let box = document.getElementById("gemini-prompt-sender-overlay");
  if (box) {
    box.querySelector("button").style.display = "";
    return box;
  }

  box = document.createElement("div");
  box.id = "gemini-prompt-sender-overlay";
  box.style.cssText = "position:fixed;top:16px;right:16px;z-index:99999;background:#1f1f1f;color:#fff;padding:10px 14px;border-radius:8px;font-family:sans-serif;font-size:13px;display:flex;align-items:center;gap:10px;box-shadow:0 2px 8px rgba(0,0,0,.3)";

  const text = document.createElement("span");
  text.id = "gemini-prompt-sender-text";

  const stopBtn = document.createElement("button");
  stopBtn.textContent = "Stop";
  stopBtn.style.cssText = "background:#d93025;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer";
  stopBtn.onclick = () => { window.__geminiStopRequested = true; };

  box.appendChild(text);
  box.appendChild(stopBtn);
  document.body.appendChild(box);
  return box;
}

function setOverlayText(msg) {
  const el = document.getElementById("gemini-prompt-sender-text");
  if (el) el.textContent = msg;
}

function hideStopButton() {
  const box = document.getElementById("gemini-prompt-sender-overlay");
  if (box) box.querySelector("button").style.display = "none";
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
