const $ = (selector) => document.querySelector(selector);

const form = $("#chat-form");
const promptInput = $("#prompt");
const feed = $("#chat-feed");
const sendBtn = $("#send-btn");
const providerSelect = $("#provider");
const modelInput = $("#model");
const providerList = $("#provider-list");
const connectionDot = $("#connection-dot");
const connectionText = $("#connection-text");
const backendText = $("#backend-text");
const liveDot = $("#live-dot");
const liveLabel = $("#live-label");
const planState = $("#plan-state");
const planEmpty = $("#plan-empty");
const planSteps = $("#plan-steps");
const warnings = $("#warnings");

const sidebar = $("#sidebar");
const rightRail = $("#right-rail");
const drawerBackdrop = $("#drawer-backdrop");
const sidebarToggle = $("#sidebar-toggle");
const toolsToggle = $("#tools-toggle");
const sidebarClose = $("#sidebar-close");
const toolsClose = $("#tools-close");

const DEFAULT_BACKEND_URL = "https://kd-agent-api.onrender.com";

let messages = [];
let providers = [];

function apiUrl(path) {
  const base = DEFAULT_BACKEND_URL.endsWith("/") ? DEFAULT_BACKEND_URL : DEFAULT_BACKEND_URL + "/";
  return new URL(String(path || "").replace(/^\/+/, ""), base).toString();
}

let backendOnline = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(path, options = {}, config = {}) {
  const retries = Number.isInteger(config.retries) ? config.retries : 2;
  const timeoutMs = Number.isInteger(config.timeoutMs) ? config.timeoutMs : 12000;
  const url = apiUrl(path);
  const method = options.method || "GET";

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.debug("[KD Agent API] request", {
        url,
        method,
        attempt,
        frontendOrigin: window.location.origin,
        online: navigator.onLine
      });

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      const raw = await response.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || response.statusText || "Respons backend bukan JSON." };
      }

      if (!response.ok) {
        const error = new Error(data.error || `HTTP ${response.status} ${response.statusText}`);
        error.status = response.status;
        throw error;
      }

      backendOnline = true;
      return data;
    } catch (error) {
      const isAbort = error?.name === "AbortError";
      const status = Number(error?.status || 0);
      const retryable = isAbort || !status || status >= 500 || status === 429;
      const detail = isAbort
        ? `Timeout setelah ${timeoutMs} ms`
        : status
          ? `HTTP ${status}: ${error.message}`
          : `Network/CORS: ${error?.message || "Failed to fetch"}`;

      console.error("[KD Agent API] request failed", {
        url,
        method,
        attempt,
        retries,
        detail,
        status: status || null,
        frontendOrigin: window.location.origin,
        backend: DEFAULT_BACKEND_URL,
        online: navigator.onLine,
        error
      });

      if (attempt > retries || !retryable) {
        backendOnline = false;
        throw new Error(detail);
      }

      await sleep(500 * 2 ** (attempt - 1));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw new Error("Request backend gagal.");
}

function setConnection(ok, label, detail) {
  backendOnline = Boolean(ok);
  connectionDot.classList.toggle("good", Boolean(ok));
  liveDot.classList.toggle("good", Boolean(ok));
  connectionText.textContent = label;
  backendText.textContent = detail;
  liveLabel.textContent = ok ? "Connected" : "Offline";
}

function iconSvg(kind) {
  const paths = {
    copy: '<rect x="9" y="9" width="10" height="10" rx="2"></rect><path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path>',
    up: '<path d="M7 10v10h11a2 2 0 0 0 1.9-1.4l1.4-5A2 2 0 0 0 19.4 11H15l.7-3.1A2.4 2.4 0 0 0 13.4 5L7 10z"></path><path d="M3 10h4v10H3z"></path>',
    down: '<path d="M17 14V4H6.1a2 2 0 0 0-1.9 1.4l-1.4 5A2 2 0 0 0 4.6 13H9l-.7 3.1A2.4 2.4 0 0 0 10.6 19l6.4-5z"></path><path d="M21 14h-4V4h4z"></path>',
    refresh: '<path d="M20 11a8 8 0 1 0 2 5.3"></path><path d="M20 5v6h-6"></path>'
  };
  const svg = document.createElement("svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths[kind] || paths.copy;
  return svg;
}

function makeActionButton(action, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "message-action";
  button.dataset.action = action;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(iconSvg(action === "regenerate" ? "refresh" : action));
  button.addEventListener("click", onClick);
  return button;
}

function copyText(text, button) {
  if (!navigator.clipboard) return Promise.reject(new Error("Clipboard API tidak tersedia."));
  return navigator.clipboard.writeText(text).then(() => {
    button.classList.add("copied");
    const original = button.getAttribute("aria-label") || "Copy";
    button.setAttribute("aria-label", "Copied");
    button.title = "Copied";
    window.setTimeout(() => {
      button.classList.remove("copied");
      button.setAttribute("aria-label", original);
      button.title = original;
    }, 1500);
  });
}

function appendInlineMarkdown(parent, source) {
  const pattern = /(\x60[^\x60]+\x60|\*\*[^*]+\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(source))) {
    if (match.index > lastIndex) {
      parent.append(document.createTextNode(source.slice(lastIndex, match.index)));
    }

    const token = match[0];
    if (token.startsWith(String.fromCharCode(96))) {
      const code = document.createElement("code");
      code.className = "inline-code";
      code.textContent = token.slice(1, -1);
      parent.append(code);
    } else if (token.startsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      parent.append(strong);
    } else {
      const link = document.createElement("a");
      link.href = match[3];
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      link.textContent = match[2];
      parent.append(link);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < source.length) {
    parent.append(document.createTextNode(source.slice(lastIndex)));
  }
}

function appendMarkdownText(parent, source) {
  const lines = source.replace(/\r/g, "").split("\n");
  let paragraph = [];
  let list = null;
  let listType = "";

  function flushParagraph() {
    if (!paragraph.length) return;
    const p = document.createElement("p");
    appendInlineMarkdown(p, paragraph.join("\n"));
    parent.append(p);
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    parent.append(list);
    list = null;
    listType = "";
  }

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    let match = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      flushParagraph();
      flushList();
      const heading = document.createElement("h" + match[1].length);
      appendInlineMarkdown(heading, match[2]);
      parent.append(heading);
      return;
    }

    match = trimmed.match(/^[-*]\s+(.+)$/);
    if (match) {
      flushParagraph();
      if (!list || listType !== "ul") {
        flushList();
        list = document.createElement("ul");
        list.className = "md-list";
        listType = "ul";
      }
      const li = document.createElement("li");
      appendInlineMarkdown(li, match[1]);
      list.append(li);
      return;
    }

    match = trimmed.match(/^\d+\.\s+(.+)$/);
    if (match) {
      flushParagraph();
      if (!list || listType !== "ol") {
        flushList();
        list = document.createElement("ol");
        list.className = "md-list";
        listType = "ol";
      }
      const li = document.createElement("li");
      appendInlineMarkdown(li, match[1]);
      list.append(li);
      return;
    }

    match = trimmed.match(/^>\s?(.*)$/);
    if (match) {
      flushParagraph();
      flushList();
      const quote = document.createElement("blockquote");
      quote.className = "md-quote";
      appendInlineMarkdown(quote, match[1]);
      parent.append(quote);
      return;
    }

    if (list) flushList();
    paragraph.push(line);
  });

  flushParagraph();
  flushList();
}

function appendCodeBlock(parent, code, language) {
  const block = document.createElement("div");
  block.className = "code-block";

  const head = document.createElement("div");
  head.className = "code-head";

  const lang = document.createElement("span");
  lang.className = "code-language";
  lang.textContent = (language || "text").trim() || "text";

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "code-copy";
  copy.setAttribute("aria-label", "Copy Code");
  copy.title = "Copy Code";
  copy.append(iconSvg("copy"), document.createTextNode("Copy Code"));
  copy.addEventListener("click", () => {
    copyText(code, copy).then(() => {
      copy.classList.add("copied");
      copy.replaceChildren(iconSvg("copy"), document.createTextNode("Copied"));
      window.setTimeout(() => {
        copy.classList.remove("copied");
        copy.replaceChildren(iconSvg("copy"), document.createTextNode("Copy Code"));
      }, 1500);
    }).catch(() => {});
  });

  head.append(lang, copy);

  const pre = document.createElement("pre");
  const codeEl = document.createElement("code");
  codeEl.textContent = code;
  pre.append(codeEl);

  block.append(head, pre);
  parent.append(block);
}

function renderMarkdown(container, source) {
  const fence = new RegExp("\\x60\\x60\\x60([^\\n]*)\\n([\\s\\S]*?)\\x60\\x60\\x60", "g");
  let cursor = 0;
  let match;

  while ((match = fence.exec(source))) {
    if (match.index > cursor) {
      appendMarkdownText(container, source.slice(cursor, match.index));
    }
    appendCodeBlock(container, match[2], match[1]);
    cursor = fence.lastIndex;
  }

  if (cursor < source.length) {
    appendMarkdownText(container, source.slice(cursor));
  }
}

function addMessage(role, content, meta = "") {
  feed.querySelector(".welcome")?.remove();

  const wrapper = document.createElement("div");
  const isError = role === "assistant" && content.startsWith("Gagal menjalankan AI:");
  const isAssistant = role === "assistant" && !isError;
  wrapper.className = "message " + role + (isError ? " error" : "");
  if (isError) wrapper.setAttribute("role", "alert");

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "YOU" : (isError ? "!" : "KD");

  const body = document.createElement("div");
  body.className = "message-body";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (role === "user" || isError) {
    bubble.textContent = content;
  } else {
    renderMarkdown(bubble, content);
  }

  const time = document.createElement("div");
  time.className = "meta";
  time.textContent = meta || (role === "user" ? "You" : "KD Agent");

  body.append(bubble);

  if (isAssistant) {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copy = makeActionButton("copy", "Copy", () => {
      copyText(content, copy).catch(() => {});
    });

    const up = makeActionButton("up", "Thumbs Up", () => {
      const selected = up.classList.contains("selected");
      up.classList.toggle("selected", !selected);
      down.classList.remove("selected");
    });

    const down = makeActionButton("down", "Thumbs Down", () => {
      const selected = down.classList.contains("selected");
      down.classList.toggle("selected", !selected);
      up.classList.remove("selected");
    });

    const regenerate = makeActionButton("regenerate", "Regenerate", () => {
      regenerateLastResponse();
    });

    actions.append(copy, up, down, regenerate);
    body.append(actions);
  }

  body.append(time);
  wrapper.append(avatar, body);
  feed.append(wrapper);
  feed.scrollTop = feed.scrollHeight;
  return wrapper;
}

function setThinking(active) {
  const existing = feed.querySelector(".thinking");

  if (active && !existing) {
    const wrapper = document.createElement("div");
    wrapper.className = "message assistant thinking";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "KD";

    const body = document.createElement("div");
    body.className = "message-body";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const label = document.createElement("span");
    label.className = "thinking-label";
    label.textContent = "Berpikir";

    const dots = document.createElement("span");
    dots.className = "thinking-dots";

    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement("span");
      dot.className = "thinking-dot";
      dots.append(dot);
    }

    bubble.append(label, dots);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = "AI engine";

    body.append(bubble, meta);
    wrapper.append(avatar, body);
    feed.append(wrapper);
    feed.scrollTop = feed.scrollHeight;
  } else if (!active) {
    existing?.remove();
  }
}

function localPlan(objective, warning = "") {
  const text = objective.toLowerCase();
  const rules = [
    ["documents", ["pdf", "document", "dokumen", "file"], "Uraikan dan strukturkan dokumen yang diberikan."],
    ["web research", ["web", "website", "research", "riset", "scrape"], "Kumpulkan materi web publik sesuai kebutuhan."],
    ["knowledge", ["knowledge", "rag", "basis pengetahuan"], "Susun atau perbarui basis pengetahuan."],
    ["memory", ["memory", "memori", "ingat"], "Identifikasi konteks yang layak dipertahankan."],
    ["trends", ["trend", "trending", "tren"], "Kumpulkan dan ringkas sinyal tren."],
    ["media", ["video", "media", "montage"], "Susun alur kerja produksi media."],
    ["execution", ["run", "execute", "deploy", "jalankan"], "Siapkan langkah eksekusi yang terisolasi."]
  ];

  const steps = [
    {capability:"planning", action:"Pecah tujuan menjadi langkah yang dapat diperiksa."}
  ];

  rules.forEach(([capability, keywords, action]) => {
    if (keywords.some((word) => text.includes(word))) {
      steps.push({capability, action});
    }
  });

  return {
    objective,
    steps,
    warnings:[
      warning
        ? `Backend plan belum merespons: ${warning}`
        : "Backend plan belum merespons. Menampilkan rencana lokal."
    ]
  };
}

function renderPlan(plan) {
  planSteps.replaceChildren();

  plan.steps.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "plan-step";

    const num = document.createElement("span");
    num.className = "step-num";
    num.textContent = String(index + 1).padStart(2, "0");

    const copy = document.createElement("div");
    copy.className = "step-copy";

    const title = document.createElement("strong");
    title.textContent = step.capability.replaceAll("_", " ");

    const detail = document.createElement("p");
    detail.textContent = step.action;

    copy.append(title, detail);
    item.append(num, copy);
    planSteps.append(item);
  });

  planEmpty.hidden = true;
  planSteps.hidden = false;
  planState.textContent = plan.steps.length + " steps";

  warnings.replaceChildren();
  (plan.warnings || []).forEach((warning) => {
    const p = document.createElement("p");
    p.textContent = warning;
    warnings.append(p);
  });
  warnings.hidden = !(plan.warnings || []).length;
}

function renderProviders() {
  providerList.replaceChildren();

  providers.forEach((item) => {
    const card = document.createElement("div");
    card.className = "provider" + (item.id === providerSelect.value ? " active" : "");

    const top = document.createElement("div");
    top.className = "provider-top";

    const name = document.createElement("div");
    name.className = "provider-name";

    const dot = document.createElement("span");
    dot.className = "provider-dot" + (item.configured ? " good" : "");

    const title = document.createElement("span");
    title.textContent = item.name;

    name.append(dot, title);

    const status = document.createElement("span");
    status.className = "provider-status" + (item.configured ? " ready" : "");
    status.textContent = item.configured ? "READY" : "OFF";

    top.append(name, status);

    const model = document.createElement("small");
    model.className = "provider-model";
    model.textContent = item.configured ? item.model : "API key belum dikonfigurasi";

    const action = document.createElement("button");
    action.className = "provider-action";
    action.type = "button";
    action.disabled = item.id === providerSelect.value;
    action.textContent = item.id === providerSelect.value ? "Dipilih" : "Gunakan provider";
    action.addEventListener("click", () => {
      providerSelect.value = item.id;
      modelInput.value = item.model || "";
      renderProviders();
    });

    card.append(top, model, action);
    providerList.append(card);
  });
}

async function loadProviders() {
  try {
    const data = await fetchJson("/api/v1/providers", {
      headers:{"Accept":"application/json"}
    });

    providers = Array.isArray(data.providers) ? data.providers : [];

    const defaultProvider = data.default_provider || providers[0]?.id || "pateway";
    providerSelect.value = defaultProvider;

    const selected = providers.find((item) => item.id === defaultProvider);
    modelInput.value = selected?.model || modelInput.value;

    renderProviders();
    setConnection(true, "Backend online", providers.filter((item) => item.configured).length + "/1 provider siap");
    return true;
  } catch (error) {
    providers = [
      {id:"pateway", name:"PatewayAI", configured:false, model:"claude-sonnet-4-6"}
    ];
    renderProviders();
    setConnection(false, "Backend offline", error.message);
    return false;
  }
}

async function makePlan(objective) {
  planState.textContent = "Working…";

  try {
    const response = await fetch(apiUrl("/api/v1/plan"), {
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({objective})
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Plan request gagal.");
    }

    renderPlan(data);
  } catch (error) {
    console.warn("[KD Agent Plan] backend unavailable; using local plan", error);
    renderPlan(localPlan(objective, error.message));
  }
}

function closeDrawers() {
  sidebar?.classList.remove("open");
  rightRail?.classList.remove("open");
  document.body.classList.remove("drawer-open");
  if (drawerBackdrop) drawerBackdrop.hidden = true;
}

function openDrawer(drawer) {
  if (!drawer) return;
  sidebar?.classList.remove("open");
  rightRail?.classList.remove("open");
  drawer.classList.add("open");
  document.body.classList.add("drawer-open");
  if (drawerBackdrop) drawerBackdrop.hidden = false;
}

providerSelect?.addEventListener("change", () => {
  const provider = providers.find((item) => item.id === providerSelect.value);
  modelInput.value = provider?.model || "";
  renderProviders();
});

document.querySelectorAll(".quick").forEach((button) => {
  button.addEventListener("click", () => {
    promptInput.value = button.dataset.prompt || "";
    promptInput.focus();
  });
});

document.querySelectorAll("[data-close-drawer]").forEach((item) => {
  item.addEventListener("click", closeDrawers);
});

sidebarToggle?.addEventListener("click", () => openDrawer(sidebar));
toolsToggle?.addEventListener("click", () => openDrawer(rightRail));
sidebarClose?.addEventListener("click", closeDrawers);
toolsClose?.addEventListener("click", closeDrawers);
drawerBackdrop?.addEventListener("click", closeDrawers);

async function runPrompt(prompt, {appendUser = true, clearInput = true} = {}) {
  const cleanPrompt = String(prompt || "").trim();
  if (!cleanPrompt || sendBtn.disabled) return;

  const selected = providerSelect.value;
  const model = modelInput.value.trim();

  if (appendUser) {
    addMessage("user", cleanPrompt);
    messages.push({role:"user", content:cleanPrompt});
  }

  if (clearInput) {
    promptInput.value = "";
  }

  sendBtn.disabled = true;
  setThinking(true);

  await makePlan(cleanPrompt);

  try {
    const lastUserIndex = [...messages]
      .map((item, index) => item.role === "user" ? index : -1)
      .filter((index) => index >= 0)
      .pop();

    const history = lastUserIndex == null
      ? []
      : messages.slice(0, lastUserIndex).slice(-20);

    const data = await fetchJson("/api/v1/chat", {
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({
        prompt:cleanPrompt,
        provider:selected,
        model,
        history
      })
    });

    setThinking(false);
    const answer = data.content || "Provider tidak mengembalikan isi jawaban.";
    addMessage("assistant", answer, data.provider_name + " · " + data.model);
    messages.push({role:"assistant", content:answer});
    setConnection(true, "Backend online", data.provider_name + " · " + data.model);
  } catch (error) {
    setThinking(false);
    addMessage("assistant", "Gagal menjalankan AI: " + error.message, "KD Agent");
    setConnection(false, "AI error", "Periksa konfigurasi provider di backend");
  } finally {
    sendBtn.disabled = false;
  }
}

async function regenerateLastResponse() {
  if (sendBtn.disabled) return;

  const lastUserIndex = [...messages]
    .map((item, index) => item.role === "user" ? index : -1)
    .filter((index) => index >= 0)
    .pop();

  if (lastUserIndex == null) return;

  const lastUser = messages[lastUserIndex];

  if (messages[messages.length - 1]?.role === "assistant") {
    messages.pop();
    const assistantNodes = [...feed.querySelectorAll(".message.assistant:not(.thinking)")];
    assistantNodes.at(-1)?.remove();
  }

  await runPrompt(lastUser.content, {appendUser:false, clearInput:false});
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runPrompt(promptInput.value.trim());
});

promptInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 860) closeDrawers();
});

window.addEventListener("online", () => {
  loadProviders();
});

window.setInterval(() => {
  if (!backendOnline) {
    loadProviders();
  }
}, 30000);

loadProviders();
