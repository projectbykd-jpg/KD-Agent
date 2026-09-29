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
  return DEFAULT_BACKEND_URL + path;
}

function setConnection(ok, label, detail) {
  connectionDot.classList.toggle("good", Boolean(ok));
  liveDot.classList.toggle("good", Boolean(ok));
  connectionText.textContent = label;
  backendText.textContent = detail;
  liveLabel.textContent = ok ? "Connected" : "Offline";
}

function addMessage(role, content, meta = "") {
  feed.querySelector(".welcome")?.remove();

  const wrapper = document.createElement("div");
  const isError = role === "assistant" && content.startsWith("Gagal menjalankan AI:");
  wrapper.className = "message " + role + (isError ? " error" : "");
  if (isError) wrapper.setAttribute("role", "alert");

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "YOU" : (isError ? "!" : "KD");

  const body = document.createElement("div");
  body.className = "message-body";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = content;

  const time = document.createElement("div");
  time.className = "meta";
  time.textContent = meta || (role === "user" ? "You" : "KD Agent");

  body.append(bubble, time);
  wrapper.append(avatar, body);
  feed.append(wrapper);
  feed.scrollTop = feed.scrollHeight;
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
    bubble.textContent = "Sedang berpikir…";
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

function localPlan(objective) {
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
    warnings:["Backend plan belum merespons. Menampilkan rencana lokal."]
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
    const response = await fetch(apiUrl("/api/v1/providers"), {headers:{"Accept":"application/json"}});
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Provider endpoint gagal.");
    }

    providers = Array.isArray(data.providers) ? data.providers : [];

    const defaultProvider = data.default_provider || providers[0]?.id || "openai";
    providerSelect.value = defaultProvider;

    const selected = providers.find((item) => item.id === defaultProvider);
    modelInput.value = selected?.model || modelInput.value;

    renderProviders();
    setConnection(true, "Backend online", providers.filter((item) => item.configured).length + "/3 provider siap");
    return true;
  } catch (error) {
    providers = [
      {id:"openai", name:"OpenAI", configured:false, model:"gpt-5.6"},
      {id:"groq", name:"Groq", configured:false, model:"openai/gpt-oss-120b"},
      {id:"openrouter", name:"OpenRouter", configured:false, model:"openrouter/auto"}
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
  } catch {
    renderPlan(localPlan(objective));
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

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const prompt = promptInput.value.trim();
  if (!prompt || sendBtn.disabled) return;

  const selected = providerSelect.value;
  const model = modelInput.value.trim();

  addMessage("user", prompt);
  messages.push({role:"user", content:prompt});
  promptInput.value = "";
  sendBtn.disabled = true;
  setThinking(true);

  await makePlan(prompt);

  try {
    const response = await fetch(apiUrl("/api/v1/chat"), {
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({
        prompt,
        provider:selected,
        model,
        history:messages.slice(0, -1).slice(-20)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "AI request gagal.");
    }

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

loadProviders();
