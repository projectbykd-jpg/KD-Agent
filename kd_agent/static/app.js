const $ = (selector) => document.querySelector(selector);
const form = $("#chat-form");
const promptInput = $("#prompt");
const feed = $("#chat-feed");
const sendBtn = $("#send-btn");
const providerSelect = $("#provider");
const modelInput = $("#model");
const providerList = $("#provider-list");
const apiBaseInput = $("#api-base");
const saveApiBtn = $("#save-api");
const connectionDot = $("#connection-dot");
const connectionText = $("#connection-text");
const backendText = $("#backend-text");
const liveDot = $("#live-dot");
const liveLabel = $("#live-label");
const planState = $("#plan-state");
const planEmpty = $("#plan-empty");
const planSteps = $("#plan-steps");
const warnings = $("#warnings");

let messages = [];
let providers = [];

function apiBase() {
  const stored = localStorage.getItem("kdAgentApiBase");
  const query = new URLSearchParams(location.search).get("api");
  return (query || stored || "").replace(/\/$/, "");
}

function apiUrl(path) {
  const base = apiBase();
  return base ? base + path : path;
}

function setConnection(ok, label, detail) {
  connectionDot.className = ok ? "good" : "";
  liveDot.className = ok ? "good" : "";
  connectionText.textContent = label;
  backendText.textContent = detail;
  liveLabel.textContent = ok ? "Connected" : "Local";
}

function addMessage(role, content, meta = "") {
  const empty = feed.querySelector(".welcome");
  if (empty) empty.remove();
  const wrapper = document.createElement("div");
  wrapper.className = "message " + role;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "YOU" : "KD";
  const body = document.createElement("div");
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
    wrapper.innerHTML = '<div class="avatar">KD</div><div><div class="bubble">Sedang berpikir…</div><div class="meta">AI engine</div></div>';
    feed.append(wrapper);
    feed.scrollTop = feed.scrollHeight;
  } else if (!active && existing) {
    existing.remove();
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
  const steps = [{capability:"planning", action:"Pecah tujuan menjadi langkah yang dapat diperiksa.", integration:null}];
  for (const rule of rules) {
    const capability = rule[0];
    const keywords = rule[1];
    const action = rule[2];
    if (keywords.some((word) => text.includes(word))) {
      steps.push({capability, action, integration:null});
    }
  }
  return {objective, steps, warnings:["Mode browser: rencana lokal. Hubungkan backend untuk AI dan readiness provider."]};
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
    const strong = document.createElement("strong");
    strong.textContent = step.capability.replaceAll("_", " ");
    const p = document.createElement("p");
    p.textContent = step.action;
    copy.append(strong, p);
    item.append(num, copy);
    planSteps.append(item);
  });
  planEmpty.hidden = true;
  planSteps.hidden = false;
  planState.textContent = plan.steps.length + " langkah";
  warnings.replaceChildren(...(plan.warnings || []).map((warning) => {
    const p = document.createElement("p");
    p.textContent = warning;
    return p;
  }));
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
    status.textContent = item.configured ? "READY" : "OFF";
    status.style.color = item.configured ? "#4ade80" : "#69768c";
    status.style.fontSize = "9px";
    status.style.fontWeight = "800";
    top.append(name, status);
    const model = document.createElement("small");
    model.textContent = item.configured ? item.model : "Isi " + item.api_key_env + " di backend";
    const action = document.createElement("button");
    action.className = "provider-action";
    action.textContent = item.id === providerSelect.value ? "Dipilih" : "Pakai provider ini";
    action.disabled = item.id === providerSelect.value;
    action.addEventListener("click", () => {
      providerSelect.value = item.id;
      modelInput.value = item.model;
      renderProviders();
    });
    card.append(top, model, action);
    providerList.append(card);
  });
}

async function loadProviders() {
  if (!apiBase()) {
    providers = [
      {id:"openai", name:"OpenAI", configured:false, model:"gpt-5.6", api_key_env:"OPENAI_API_KEY"},
      {id:"groq", name:"Groq", configured:false, model:"openai/gpt-oss-120b", api_key_env:"GROQ_API_KEY"},
      {id:"openrouter", name:"OpenRouter", configured:false, model:"openrouter/auto", api_key_env:"OPENROUTER_API_KEY"}
    ];
    renderProviders();
    setConnection(false, "Local mode", "Belum terhubung ke backend");
    return false;
  }
  try {
    const response = await fetch(apiUrl("/api/v1/providers"));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Provider endpoint gagal.");
    providers = data.providers || [];
    providerSelect.value = data.default_provider || "openai";
    const selected = providers.find((item) => item.id === providerSelect.value);
    modelInput.value = selected?.model || "gpt-5.6";
    renderProviders();
    setConnection(true, "Backend online", providers.filter((item) => item.configured).length + "/3 provider siap");
    return true;
  } catch (error) {
    setConnection(false, "Backend error", error.message);
    return false;
  }
}

async function makePlan(text) {
  planState.textContent = "Menyusun…";
  try {
    const response = await fetch(apiUrl("/api/v1/plan"), {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({objective:text})
    });
    if (!response.ok) throw new Error("Backend plan gagal");
    renderPlan(await response.json());
  } catch {
    renderPlan(localPlan(text));
  }
}

providerSelect.addEventListener("change", () => {
  const provider = providers.find((item) => item.id === providerSelect.value);
  modelInput.value = provider?.model || modelInput.value;
  renderProviders();
});

document.querySelectorAll(".quick").forEach((button) => {
  button.addEventListener("click", () => {
    promptInput.value = button.dataset.prompt || "";
    promptInput.focus();
  });
});

saveApiBtn.addEventListener("click", async () => {
  const value = apiBaseInput.value.trim().replace(/\/$/, "");
  if (value) localStorage.setItem("kdAgentApiBase", value);
  else localStorage.removeItem("kdAgentApiBase");
  await loadProviders();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;
  const selected = providerSelect.value;
  const model = modelInput.value.trim();
  addMessage("user", prompt);
  messages.push({role:"user", content:prompt});
  promptInput.value = "";
  sendBtn.disabled = true;
  setThinking(true);
  await makePlan(prompt);

  if (!apiBase()) {
    setThinking(false);
    addMessage("assistant", "Backend belum terhubung. Masukkan URL backend di kiri untuk menjalankan AI. Rencana lokal sudah dibuat di panel kanan.", "Local planner");
    sendBtn.disabled = false;
    return;
  }

  try {
    const response = await fetch(apiUrl("/api/v1/chat"), {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({prompt, provider:selected, model, history:messages.slice(-20)})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AI request gagal.");
    setThinking(false);
    addMessage("assistant", data.content || "Provider tidak mengembalikan isi jawaban.", data.provider_name + " · " + data.model);
    messages.push({role:"assistant", content:data.content || ""});
    setConnection(true, "Backend online", data.provider_name + " · " + data.model);
  } catch (error) {
    setThinking(false);
    addMessage("assistant", "Gagal menjalankan AI: " + error.message, "KD Agent");
    setConnection(false, "Backend error", "Cek URL dan API key provider");
  } finally {
    sendBtn.disabled = false;
  }
});

promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

apiBaseInput.value = apiBase();
loadProviders();
