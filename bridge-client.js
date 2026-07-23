const BRIDGE_URL = "http://127.0.0.1:8765";
const bridgeBaseRoute = window.routeCommand;
let bridgeOnline = false;

function installPrimaryConsole() {
  const primaryInput = document.querySelector("#primaryCommand");
  const primaryExecute = document.querySelector("#primaryExecute");
  const primaryVoice = document.querySelector("#primaryVoice");
  if (!primaryInput || !primaryExecute) return;
  primaryExecute.addEventListener("click", () => window.runCommand(primaryInput.value));
  primaryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      window.runCommand(primaryInput.value);
    }
  });
  if (primaryVoice) primaryVoice.addEventListener("click", () => voiceButton?.click());
}

function installBridgePanel() {
  const rightColumn = document.querySelector(".right-column");
  const resultPanelElement = document.querySelector(".result-panel");
  if (!rightColumn || document.querySelector("#bridgePanel")) return;
  const panel = document.createElement("section");
  panel.id = "bridgePanel";
  panel.className = "hud-panel bridge-panel";
  panel.innerHTML = `
    <div class="panel-heading">
      <span>Puente local</span>
      <strong id="bridgeState">OFFLINE</strong>
    </div>
    <div class="bridge-actions">
      <button id="bridgeCheck" class="ghost-action">CHECK</button>
      <button id="bridgeAR" class="primary-action">AR APP</button>
    </div>
    <p id="bridgeHint" class="bridge-hint">Ejecuta npm run bridge para habilitar acciones reales del PC.</p>
  `;
  rightColumn.insertBefore(panel, resultPanelElement);
  document.querySelector("#bridgeCheck").addEventListener("click", () => window.runCommand("estado puente local"));
  document.querySelector("#bridgeAR").addEventListener("click", () => window.runCommand("crear proyecto ar miprimerawebar"));
}

async function bridgeFetch(path, options = {}) {
  const response = await fetch(`${BRIDGE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `Puente local respondio HTTP ${response.status}`);
  return data;
}

async function checkBridge() {
  try {
    const status = await bridgeFetch("/api/status");
    bridgeOnline = true;
    updateBridgeUI(status);
    return status;
  } catch {
    bridgeOnline = false;
    updateBridgeUI(null);
    return null;
  }
}

function updateBridgeUI(status) {
  const state = document.querySelector("#bridgeState");
  const hint = document.querySelector("#bridgeHint");
  if (state) state.textContent = status ? "ONLINE" : "OFFLINE";
  if (hint) {
    hint.textContent = status
      ? `Node activo en puerto ${status.port}. Acciones reales habilitadas.`
      : "Ejecuta npm run bridge para habilitar acciones reales del PC.";
  }
}

function cleanNameCandidate(value) {
  return String(value || "")
    .replace(/(?:\s+y\s+|\s+dentro\s+|\s+con\s+|\s+que\s+|,|\.|;).*$/i, "")
    .replace(/^(una|un|la|el)\s+/i, "")
    .trim();
}

function inferDefaultProjectName(clean) {
  if (clean.includes("mindar") || clean.includes(".mind") || clean.includes("archivo mind")) return "mindar-webar";
  if (clean.includes("realidad aumentada") || clean.includes("webar") || clean.includes("glb") || clean.includes("modelo 3d")) return "miprimerawebar";
  if (clean.includes("pagina web") || clean.includes("sitio web") || clean.includes("app web") || clean.includes("aplicacion web")) return "miwebkai";
  return "nueva-carpeta-kai";
}

function parseFolderName(raw, clean = normalizeCommand(raw)) {
  const text = String(raw || "");
  const explicit = text.match(/(?:se llame|llamada|llamado|con nombre|nombre)\s+([a-zA-Z0-9._ -]+)/i);
  if (explicit) return cleanNameCandidate(explicit[1]) || inferDefaultProjectName(clean);
  return inferDefaultProjectName(clean);
}

function parseProjectName(raw, clean = normalizeCommand(raw)) {
  const text = String(raw || "");
  const explicit = text.match(/(?:proyecto|app|aplicacion|carpeta|workspace)?\s*(?:se llame|llamada|llamado|con nombre|nombre)\s+([a-zA-Z0-9._ -]+)/i);
  if (explicit) return cleanNameCandidate(explicit[1]) || inferDefaultProjectName(clean);
  const compact = text.match(/(?:proyecto ar|aplicacion ar|app ar|webar|mindar)\s+([a-zA-Z0-9._ -]{3,})/i);
  if (compact) {
    const candidate = cleanNameCandidate(compact[1]);
    if (candidate && !/^(y|con|que|utilizando|usando|para)$/i.test(candidate)) return candidate;
  }
  return inferDefaultProjectName(clean);
}
function wantsFolder(clean) {
  const hasCreate = clean.includes("crear") || clean.includes("crea") || clean.includes("haz") || clean.includes("genera");
  return hasCreate && (clean.includes("carpeta") || clean.includes("folder")) && !wantsARProject(clean);
}

function wantsWebProject(clean) {
  const hasCreate = clean.includes("crear") || clean.includes("crea") || clean.includes("construye") || clean.includes("genera") || clean.includes("haz");
  const hasWeb = clean.includes("pagina web") || clean.includes("sitio web") || clean.includes("landing") || clean.includes("aplicacion web") || clean.includes("app web");
  return hasCreate && hasWeb && !wantsARProject(clean);
}

function wantsMindARProject(clean) {
  const hasCreate = clean.includes("crear") || clean.includes("crea") || clean.includes("construye") || clean.includes("genera") || clean.includes("haz");
  const hasMindAR = clean.includes("mindar") || clean.includes(".mind") || clean.includes("archivo mind");
  const hasAR = clean.includes("realidad aumentada") || clean.includes("webar") || clean.includes(" ar") || clean.includes("modelo 3d") || clean.includes("glb");
  return hasCreate && hasMindAR && hasAR;
}
function wantsARProject(clean) {
  const hasCreate = clean.includes("crear") || clean.includes("crea") || clean.includes("construye") || clean.includes("genera");
  const hasAR = clean.includes("realidad aumentada") || clean.includes("webar") || clean.includes(" ar") || clean.includes("glb") || clean.includes("modelo 3d");
  const hasDesktopFolder = clean.includes("carpeta") || clean.includes("escritorio") || clean.includes("visual studio") || clean.includes("vscode") || clean.includes("workspace");
  return hasCreate && hasAR && (hasDesktopFolder || clean.includes("proyecto ar") || clean.includes("aplicacion ar"));
}

function wantsVSCode(clean) {
  const hasOpen = clean.startsWith("abrir") || clean.startsWith("abre") || clean.startsWith("inicia") || clean.startsWith("ejecuta") || clean.startsWith("lanza");
  const isVSCode = clean.includes("visual studio code") || clean.includes("vs code") || clean.includes("vscode");
  return hasOpen && isVSCode;
}

async function openVSCodeFromCommand() {
  const status = await checkBridge();
  if (!status) return bridgeOfflineMessage();
  const data = await bridgeFetch("/api/action", {
    method: "POST",
    body: JSON.stringify({ action: "open-vscode" })
  });
  setResult("Visual Studio Code", [
    ["Estado", data.vscode?.ok ? "Abierto" : data.vscode?.warning || "No confirmado"],
    ["Ruta", data.target],
    ["Metodo", data.vscode?.method || "desconocido"]
  ]);
  return data.vscode?.ok
    ? "Abri Visual Studio Code como aplicacion del computador."
    : data.vscode?.warning || "Intente abrir Visual Studio Code, pero no pude confirmar la ejecucion.";
}

async function createFolderFromCommand(raw, clean) {
  const status = await checkBridge();
  if (!status) return bridgeOfflineMessage();
  const folderName = parseFolderName(raw, clean);
  const data = await bridgeFetch("/api/action", {
    method: "POST",
    body: JSON.stringify({ action: "create-folder", name: folderName, location: clean.includes("document") ? "documents" : "desktop" })
  });
  let vscode = null;
  if (clean.includes("visual studio") || clean.includes("vscode") || clean.includes("vs code") || clean.includes("workspace")) {
    vscode = await bridgeFetch("/api/action", { method: "POST", body: JSON.stringify({ action: "open-vscode", path: data.path }) });
  }
  setResult("Carpeta creada", [
    ["Nombre", data.name],
    ["Ruta", data.path],
    ["VS Code", vscode ? (vscode.vscode?.ok ? "Abierto" : vscode.vscode?.warning || "No confirmado") : "No solicitado"]
  ]);
  return vscode ? `Cree la carpeta ${data.name} y la abri en Visual Studio Code.` : `Cree la carpeta ${data.name}.`;
}

async function createWebProjectFromCommand(raw, clean) {
  const status = await checkBridge();
  if (!status) return bridgeOfflineMessage();
  const name = parseProjectName(raw, clean).replace(/^web-?/i, "") || "miwebkai";
  const data = await bridgeFetch("/api/action", {
    method: "POST",
    body: JSON.stringify({ action: "create-web-project", name, location: clean.includes("document") ? "documents" : "desktop", openVSCode: true })
  });
  setResult("Proyecto web creado", [
    ["Nombre", data.projectName],
    ["Ruta", data.projectPath],
    ["VS Code", data.vscode?.ok ? "Abierto" : data.vscode?.warning || "No confirmado"],
    ["Servidor", `cd "${data.projectPath}" && npm start`],
    ["URL", "http://localhost:3000"]
  ]);
  return `Cree el proyecto web ${data.projectName} y lo prepare para abrirlo en VS Code.`;
}

function bridgeOfflineMessage() {
  setResult("Puente local desconectado", [
    ["Estado", "OFFLINE"],
    ["Accion", "Ejecuta npm run bridge en C:\\Users\\USER\\Documents\\Jarvis"],
    ["Luego", "Abre http://127.0.0.1:8765/index.html"]
  ], "WAIT");
  return "Necesito el puente local Node activo. Ejecuta npm run bridge y vuelve a pedir la accion.";
}

function parseNamedAsset(raw, extension, fallbackLocation) {
  const text = String(raw || "");
  const match = text.match(new RegExp(`([^\\s\\\\/:*?\"<>|]+\\.${extension})`, "i"));
  if (!match) return null;
  const before = text.slice(0, match.index).toLowerCase();
  const after = text.slice(match.index).toLowerCase();
  const windowText = `${before.slice(-120)} ${after.slice(0, 160)}`;
  let location = fallbackLocation;
  if (/descargas|downloads/.test(windowText)) location = "downloads";
  if (/escritorio|desktop/.test(windowText)) location = "desktop";
  if (/documentos|documents/.test(windowText)) location = "documents";
  return { fileName: match[1].trim(), location };
}

function parseLaunchRequest(clean) {
  return clean.includes("abre la aplicacion")
    || clean.includes("abrir la aplicacion")
    || clean.includes("abre en el navegador")
    || clean.includes("abrir en el navegador")
    || clean.includes("luego abre")
    || clean.includes("ejecuta la aplicacion");
}
function parseTextFileRequest(clean) {
  const wantsTextFile = clean.includes("bloc de notas")
    || clean.includes("archivo de texto")
    || clean.includes("txt")
    || clean.includes("tutorial");
  if (!wantsTextFile) return null;
  let name = "tutorial";
  const named = clean.match(/(?:se debe de llamar|se debe llamar|llamado|llamada|nombre)\s+([a-z0-9._ -]+)/i);
  if (named) name = cleanNameCandidate(named[1]) || name;
  if (!/\.txt$/i.test(name)) name += ".txt";
  return {
    fileName: name,
    kind: clean.includes("tutorial") ? "mindar-tutorial" : "text",
    topic: "hacer funcionar la app de realidad aumentada MindAR generada"
  };
}
async function createMindARProjectFromCommand(raw, clean) {
  const status = await checkBridge();
  if (!status) return bridgeOfflineMessage();

  const projectName = parseProjectName(raw, clean);
  const glb = parseNamedAsset(raw, "glb", "desktop");
  const mind = parseNamedAsset(raw, "mind", "downloads");
  const openBrowser = parseLaunchRequest(clean);
  const textFile = parseTextFileRequest(clean);
  const openVSCode = wantsVSCode(clean) || clean.includes("workspace") || clean.includes("visual studio");
  const data = await bridgeFetch("/api/action", {
    method: "POST",
    body: JSON.stringify({
      action: "create-mindar-project",
      name: projectName,
      location: clean.includes("document") ? "documents" : "desktop",
      glb,
      mind,
      startServer: openBrowser,
      openBrowser,
      openVSCode,
      textFile
    })
  });

  setResult("Proyecto MindAR creado", [
    ["Nombre", data.projectName],
    ["Ruta", data.projectPath],
    ["Tipo", "MindAR + Three.js + GLB + .mind"],
    ["Boton GLB", "Incluido"],
    ["Boton .mind", "Incluido"],
    ["GLB", data.assets?.glb?.ok ? `Copiado: ${data.assets.glb.fileName}` : data.assets?.glb?.warning || "Pendiente"],
    ["MIND", data.assets?.mind?.ok ? `Copiado: ${data.assets.mind.fileName}` : data.assets?.mind?.warning || "Pendiente"],
    ["Bloc de notas", data.textFile?.ok ? data.textFile.fileName : textFile ? data.textFile?.warning || "No confirmado" : "No solicitado"],
    ["VS Code", openVSCode ? (data.vscode?.ok ? "Abierto" : data.vscode?.warning || data.vscode?.method || "No confirmado") : "No solicitado"],
    ["Servidor", data.server?.url || `cd "${data.projectPath}" && npm start`],
    ["Navegador", data.browser?.ok || data.server?.browser?.ok ? "Abierto" : openBrowser ? "No confirmado" : "No solicitado"]
  ]);
  return `Cree ${data.projectName} como app MindAR, copie los assets disponibles y ${openBrowser ? "la abri en el navegador" : "la deje lista para ejecutar"}.`;
}
async function createARProjectFromCommand(raw, clean = normalizeCommand(raw)) {
  const status = await checkBridge();
  if (!status) {
    return bridgeOfflineMessage();
  }

  const projectName = parseProjectName(raw, clean);
  const openVSCode = wantsVSCode(clean) || clean.includes("workspace") || clean.includes("visual studio");
  const data = await bridgeFetch("/api/action", {
    method: "POST",
    body: JSON.stringify({
      action: "create-ar-project",
      name: projectName,
      location: "desktop",
      openVSCode,
      textFile
    })
  });

  setResult("Proyecto AR creado", [
    ["Nombre", data.projectName],
    ["Ruta", data.projectPath],
    ["VS Code", openVSCode ? (data.vscode?.ok ? "Abierto" : data.vscode?.warning || data.vscode?.method || "No confirmado") : "No solicitado"],
    ["Modelo", "Coloca tu GLB como assets/model.glb o seleccionalo en la app"],
    ["Servidor", `cd "${data.projectPath}" && npm start`],
    ["URL", "http://localhost:3000"]
  ]);
  return `Listo. Cree ${data.projectName} en tu Escritorio, genere la app WebAR con GLB e intente abrir Visual Studio Code en esa carpeta.`;
}

function likelyNeedsAgent(clean) {
  const taskVerbs = ["crea", "crear", "genera", "generar", "haz", "hacer", "construye", "construir", "prepara", "redacta", "escribe", "organiza", "busca", "investiga"];
  const complexTargets = ["documento", "word", "resume", "curriculum", "cv", "aplicacion", "app", "proyecto", "carpeta", "presentacion", "excel", "redes sociales", "internet", "documentos", "linkedin", "github"];
  return taskVerbs.some((verb) => clean.startsWith(verb) || clean.includes(` ${verb} `))
    && complexTargets.some((target) => clean.includes(target));
}

function parseAgentJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw.slice(raw.indexOf("{") >= 0 ? raw.indexOf("{") : 0, raw.lastIndexOf("}") >= 0 ? raw.lastIndexOf("}") + 1 : raw.length);
  return JSON.parse(candidate);
}

function planRows(plan) {
  const steps = Array.isArray(plan.steps) ? plan.steps.join(" | ") : "Sin pasos";
  const missing = Array.isArray(plan.missing) ? plan.missing.join(" | ") : (plan.missing || "Nada detectado");
  return [
    ["Objetivo", plan.goal || "No especificado"],
    ["Accion", plan.action || "plan-only"],
    ["Confianza", plan.confidence ? `${Math.round(Number(plan.confidence) * 100)}%` : "No indicada"],
    ["Pasos", steps],
    ["Falta", missing]
  ];
}

async function planWithGemini(raw, clean) {
  if (typeof hasAIKey !== "function" || typeof callGemini !== "function" || !hasAIKey()) return null;
  const prompt = `Eres el planificador de acciones de K.A.I. Convierte la orden del usuario en JSON estricto, sin markdown.

Acciones ejecutables actuales del puente local:
- create_folder: crea una carpeta en Escritorio o Documentos. Params: name, location.
- create_web_project: crea proyecto web basico. Params: name, location.
- create_ar_project: crea WebAR generico con GLB. Params: name, location.
- create_mindar_project: crea app MindAR + Three.js con boton GLB y boton .mind. Params: name, location.
- open_vscode: abre Visual Studio Code.
- plan_only: cuando no hay herramienta suficiente o faltan permisos/conectores.

Reglas:
- No inventes acceso a archivos, internet privado, redes sociales, email o cuentas. Si falta acceso, usa plan_only y explica missing.
- Si el usuario no da nombre explicito, usa un nombre corto razonable.
- location solo puede ser desktop o documents.
- Responde SOLO JSON valido con esta forma:
{"goal":"...","action":"create_mindar_project|create_ar_project|create_web_project|create_folder|open_vscode|plan_only","params":{"name":"...","location":"desktop|documents"},"steps":["..."],"missing":["..."],"confidence":0.0,"message":"..."}

Orden: ${raw}`;
  const answer = await callGemini(prompt, { maxTokens: 700 });
  const plan = parseAgentJson(answer);
  if (!plan || typeof plan !== "object") throw new Error("Gemini no devolvio un plan valido.");
  plan.params = plan.params || {};
  plan.params.location = plan.params.location === "documents" ? "documents" : "desktop";
  plan.params.name = cleanNameCandidate(plan.params.name) || inferDefaultProjectName(clean);
  return plan;
}

async function executeAgentPlan(plan) {
  if (!plan || plan.action === "plan_only") {
    setResult("Plan de K.A.I.", planRows(plan || { action: "plan_only", missing: ["No pude generar plan"] }), "PLAN");
    return plan?.message || "Puedo planificarlo, pero necesito mas capacidades o permisos antes de ejecutarlo.";
  }

  const status = await checkBridge();
  if (!status) return bridgeOfflineMessage();

  const bridgeAction = {
    create_folder: "create-folder",
    create_web_project: "create-web-project",
    create_ar_project: "create-ar-project",
    create_mindar_project: "create-mindar-project",
    open_vscode: "open-vscode"
  }[plan.action];

  if (!bridgeAction) {
    setResult("Plan de K.A.I.", planRows(plan), "PLAN");
    return plan.message || "Entendi la tarea, pero todavia no tengo una herramienta segura para ejecutarla.";
  }

  const body = plan.action === "open_vscode"
    ? { action: bridgeAction }
    : { action: bridgeAction, name: plan.params.name, location: plan.params.location, openVSCode: true };
  const data = await bridgeFetch("/api/action", { method: "POST", body: JSON.stringify(body) });
  const resultPath = data.projectPath || data.path || data.target || "No aplica";
  setResult("Agente K.A.I.", [
    ["Objetivo", plan.goal || "Ejecutar accion"],
    ["Accion", plan.action],
    ["Nombre", data.projectName || data.name || plan.params.name || "No aplica"],
    ["Ruta", resultPath],
    ["VS Code", data.vscode ? (data.vscode.ok ? "Abierto" : data.vscode.warning || data.vscode.method || "No confirmado") : "No solicitado"],
    ["Siguiente", Array.isArray(data.next) ? data.next.join(" | ") : (plan.message || "Listo")]
  ]);
  return plan.message || `Ejecute ${plan.action}.`;
}

async function agentRoute(raw, clean) {
  if (!likelyNeedsAgent(clean)) return null;
  try {
    const plan = await planWithGemini(raw, clean);
    if (!plan) {
      setResult("Modo Agente", [
        ["Estado", "IA no configurada"],
        ["Necesario", "Gemini API key en Nucleo IA"],
        ["Motivo", "Para entender ordenes abiertas necesito convertirlas en planes estructurados antes de ejecutar."]
      ], "WAIT");
      return "Para entender ordenes abiertas necesito activar Gemini en el Nucleo IA. Las habilidades directas siguen funcionando.";
    }
    return executeAgentPlan(plan);
  } catch (error) {
    setResult("Modo Agente", [["Error", error.message || "No pude crear el plan"]], "ERROR");
    return "No pude convertir esa orden en un plan ejecutable todavia.";
  }
}
async function bridgeStatusCommand() {
  const status = await checkBridge();
  if (!status) {
    setResult("Puente local", [["Estado", "OFFLINE"], ["Comando", "npm run bridge"], ["URL", BRIDGE_URL]], "WAIT");
    return "El puente local esta apagado. Ejecuta npm run bridge para darme acceso controlado al PC.";
  }
  setResult("Puente local", [
    ["Estado", "ONLINE"],
    ["Nombre", status.name],
    ["Puerto", String(status.port)],
    ["Desktop", status.desktop],
    ["Acciones", status.allowedActions.join(", ")],
    ["Idea", "No ejecuto cualquier comando: uso habilidades seguras que podemos ir ampliando."]
  ]);
  return "Puente local activo. Ya puedo ejecutar acciones reales permitidas en tu PC.";
}

window.routeCommand = async function routeBridgeCommands(raw, clean) {
  if (clean === "npm run bridge" || clean === "run bridge" || clean.includes("iniciar puente") || clean.includes("arrancar puente")) return bridgeStatusCommand();
  if (clean.includes("estado puente") || clean.includes("puente local") || clean.includes("conectar node") || clean.includes("acciones reales")) return bridgeStatusCommand();
  if (wantsVSCode(clean)) return openVSCodeFromCommand();
  if (wantsMindARProject(clean)) return createMindARProjectFromCommand(raw, clean);
  if (wantsARProject(clean)) return createARProjectFromCommand(raw, clean);
  if (wantsWebProject(clean)) return createWebProjectFromCommand(raw, clean);
  if (wantsFolder(clean)) return createFolderFromCommand(raw, clean);
  const agentAnswer = await agentRoute(raw, clean);
  if (agentAnswer) return agentAnswer;
  return bridgeBaseRoute(raw, clean);
};

installPrimaryConsole();
installBridgePanel();
checkBridge();
setInterval(checkBridge, 6000);
addLog("BRIDGE", "Cliente del puente local cargado. Node puede ejecutar acciones permitidas cuando npm run bridge este activo.");


















