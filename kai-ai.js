const aiControls = {
  keyInput: document.querySelector("#apiKeyInput"),
  modelInput: document.querySelector("#aiModelInput"),
  saveButton: document.querySelector("#saveApiKey"),
  testButton: document.querySelector("#testAI"),
  state: document.querySelector("#aiConfigState"),
  dashboardState: document.querySelector("#aiState"),
  dashboard: document.querySelector("#liveDashboard")
};

const aiKeys = {
  apiKey: "jarvis.gemini.apiKey.v1",
  model: "jarvis.gemini.model.v1",
  voice: "jarvis.voice.style.v1",
  missions: "jarvis.missions.v1",
  routines: "jarvis.routines.v1",
  lastFile: "jarvis.lastFile.summary.v1"
};

const baseRouteCommand = window.routeCommand;
const baseRunCommand = window.runCommand;
const SYSTEM_PROMPT = `Eres K.A.I., un asistente personal futurista en espanol. Responde con precision, estilo elegante y utilidad practica. Si el usuario pide construir algo, entrega pasos concretos y artefactos claros. No inventes acceso al computador; si una accion requiere Electron, dilo brevemente.`;

function hasAIKey() {
  return Boolean(readStore(aiKeys.apiKey, ""));
}

function getAIModel() {
  return readStore(aiKeys.model, "gemini-3.6-flash");
}

function saveAISettings() {
  const key = aiControls.keyInput?.value.trim();
  const model = aiControls.modelInput?.value.trim() || "gemini-3.6-flash";
  if (key) writeStore(aiKeys.apiKey, key);
  writeStore(aiKeys.model, model);
  if (aiControls.keyInput) aiControls.keyInput.value = "";
  updateAIStatus();
  setResult("Nucleo IA", [["API", hasAIKey() ? "Configurada" : "Sin clave"], ["Modelo", model], ["Nota", "La clave queda guardada en esta ventana/app. Si usas Electron, guardala tambien dentro de Electron."]]);
  complete(hasAIKey() ? "Nucleo IA configurado." : "Modelo guardado. Falta una API key para activar IA real.", "CONFIG");
}

function updateAIStatus() {
  const enabled = hasAIKey();
  const model = getAIModel();
  if (aiControls.state) aiControls.state.textContent = enabled ? "GEMINI" : "LOCAL";
  if (aiControls.dashboardState) aiControls.dashboardState.textContent = enabled ? "AI ON" : "AI OFF";
  if (aiControls.modelInput) aiControls.modelInput.value = model;
}

function setRichResult(title, content, state = "DONE") {
  resultState.textContent = state;
  resultPanel.innerHTML = "";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const block = document.createElement("pre");
  block.className = "result-pre";
  block.textContent = content;
  resultPanel.append(heading, block);
  try {
    localStorage.setItem("jarvis.live.result.v1", JSON.stringify({ title, text: content, state, updatedAt: new Date().toISOString() }));
    if (window.jarvisHudChannel) window.jarvisHudChannel.postMessage({ type: "result" });
  } catch {}
}

function extractResponseText(data) {
  const parts = [];
  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.text) parts.push(part.text);
    }
  }
  return parts.join("\n").trim() || "Gemini respondio sin texto visible.";
}

async function callGemini(userText, options = {}) {
  const apiKey = readStore(aiKeys.apiKey, "");
  if (!apiKey) throw new Error("Configura una Gemini API key primero. Pegala en el panel Nucleo IA y pulsa KEY.");
  const voiceMode = readStore(aiKeys.voice, "normal");
  const styleLine = voiceMode === "corta" ? "Responde breve y directo." : voiceMode === "larga" ? "Responde con mas detalle, estructura y pasos." : "Manten una voz natural, precisa y elegante.";
  const model = encodeURIComponent(getAIModel());
  const body = {
    system_instruction: {
      parts: [{ text: `${options.system || SYSTEM_PROMPT}\n${styleLine}` }]
    },
    contents: [
      { role: "user", parts: [{ text: userText }] }
    ],
    generationConfig: {
      maxOutputTokens: options.maxTokens || 900
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error?.message || `Error HTTP ${response.status}`;
    if (/quota|billing|plan|permission|api key/i.test(detail)) {
      throw new Error("Gemini no tiene cuota o permiso disponible con esa API key. El puente local Node sigue funcionando para acciones del PC; usa comandos como estado puente local, crear carpeta, crear proyecto web o crear proyecto ar. Revisa la key/cuota en Google AI Studio.");
    }
    throw new Error(`Gemini no respondio correctamente: ${detail}`);
  }
  return extractResponseText(data);
}

async function aiChat(raw) {
  busy("AI");
  const text = payload(raw, ["ia", "jarvis", "pregunta", "responde"] ) || raw;
  const context = buildMemoryContext();
  const answer = await callGemini(`${context}\n\nUsuario: ${text}`, { maxTokens: 850 });
  setRichResult("Conversacion IA", answer);
  return answer;
}

function buildMemoryContext() {
  const memoryItems = readStore(jarvisKeys.memory, {});
  const notes = readStore(jarvisKeys.notes, []).slice(-5).map((note) => note.text);
  const tasksSaved = readStore(jarvisKeys.tasks, []).filter((task) => !task.done).slice(0, 8).map((task) => task.text);
  return [
    "Contexto local de K.A.I.:",
    `Memoria: ${JSON.stringify(memoryItems)}`,
    `Notas recientes: ${JSON.stringify(notes)}`,
    `Tareas pendientes: ${JSON.stringify(tasksSaved)}`
  ].join("\n");
}

async function research(raw) {
  const topic = payload(raw, ["investiga", "investigar", "research"]);
  if (!topic) throw new Error("Dime que investigar. Ejemplo: investiga mejores practicas de JavaScript moderno.");
  if (!hasAIKey()) {
    openExternal(`https://www.google.com/search?q=${encodeURIComponent(topic)}`);
    return wikipedia(`wiki ${topic}`, `wiki ${normalizeCommand(topic)}`);
  }
  const prompt = `Investiga este tema con web si esta disponible: ${topic}\nEntrega: resumen ejecutivo, datos clave, oportunidades, riesgos y siguientes pasos.`;
  const answer = await callGemini(prompt, { web: true, maxTokens: 1200 });
  setRichResult("Investigacion", answer);
  return `Investigacion lista sobre ${topic}.`;
}

async function explain(raw) {
  const topic = payload(raw, ["explica", "explicame", "ensename"]);
  if (!topic) throw new Error("Dime que quieres que explique.");
  if (!hasAIKey()) {
    setResult("Explicacion local", [["Tema", topic], ["Siguiente", "Activa IA para una explicacion profunda o usa wiki tema."]]);
    return `Puedo explicarlo mejor con IA activada. Por ahora prueba: wiki ${topic}.`;
  }
  const answer = await callGemini(`Explica de forma clara, con ejemplo y plan de practica: ${topic}`, { maxTokens: 1000 });
  setRichResult("Explicacion", answer);
  return answer;
}

async function builder(raw, clean) {
  const request = payload(raw, ["construye", "construir", "crear", "genera", "generar", "haz"]);
  if (!request) throw new Error("Dime que quieres construir. Ejemplo: construye una landing para un curso AR.");
  const system = `${SYSTEM_PROMPT}\nActua como arquitecto de producto y generador. Devuelve un entregable util: estructura, contenido, codigo o checklist segun corresponda.`;
  if (hasAIKey()) {
    const answer = await callGemini(`Construye esto para mi: ${request}`, { system, maxTokens: 1400 });
    setRichResult("Constructor", answer);
    return `Constructor listo para: ${request}.`;
  }
  const fallback = [
    `Objetivo: ${request}`,
    "1. Definir resultado exacto y usuario final.",
    "2. Crear estructura base con secciones, datos y acciones.",
    "3. Implementar un prototipo HTML/CSS/JS.",
    "4. Validar visualmente, corregir flujo y documentar uso.",
    "Activa IA para que K.A.I. genere contenido o codigo mas completo."
  ].join("\n");
  setRichResult("Constructor local", fallback);
  return "Prepare un plan de construccion local. Con IA activada puedo generar el artefacto completo.";
}

async function planDay() {
  const tasksSaved = readStore(jarvisKeys.tasks, []).filter((task) => !task.done).map((task) => task.text);
  const notes = readStore(jarvisKeys.notes, []).slice(-6).map((note) => note.text);
  const prompt = `Planifica mi dia con bloques realistas. Tareas: ${JSON.stringify(tasksSaved)}. Notas: ${JSON.stringify(notes)}. Incluye prioridades, horarios sugeridos y primer paso.`;
  if (hasAIKey()) {
    const answer = await callGemini(prompt, { maxTokens: 900 });
    setRichResult("Plan del dia", answer);
    return "Plan del dia generado.";
  }
  const rows = tasksSaved.length ? tasksSaved.slice(0, 5).map((task, index) => [`Prioridad ${index + 1}`, task]) : ["No hay tareas guardadas. Agrega tareas para planificar mejor."];
  setResult("Plan local", rows);
  return tasksSaved.length ? "Plan local creado con tus tareas pendientes." : "No tengo tareas guardadas para planificar.";
}
async function createMission(raw) {
  const objective = payload(raw, ["nueva mision", "crear mision", "mision nueva", "mision"]);
  if (!objective) throw new Error("Dime la mision. Ejemplo: nueva mision crear una demo de K.A.I.");
  let steps = [
    "Definir resultado esperado",
    "Reunir informacion necesaria",
    "Construir primera version",
    "Probar y corregir",
    "Registrar siguiente accion"
  ];
  if (hasAIKey()) {
    const answer = await callGemini(`Convierte esta mision en 5 a 7 pasos accionables, solo lista breve: ${objective}`, { maxTokens: 500 });
    steps = answer.split(/\n+/).map((line) => line.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean).slice(0, 7);
  }
  const missions = readStore(aiKeys.missions, []);
  const mission = { id: Date.now(), objective, steps, current: 0, done: false, createdAt: new Date().toISOString() };
  missions.unshift(mission);
  writeStore(aiKeys.missions, missions);
  renderMission(mission);
  updateAdvancedDashboard();
  return `Mision creada: ${objective}. Primer paso: ${steps[0]}.`;
}

function missionStatus() {
  const missions = readStore(aiKeys.missions, []);
  const active = missions.find((mission) => !mission.done);
  if (!active) {
    setResult("Misiones", ["No hay misiones activas."]);
    return "No hay misiones activas.";
  }
  renderMission(active);
  return `Mision activa: ${active.objective}. Paso actual: ${active.steps[active.current] || "finalizar"}.`;
}

function listMissions() {
  const missions = readStore(aiKeys.missions, []);
  setResult("Misiones", missions.length ? missions.map((mission, index) => [`${index + 1}. ${mission.done ? "OK" : "ACTIVA"}`, mission.objective]) : ["No hay misiones guardadas."]);
  return missions.length ? `Tienes ${missions.filter((mission) => !mission.done).length} misiones activas.` : "No hay misiones guardadas.";
}

function advanceMission() {
  const missions = readStore(aiKeys.missions, []);
  const active = missions.find((mission) => !mission.done);
  if (!active) throw new Error("No hay una mision activa para avanzar.");
  active.current += 1;
  if (active.current >= active.steps.length) active.done = true;
  writeStore(aiKeys.missions, missions);
  renderMission(active);
  updateAdvancedDashboard();
  return active.done ? `Mision completada: ${active.objective}.` : `Avance registrado. Siguiente paso: ${active.steps[active.current]}.`;
}

function closeMission() {
  const missions = readStore(aiKeys.missions, []);
  const active = missions.find((mission) => !mission.done);
  if (!active) throw new Error("No hay una mision activa para cerrar.");
  active.done = true;
  writeStore(aiKeys.missions, missions);
  renderMission(active);
  updateAdvancedDashboard();
  return `Mision cerrada: ${active.objective}.`;
}

function renderMission(mission) {
  const rows = [["Objetivo", mission.objective], ["Estado", mission.done ? "Completada" : "Activa"]];
  mission.steps.forEach((step, index) => {
    const state = mission.done || index < mission.current ? "OK" : index === mission.current ? "AHORA" : "PEND";
    rows.push([state, step]);
  });
  setResult("Modo Mision", rows);
  missionState.textContent = mission.done ? "DONE" : "MISSION";
}

function routine(raw, clean) {
  const name = payload(raw, ["rutina", "activar rutina"] ) || "trabajo";
  const routines = {
    manana: ["Revisar clima", "Ver tareas", "Planificar el dia", "Activar modo enfoque"],
    mañana: ["Revisar clima", "Ver tareas", "Planificar el dia", "Activar modo enfoque"],
    trabajo: ["Ver tareas", "Crear bloque de enfoque", "Abrir herramientas clave", "Registrar objetivo del dia"],
    estudio: ["Elegir tema", "Bloque de 45 minutos", "Crear resumen", "Guardar dudas"],
    noche: ["Cerrar tareas", "Guardar aprendizajes", "Preparar prioridad de manana"]
  };
  const selected = routines[normalizeCommand(name)] || routines.trabajo;
  writeStore(aiKeys.routines, { last: name, steps: selected, activatedAt: new Date().toISOString() });
  setMode(name.includes("estudio") || name.includes("trabajo") ? "focus" : "command");
  setResult(`Rutina ${name}`, selected.map((step, index) => [`${index + 1}`, step]));
  return `Rutina ${name} activada. Primer paso: ${selected[0]}.`;
}

function focusBlock(raw, clean) {
  const match = clean.match(/(\d+)/);
  const minutes = match ? Number(match[1]) : 45;
  setMode("focus");
  timer(`temporizador ${minutes} minutos`, `temporizador ${minutes} minutos`);
  setResult("Bloque de enfoque", [["Duracion", `${minutes} minutos`], ["Modo", "FOCUS"], ["Regla", "Una tarea, cero distracciones, cierre con nota."]]);
  return `Modo enfoque activado por ${minutes} minutos.`;
}

function stopVoicePlayback() {
  const stopped = typeof window.stopJarvisSpeech === "function" ? window.stopJarvisSpeech() : false;
  window.jarvisSkipNextSpeech = true;
  setResult("Audio", [["Lectura", stopped ? "Detenida" : "Sin audio activo"], ["Audio futuro", muted ? "Silenciado" : "Activo"]]);
  return stopped ? "Audio detenido." : "No habia audio reproduciendose.";
}

function wantsStopAudio(clean) {
  return /^(para|parar|deten|detener|corta|cortar|cancelar)\s+(el\s+)?(audio|voz|lectura)/.test(clean)
    || clean.includes("callate")
    || clean.includes("deja de hablar")
    || clean.includes("para de hablar")
    || clean.includes("deten la respuesta");
}
function voiceStyle(raw, clean) {
  let style = "normal";
  if (clean.includes("corta") || clean.includes("breve")) style = "corta";
  if (clean.includes("larga") || clean.includes("detallada")) style = "larga";
  if (clean.includes("silencio") || clean.includes("mudo")) {
    muted = true;
    if (typeof window.stopJarvisSpeech === "function") window.stopJarvisSpeech();
    if (typeof window.updateJarvisAudioButton === "function") window.updateJarvisAudioButton();
    style = "silencio";
  }
  if (clean.includes("audio") || clean.includes("habla")) {
    muted = false;
    if (typeof window.updateJarvisAudioButton === "function") window.updateJarvisAudioButton();
  }
  writeStore(aiKeys.voice, style);
  setResult("Voz", [["Estilo", style], ["Audio", muted ? "Silenciado" : "Activo"]]);
  return `Estilo de voz ajustado: ${style}.`;
}

async function smartFileRequest(raw, clean) {
  actionState.pendingFile = false;
  window.jarvisPendingSmartFile = clean.includes("tarea") ? "tasks" : hasAIKey() ? "ai" : "stats";
  fileInput.value = "";
  fileInput.click();
  setResult("Archivo inteligente", ["Selecciona un archivo. K.A.I. extraera resumen, tareas o metricas segun el comando."], "WAIT");
  return "Selecciona el archivo para analisis inteligente.";
}

async function smartAnalyzeFile(file) {
  if (!file) return;
  busy("FILE");
  const text = await file.text();
  const mode = window.jarvisPendingSmartFile || "stats";
  window.jarvisPendingSmartFile = null;
  if (mode === "tasks") {
    const extracted = hasAIKey() ? await callGemini(`Extrae tareas accionables de este archivo. Devuelve lista breve:\n\n${text.slice(0, 12000)}`, { maxTokens: 700 }) : localTaskExtraction(text);
    setRichResult("Tareas del archivo", extracted);
    complete("Extraje tareas del archivo seleccionado.", "ARCHIVO");
    return;
  }
  if (mode === "ai") {
    const answer = await callGemini(`Analiza este archivo. Entrega resumen, puntos clave, riesgos, tareas y recomendaciones:\n\n${text.slice(0, 16000)}`, { maxTokens: 1200 });
    writeStore(aiKeys.lastFile, { name: file.name, summary: answer, createdAt: new Date().toISOString() });
    setRichResult("Analisis IA de archivo", answer);
    complete(`Analisis inteligente listo para ${file.name}.`, "ARCHIVO");
    return;
  }
  await analyzeSelectedFile(file);
}

function localTaskExtraction(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = lines.filter((line) => /(todo|tarea|hacer|pendiente|fix|crear|agregar|implementar|revisar)/i.test(line)).slice(0, 12);
  return candidates.length ? candidates.map((line, index) => `${index + 1}. ${line}`).join("\n") : "No encontre tareas obvias. Activa IA para una extraccion semantica mejor.";
}

function dashboardCommand() {
  updateAdvancedDashboard();
  setResult("Dashboard vivo", collectDashboardRows());
  return "Dashboard actualizado con estado vivo de IA, memoria, tareas, notas, misiones y temporizadores.";
}

function collectDashboardRows() {
  const notes = readStore(jarvisKeys.notes, []);
  const tasksSaved = readStore(jarvisKeys.tasks, []);
  const missions = readStore(aiKeys.missions, []);
  const timersLive = actionState.timers.filter((item) => item.endsAt > Date.now());
  return [
    ["IA", hasAIKey() ? `Gemini ${getAIModel()}` : "Local sin API"],
    ["Notas", String(notes.length)],
    ["Tareas pendientes", String(tasksSaved.filter((task) => !task.done).length)],
    ["Misiones activas", String(missions.filter((mission) => !mission.done).length)],
    ["Timers", String(timersLive.length)],
    ["Conexion", navigator.onLine ? "Online" : "Offline"]
  ];
}

function updateAdvancedDashboard() {
  updateAIStatus();
  if (!aiControls.dashboard) return;
  const rows = collectDashboardRows();
  aiControls.dashboard.innerHTML = "";
  rows.slice(0, 6).forEach(([label, value]) => {
    const item = document.createElement("div");
    const key = document.createElement("span");
    const val = document.createElement("strong");
    key.textContent = label;
    val.textContent = value;
    item.append(key, val);
    aiControls.dashboard.appendChild(item);
  });
}
async function advancedHelp() {
  setResult("K.A.I. avanzado", [
    ["IA", "pega API key en Nucleo IA, prueba ia, ia preguntame algo"],
    ["Investigacion", "investiga tendencias de realidad aumentada"],
    ["Explicar", "explica closures en JavaScript"],
    ["Constructor", "construye una landing para mi curso"],
    ["Misiones", "nueva mision crear demo, mision estado, avanzar mision, cerrar mision"],
    ["Rutinas", "rutina manana, rutina trabajo, rutina estudio, enfoque 45"],
    ["Archivos", "analizar archivo con ia, extraer tareas de archivo"],
    ["Dashboard", "dashboard, planifica mi dia, voz corta, voz larga, silencio"],
    ["Modo agente", "ordenes abiertas con Gemini: crea..., prepara..., redacta...; ejecuta si hay herramienta o muestra permisos faltantes"]
  ]);
  return "Modo K.A.I. avanzado cargado: IA conversacional, modo agente, investigacion, constructor, misiones, rutinas, voz, dashboard y analisis inteligente.";
}

async function testAIConnection() {
  const answer = await callGemini("Responde en una frase corta confirmando que el nucleo K.A.I. esta conectado.", { maxTokens: 80 });
  setRichResult("Prueba IA", answer);
  return answer;
}

async function advancedRoute(raw, clean) {
  const noWake = clean.replace(/^jarvis[,\s]*/, "").trim();
  const normalizedRaw = clean.startsWith("jarvis") ? raw.replace(/^jarvis[,\s]*/i, "") : raw;
  const normalizedClean = clean.startsWith("jarvis") ? noWake : clean;

  if (wantsStopAudio(normalizedClean)) return stopVoicePlayback();
  if (normalizedClean.includes("ayuda avanzada") || normalizedClean === "ayuda" || normalizedClean === "comandos") return advancedHelp();
  if (normalizedClean.startsWith("api key ") || normalizedClean.startsWith("gemini key ")) {
    const lowerRaw = raw.toLowerCase();
    const keyStart = lowerRaw.includes("gemini key") ? lowerRaw.indexOf("gemini key") + 10 : lowerRaw.indexOf("api key") + 7;
    const key = raw.slice(keyStart).trim();
    if (!key) throw new Error("Pega una API key despues de: api key.");
    writeStore(aiKeys.apiKey, key);
    updateAIStatus();
    setResult("Nucleo IA", [["API", "Configurada"], ["Modelo", getAIModel()], ["Seguridad", "Guardada solo en esta ventana/app"]]);
    return "API key guardada localmente. IA real activada.";
  }
  if (normalizedClean.includes("borrar api") || normalizedClean.includes("eliminar api") || normalizedClean.includes("borrar gemini")) {
    localStorage.removeItem(aiKeys.apiKey);
    updateAIStatus();
    setResult("Nucleo IA", [["API", "Eliminada"]]);
    return "API key eliminada del navegador.";
  }
  if (normalizedClean.startsWith("modelo ia")) {
    const model = payload(normalizedRaw, ["modelo ia"]);
    if (!model) throw new Error("Indica el modelo. Ejemplo: modelo ia gemini-3.6-flash.");
    writeStore(aiKeys.model, model);
    updateAIStatus();
    setResult("Modelo IA", [["Modelo", model]]);
    return `Modelo actualizado a ${model}.`;
  }
  if (normalizedClean.includes("probar ia") || normalizedClean === "test ia") return testAIConnection();
  if (normalizedClean.startsWith("ia") || normalizedClean.startsWith("pregunta") || clean.startsWith("jarvis")) return aiChat(normalizedRaw);
  if (normalizedClean.startsWith("investiga") || normalizedClean.startsWith("investigar") || normalizedClean.startsWith("research")) return research(normalizedRaw);
  if (normalizedClean.startsWith("explica") || normalizedClean.startsWith("explicame") || normalizedClean.startsWith("ensename")) return explain(normalizedRaw);
  if (normalizedClean.startsWith("construye") || normalizedClean.startsWith("construir") || normalizedClean.startsWith("genera") || normalizedClean.startsWith("generar") || normalizedClean.startsWith("haz")) return builder(normalizedRaw, normalizedClean);
  if (normalizedClean.includes("planifica mi dia") || normalizedClean.includes("plan del dia")) return planDay();
  if (normalizedClean.startsWith("nueva mision") || normalizedClean.startsWith("crear mision") || normalizedClean.startsWith("mision nueva")) return createMission(normalizedRaw);
  if (normalizedClean === "mision" || normalizedClean.includes("mision estado")) return missionStatus();
  if (normalizedClean === "misiones" || normalizedClean.includes("listar misiones")) return listMissions();
  if (normalizedClean.includes("avanzar mision") || normalizedClean.includes("siguiente paso")) return advanceMission();
  if (normalizedClean.includes("cerrar mision") || normalizedClean.includes("completar mision")) return closeMission();
  if (normalizedClean.startsWith("rutina") || normalizedClean.startsWith("activar rutina")) return routine(normalizedRaw, normalizedClean);
  if (normalizedClean.startsWith("enfoque") || normalizedClean.startsWith("modo enfoque ")) return focusBlock(normalizedRaw, normalizedClean);
  if (normalizedClean.startsWith("voz") || normalizedClean.includes("silencio") || normalizedClean.includes("respuesta corta") || normalizedClean.includes("respuesta larga")) return voiceStyle(normalizedRaw, normalizedClean);
  if (normalizedClean.includes("analizar archivo con ia") || normalizedClean.includes("extraer tareas de archivo") || normalizedClean.includes("archivo inteligente")) return smartFileRequest(normalizedRaw, normalizedClean);
  if (normalizedClean === "dashboard" || normalizedClean.includes("panel vivo")) return dashboardCommand();

  const baseAnswer = await baseRouteCommand(normalizedRaw, normalizedClean);
  if (hasAIKey() && /^No tengo ese protocolo/.test(baseAnswer)) {
    try {
      return await aiChat(normalizedRaw);
    } catch (error) {
      if (/cuota|quota|billing|plan|Gemini/i.test(error.message)) return error.message;
      throw error;
    }
  }
  return baseAnswer;
}

window.routeCommand = advancedRoute;
window.runCommand = async function upgradedRunCommand(rawCommand) {
  const clean = normalizeCommand(rawCommand);
  if (!clean) return;
  addLog("COMANDO", rawCommand);
  busy();
  try {
    const answer = await window.routeCommand(rawCommand, clean);
    complete(answer);
  } catch (error) {
    const answer = error instanceof Error ? error.message : "No pude completar esa accion.";
    setResult("Error", [answer], "ERROR");
    complete(answer, "ERROR");
  } finally {
    commandInput.value = "";
  }
};

if (aiControls.saveButton) aiControls.saveButton.addEventListener("click", saveAISettings);
if (aiControls.testButton) aiControls.testButton.addEventListener("click", () => window.runCommand("probar ia"));
if (aiControls.modelInput) aiControls.modelInput.value = getAIModel();
if (fileInput) {
  fileInput.addEventListener("change", () => {
    if (window.jarvisPendingSmartFile) smartAnalyzeFile(fileInput.files[0]);
  });
}

updateAdvancedDashboard();
setInterval(updateAdvancedDashboard, 3000);
addLog("K.A.I.+", "Capa avanzada lista: IA, investigacion, constructor, misiones, rutinas, voz y dashboard.");












