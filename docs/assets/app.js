const integrations = [
  ["Hermes Agent", "Planning", "Otak agent dan pengalaman multi-platform", "https://github.com/NousResearch/hermes-agent"],
  ["OpenSpec", "Planning", "Spec-driven development", "https://github.com/Fission-AI/OpenSpec"],
  ["spec-kit", "Planning", "Toolkit spesifikasi", "https://github.com/github/spec-kit"],
  ["Fabric", "Planning", "Framework prompt modular", "https://github.com/danielmiessler/Fabric"],
  ["Docling", "Documents", "Konversi dokumen dan PDF", "https://github.com/docling-project/docling"],
  ["Scrapling", "Web research", "Web scraping adaptif", "https://github.com/D4Vinci/Scrapling"],
  ["PageIndex", "Knowledge", "RAG berbasis struktur dokumen", "https://github.com/VectifyAI/PageIndex"],
  ["mem0", "Memory", "Memori agent jangka panjang", "https://github.com/mem0ai/mem0"],
  ["headroom", "Memory", "Kompresi konteks JSON", "https://github.com/headroomlabs-ai/headroom"],
  ["caveman", "Memory", "Efisiensi token", "https://github.com/JuliusBrussee/caveman"],
  ["Daytona", "Execution", "Sandbox eksekusi aman", "https://github.com/daytonaio/daytona"],
  ["TrendRadar", "Trends", "Pemantau tren multi-platform", "https://github.com/sansan0/TrendRadar"],
  ["hyperframes", "Media", "HTML ke video untuk agent", "https://github.com/heygen-com/hyperframes"],
  ["OpenMontage", "Media", "Studio produksi video agentic", "https://github.com/calesthio/OpenMontage"],
  ["AI Engineering Hub", "Learning", "Referensi LLM dan RAG", "https://github.com/patchy631/ai-engineering-hub"],
].map(([name, capability, description, url]) => ({ name, capability, description, url }));

const routes = [
  { capability: "Planning", action: "Pecah tujuan menjadi langkah yang bisa diverifikasi.", terms: [] },
  { capability: "Documents", action: "Strukturkan dokumen atau PDF yang diberikan.", terms: ["pdf", "dokumen", "document", "file"] },
  { capability: "Web research", action: "Rencanakan pengumpulan materi web publik dengan kebijakan yang jelas.", terms: ["web", "website", "riset", "research", "scrape"] },
  { capability: "Knowledge", action: "Rencanakan pembaruan atau pencarian basis pengetahuan.", terms: ["rag", "knowledge", "knowledge base", "basis pengetahuan"] },
  { capability: "Memory", action: "Tentukan konteks jangka panjang yang perlu diingat dengan persetujuan pengguna.", terms: ["memory", "memori", "ingat", "remember"] },
  { capability: "Trends", action: "Kumpulkan dan bandingkan sinyal tren.", terms: ["trend", "tren", "trending"] },
  { capability: "Media", action: "Susun produksi konten atau video.", terms: ["video", "media", "montage"] },
  { capability: "Execution", action: "Siapkan permintaan eksekusi pada lingkungan terisolasi.", terms: ["run", "jalankan", "execute", "deploy"] },
  { capability: "Learning", action: "Rujuk pola engineering untuk meningkatkan solusi.", terms: ["belajar", "learn", "engineering"] },
];

const byId = (id) => document.getElementById(id);
const titleCase = (value) => value.replace(/\b\w/g, (letter) => letter.toUpperCase());

function renderCatalogue() {
  const grid = byId("integration-grid");
  integrations.forEach((integration) => {
    const card = document.createElement("article");
    card.className = "integration-card";
    card.innerHTML = `<p class="capability">${integration.capability}</p><h3>${integration.name}</h3><p>${integration.description}</p><a href="${integration.url}" target="_blank" rel="noreferrer">Buka repositori <span>↗</span></a>`;
    grid.append(card);
  });
  byId("integration-count").textContent = `${integrations.length} repositori terhubung`;
}

function renderPlan(objective) {
  const normalized = objective.toLocaleLowerCase();
  const selected = routes.filter((route, index) => index === 0 || route.terms.some((term) => normalized.includes(term)));
  const steps = byId("plan-steps");
  steps.replaceChildren();
  selected.forEach((route, index) => {
    const supporting = integrations.filter((item) => item.capability === route.capability);
    const item = document.createElement("li");
    item.className = "plan-step";
    item.innerHTML = `<span class="step-number">${String(index + 1).padStart(2, "0")}</span><div><strong>${route.capability}</strong><p>${route.action}</p><div class="links">${supporting.map((tool) => `<a href="${tool.url}" target="_blank" rel="noreferrer">${tool.name}</a>`).join("")}</div></div>`;
    steps.append(item);
  });
  byId("plan-empty").hidden = true;
  steps.hidden = false;
  byId("plan-state").textContent = `${selected.length} langkah dibuat`;
  const warnings = byId("warnings");
  warnings.textContent = "Langkah ini adalah rencana. Aktifkan adapter backend untuk menjalankan integrasi secara nyata.";
  warnings.hidden = false;
}

byId("task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  renderPlan(byId("objective").value.trim());
});

renderCatalogue();
