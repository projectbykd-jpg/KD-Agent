const form = document.querySelector("#task-form");
const objective = document.querySelector("#objective");
const planSteps = document.querySelector("#plan-steps");
const planEmpty = document.querySelector("#plan-empty");
const planState = document.querySelector("#plan-state");
const warnings = document.querySelector("#warnings");
const grid = document.querySelector("#integration-grid");
const integrationCount = document.querySelector("#integration-count");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function renderPlan(plan) {
  planSteps.replaceChildren();
  plan.steps.forEach((step, index) => {
    const item = element("li", "plan-step");
    item.append(element("span", "step-number", String(index + 1).padStart(2, "0")));
    const detail = element("div", "step-detail");
    detail.append(element("strong", null, step.capability.replaceAll("_", " ")));
    detail.append(element("p", null, step.action));
    item.append(detail);
    item.append(element("span", step.integration ? "badge ready" : "badge", step.integration || "Needs adapter"));
    planSteps.append(item);
  });
  planEmpty.hidden = true;
  planSteps.hidden = false;
  planState.textContent = `${plan.steps.length} langkah dibuat`;
  warnings.replaceChildren(...plan.warnings.map((warning) => element("p", null, warning)));
  warnings.hidden = plan.warnings.length === 0;
}

async function loadIntegrations() {
  const response = await fetch("/api/status");
  const { integrations } = await response.json();
  grid.replaceChildren();
  const entries = Object.entries(integrations);
  let total = 0;
  entries.forEach(([capability, items]) => {
    total += items.length;
    const card = element("article", "integration-card");
    card.append(element("h2", null, capability.replaceAll("_", " ")));
    items.forEach((item) => {
      const row = element("div", "integration-row");
      row.append(element("span", "dot"));
      row.append(element("span", null, item.name));
      row.append(element("small", null, item.enabled ? "Ready" : "Not enabled"));
      card.append(row);
    });
    grid.append(card);
  });
  integrationCount.textContent = `${total} upstream integrations`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  planState.textContent = "Menyusun rencana…";
  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective: objective.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Tidak dapat membuat rencana.");
    renderPlan(data);
  } catch (error) {
    planState.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

loadIntegrations().catch(() => { integrationCount.textContent = "Tidak dapat memuat"; });
