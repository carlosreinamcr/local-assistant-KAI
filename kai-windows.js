const panelWindowSpecs = {
  dashboard: "width=460,height=610,left=18,top=72",
  mission: "width=460,height=610,left=500,top=72",
  log: "width=520,height=700,left=980,top=72",
  data: "width=560,height=520,left=260,top=720"
};

const openedPanels = new Map();
const windowsBaseRoute = window.routeCommand;

function panelURL(view) {
  return `panel.html#${view}`;
}

function openJarvisPanel(view) {
  const cleanView = panelWindowSpecs[view] ? view : "dashboard";
  const existing = openedPanels.get(cleanView);
  if (existing && !existing.closed) {
    existing.focus();
    return existing;
  }
  const external = window.open(panelURL(cleanView), `jarvis_${cleanView}`, panelWindowSpecs[cleanView]);
  if (external) openedPanels.set(cleanView, external);
  return external;
}

function openJarvisPanels() {
  ["dashboard", "mission", "log", "data"].forEach((view, index) => {
    window.setTimeout(() => openJarvisPanel(view), index * 120);
  });
  return "Pantallas externas K.A.I. abiertas. Si el navegador bloqueo alguna, usa los botones DASH, MISS, LOG o permite ventanas emergentes para este archivo.";
}

async function toggleJarvisFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
    return "Pantalla completa activada.";
  }
  await document.exitFullscreen();
  return "Pantalla completa desactivada.";
}

function broadcastPanelUpdate() {
  try {
    localStorage.setItem("jarvis.live.pulse.v1", String(Date.now()));
    if (window.jarvisHudChannel) window.jarvisHudChannel.postMessage({ type: "pulse", at: Date.now() });
  } catch {
    // Los paneles tambien refrescan por intervalo si no hay permisos de storage.
  }
}

window.jarvisHudChannel = "BroadcastChannel" in window ? new BroadcastChannel("jarvis-hud") : null;

window.openJarvisPanel = openJarvisPanel;
window.openJarvisPanels = openJarvisPanels;

window.routeCommand = async function routeWindowCommands(raw, clean) {
  if (clean.includes("pantalla completa") || clean === "fullscreen" || clean === "full") return toggleJarvisFullscreen();
  if (clean.includes("abrir paneles") || clean.includes("abrir pantallas") || clean.includes("multi pantalla") || clean.includes("multipantalla")) return openJarvisPanels();
  if (clean.includes("abrir dashboard") || clean.includes("panel dashboard")) {
    openJarvisPanel("dashboard");
    return "Dashboard externo abierto.";
  }
  if (clean.includes("abrir mision") || clean.includes("panel mision")) {
    openJarvisPanel("mission");
    return "Panel de mision abierto.";
  }
  if (clean.includes("abrir bitacora") || clean.includes("abrir log") || clean.includes("panel log")) {
    openJarvisPanel("log");
    return "Bitacora externa abierta.";
  }
  if (clean.includes("abrir datos") || clean.includes("panel datos") || clean.includes("panel data")) {
    openJarvisPanel("data");
    return "Panel de datos abierto.";
  }
  return windowsBaseRoute(raw, clean);
};

const multiButton = document.querySelector("#openPanelsButton");
const fullscreenButton = document.querySelector("#fullscreenButton");
if (multiButton) multiButton.addEventListener("click", () => window.runCommand("abrir paneles"));
if (fullscreenButton) fullscreenButton.addEventListener("click", () => window.runCommand("pantalla completa"));

document.querySelectorAll("[data-panel]").forEach((button) => {
  button.addEventListener("click", () => openJarvisPanel(button.dataset.panel));
});

setInterval(broadcastPanelUpdate, 1800);
broadcastPanelUpdate();



