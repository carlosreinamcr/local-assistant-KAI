const panelCanvas = document.querySelector("#panelCanvas");
const panelCtx = panelCanvas.getContext("2d");
const panelTitle = document.querySelector("#panelTitle");
const panelStatus = document.querySelector("#panelStatus");
const panelContent = document.querySelector("#panelContent");
const panelTabs = document.querySelectorAll(".external-tabs button");
const channel = "BroadcastChannel" in window ? new BroadcastChannel("jarvis-hud") : null;

const panelKeys = {
  notes: "jarvis.notes.v3",
  tasks: "jarvis.tasks.v3",
  memory: "jarvis.memory.v3",
  missions: "jarvis.missions.v1",
  apiKey: "jarvis.gemini.apiKey.v1",
  model: "jarvis.gemini.model.v1",
  liveResult: "jarvis.live.result.v1",
  liveLog: "jarvis.live.log.v1"
};

let panelWidth = 0;
let panelHeight = 0;
let scanDots = [];

function readPanelStore(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function resizePanelCanvas() {
  const ratio = window.devicePixelRatio || 1;
  panelWidth = window.innerWidth;
  panelHeight = window.innerHeight;
  panelCanvas.width = Math.floor(panelWidth * ratio);
  panelCanvas.height = Math.floor(panelHeight * ratio);
  panelCanvas.style.width = `${panelWidth}px`;
  panelCanvas.style.height = `${panelHeight}px`;
  panelCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  scanDots = Array.from({ length: 72 }, () => ({
    x: Math.random() * panelWidth,
    y: Math.random() * panelHeight,
    r: Math.random() * 1.7 + 0.5,
    v: Math.random() * 0.35 + 0.12
  }));
}

function drawPanel(now) {
  panelCtx.clearRect(0, 0, panelWidth, panelHeight);
  panelCtx.strokeStyle = "rgba(106, 231, 255, 0.08)";
  for (let x = 0; x < panelWidth; x += 34) {
    panelCtx.beginPath();
    panelCtx.moveTo(x, 0);
    panelCtx.lineTo(x, panelHeight);
    panelCtx.stroke();
  }
  for (let y = 0; y < panelHeight; y += 34) {
    panelCtx.beginPath();
    panelCtx.moveTo(0, y);
    panelCtx.lineTo(panelWidth, y);
    panelCtx.stroke();
  }

  scanDots.forEach((dot) => {
    dot.y += dot.v;
    if (dot.y > panelHeight + 8) dot.y = -8;
    panelCtx.fillStyle = "rgba(106, 231, 255, 0.42)";
    panelCtx.beginPath();
    panelCtx.arc(dot.x + Math.sin(now * 0.001 + dot.y) * 8, dot.y, dot.r, 0, Math.PI * 2);
    panelCtx.fill();
  });

  const sweep = (now * 0.05) % (panelHeight + 120) - 60;
  const gradient = panelCtx.createLinearGradient(0, sweep - 40, 0, sweep + 40);
  gradient.addColorStop(0, "rgba(106, 231, 255, 0)");
  gradient.addColorStop(0.5, "rgba(106, 231, 255, 0.2)");
  gradient.addColorStop(1, "rgba(106, 231, 255, 0)");
  panelCtx.fillStyle = gradient;
  panelCtx.fillRect(0, sweep - 40, panelWidth, 80);
  requestAnimationFrame(drawPanel);
}

function activeView() {
  return (location.hash || "#dashboard").replace("#", "") || "dashboard";
}

function setView(view) {
  location.hash = view;
  renderPanel();
}

function updateTabs(view) {
  panelTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
}

function panelRow(label, value) {
  const row = document.createElement("div");
  row.className = "panel-row";
  const key = document.createElement("span");
  const val = document.createElement("strong");
  key.textContent = label;
  val.textContent = value;
  row.append(key, val);
  return row;
}

function panelText(text) {
  const block = document.createElement("pre");
  block.className = "panel-pre";
  block.textContent = text;
  return block;
}

function renderPanel() {
  const view = activeView();
  updateTabs(view);
  panelContent.innerHTML = "";
  panelStatus.textContent = navigator.onLine ? "SYNC" : "OFFLINE";

  if (view === "dashboard") renderDashboard();
  else if (view === "mission") renderMissionPanel();
  else if (view === "log") renderLogPanel();
  else renderDataPanel();
}

function renderDashboard() {
  panelTitle.textContent = "DASHBOARD";
  const notes = readPanelStore(panelKeys.notes, []);
  const tasks = readPanelStore(panelKeys.tasks, []);
  const missions = readPanelStore(panelKeys.missions, []);
  const result = readPanelStore(panelKeys.liveResult, null);
  const grid = document.createElement("div");
  grid.className = "external-metrics";
  [
    ["IA", readPanelStore(panelKeys.apiKey, "") ? `Gemini ${readPanelStore(panelKeys.model, "gemini-3.6-flash")}` : "Local"],
    ["Notas", String(notes.length)],
    ["Tareas", String(tasks.filter((task) => !task.done).length)],
    ["Misiones", String(missions.filter((mission) => !mission.done).length)],
    ["Conexion", navigator.onLine ? "Online" : "Offline"],
    ["Ultimo resultado", result?.title || "Esperando"]
  ].forEach(([label, value]) => grid.appendChild(panelRow(label, value)));
  panelContent.appendChild(grid);
}

function renderMissionPanel() {
  panelTitle.textContent = "MISSION";
  const missions = readPanelStore(panelKeys.missions, []);
  const active = missions.find((mission) => !mission.done) || missions[0];
  if (!active) {
    panelContent.appendChild(panelText("No hay misiones activas.\nCrea una con: nueva mision ..."));
    return;
  }
  panelContent.appendChild(panelRow("Objetivo", active.objective));
  panelContent.appendChild(panelRow("Estado", active.done ? "Completada" : "Activa"));
  const list = document.createElement("ol");
  list.className = "panel-steps";
  active.steps.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = active.done || index < active.current ? "is-done" : index === active.current ? "is-now" : "";
    item.textContent = step;
    list.appendChild(item);
  });
  panelContent.appendChild(list);
}

function renderLogPanel() {
  panelTitle.textContent = "BITACORA";
  const log = readPanelStore(panelKeys.liveLog, []);
  if (!log.length) {
    panelContent.appendChild(panelText("Sin entradas todavia."));
    return;
  }
  log.slice(-24).reverse().forEach((entry) => {
    panelContent.appendChild(panelRow(entry.title || "LOG", entry.message || ""));
  });
}

function renderDataPanel() {
  panelTitle.textContent = "DATA";
  const notes = readPanelStore(panelKeys.notes, []);
  const tasks = readPanelStore(panelKeys.tasks, []);
  const memory = readPanelStore(panelKeys.memory, {});
  const result = readPanelStore(panelKeys.liveResult, null);
  panelContent.appendChild(panelRow("Pantalla", `${screen.width} x ${screen.height}`));
  panelContent.appendChild(panelRow("Ventana", `${innerWidth} x ${innerHeight}`));
  panelContent.appendChild(panelRow("Idioma", navigator.language || "No disponible"));
  panelContent.appendChild(panelRow("Memoria", `${Object.keys(memory).length} recuerdos`));
  panelContent.appendChild(panelRow("Notas recientes", notes.slice(-3).map((note) => note.text).join(" | ") || "Sin notas"));
  panelContent.appendChild(panelRow("Tareas", tasks.slice(0, 4).map((task) => task.text).join(" | ") || "Sin tareas"));
  if (result) panelContent.appendChild(panelText(`${result.title}\n\n${result.text}`));
}

panelTabs.forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));
window.addEventListener("hashchange", renderPanel);
window.addEventListener("storage", renderPanel);
window.addEventListener("resize", resizePanelCanvas);
if (channel) channel.addEventListener("message", renderPanel);

resizePanelCanvas();
renderPanel();
requestAnimationFrame(drawPanel);
setInterval(renderPanel, 2500);



