const resultPanel = document.querySelector("#resultPanel");
const resultState = document.querySelector("#resultState");
const fileInput = document.querySelector("#fileInput");
const actionState = {
  history: [],
  lastAnswer: "",
  pendingFile: false,
  timers: []
};

const jarvisKeys = {
  notes: "jarvis.notes.v3",
  tasks: "jarvis.tasks.v3",
  memory: "jarvis.memory.v3"
};

const shortcuts = {
  google: "https://www.google.com",
  youtube: "https://www.youtube.com",
  gmail: "https://mail.google.com",
  github: "https://github.com",
  drive: "https://drive.google.com",
  calendario: "https://calendar.google.com",
  gemini: "https://gemini.google.com",
  whatsapp: "https://web.whatsapp.com",
  maps: "https://maps.google.com"
};

const weatherText = {
  0: "cielo despejado",
  1: "principalmente despejado",
  2: "parcialmente nublado",
  3: "nublado",
  45: "niebla",
  48: "niebla con escarcha",
  51: "llovizna ligera",
  53: "llovizna moderada",
  55: "llovizna densa",
  61: "lluvia ligera",
  63: "lluvia moderada",
  65: "lluvia fuerte",
  80: "chubascos ligeros",
  81: "chubascos moderados",
  82: "chubascos violentos",
  95: "tormenta"
};

function addLog(title, message) {
  logIndex += 1;
  const entry = document.createElement("div");
  const label = document.createElement("strong");
  const body = document.createElement("span");
  entry.className = "log-entry";
  label.textContent = `${String(logIndex).padStart(2, "0")} // ${title}`;
  body.textContent = String(message);
  entry.append(label, body);
  terminalLog.prepend(entry);
  logCount.textContent = String(logIndex);
  actionState.history.push({ time: new Date().toISOString(), title, message: String(message) });
  try {
    localStorage.setItem("jarvis.live.log.v1", JSON.stringify(actionState.history.slice(-80)));
    if (window.jarvisHudChannel) window.jarvisHudChannel.postMessage({ type: "log" });
  } catch {}
  targetVoiceEnergy = Math.min(1, targetVoiceEnergy + 0.28);
}

function normalizeCommand(raw) {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function readStore(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function payload(raw, variants) {
  const clean = normalizeCommand(raw);
  const hit = variants.find((item) => clean.startsWith(normalizeCommand(item)));
  return hit ? raw.slice(hit.length).replace(/^[:=,-]+/, "").trim() : "";
}

function setResult(title, rows, state = "DONE") {
  if (!resultPanel) return;
  resultState.textContent = state;
  resultPanel.innerHTML = "";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const list = document.createElement("div");
  list.className = "result-list";
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "result-row";
    if (Array.isArray(row)) {
      const key = document.createElement("span");
      const value = document.createElement("strong");
      key.textContent = row[0];
      value.textContent = row[1];
      item.append(key, value);
    } else {
      item.textContent = row;
    }
    list.appendChild(item);
  });
  resultPanel.append(heading, list);
  try {
    const text = rows.map((row) => Array.isArray(row) ? `${row[0]}: ${row[1]}` : row).join("\n");
    localStorage.setItem("jarvis.live.result.v1", JSON.stringify({ title, text, state, updatedAt: new Date().toISOString() }));
    if (window.jarvisHudChannel) window.jarvisHudChannel.postMessage({ type: "result" });
  } catch {}
}

function busy(state = "RUN") {
  statusLabel.textContent = "THINKING";
  missionState.textContent = "RUNNING";
  if (resultState) resultState.textContent = state;
  targetVoiceEnergy = 0.78;
}

function complete(message, title = "K.A.I.") {
  actionState.lastAnswer = message;
  coreCaption.textContent = message;
  missionState.textContent = "EXECUTED";
  statusLabel.textContent = "ONLINE";
  addLog(title, message);
  if (window.jarvisSkipNextSpeech) {
    window.jarvisSkipNextSpeech = false;
    return;
  }
  speak(message);
}

function openExternal(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function ensureProtocol(text) {
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

async function runCommand(rawCommand) {
  const clean = normalizeCommand(rawCommand);
  if (!clean) return;
  addLog("COMANDO", rawCommand);
  busy();
  try {
    const answer = await routeCommand(rawCommand, clean);
    complete(answer);
  } catch (error) {
    const answer = error instanceof Error ? error.message : "No pude completar esa accion.";
    setResult("Error", [answer], "ERROR");
    complete(answer, "ERROR");
  } finally {
    commandInput.value = "";
  }
}

async function routeCommand(raw, clean) {
  if (clean.includes("menu") || clean.includes("opciones") || clean.includes("paneles")) return menuCommand(clean);
  if (["ayuda", "comandos", "que puedes hacer"].some((item) => clean.includes(item))) return showHelp();
  if (["hola", "saludo", "buenas"].some((item) => clean.includes(item))) return sayHello();
  if (clean === "limpiar" || clean === "clear" || clean === "borrar") return clearLog();
  if (clean.includes("diagnostico") || clean === "estado") return diagnostic();
  if (clean.includes("hora") || clean === "tiempo") return currentTime();
  if (clean.includes("fecha")) return currentDate();
  if (clean.includes("modo enfoque") || clean.includes("focus")) return visualMode("focus");
  if (clean.includes("modo escaneo") || clean.includes("scan") || clean.includes("escanear")) return visualMode("scan");
  if (clean.includes("modo comando") || clean.includes("command")) return visualMode("command");
  if (clean.includes("sistema") || clean.includes("equipo") || clean.includes("navegador")) return systemInfo();
  if (clean.includes("internet") || clean.includes("conexion") || clean.includes("red")) return networkInfo();
  if (clean.startsWith("clima")) return weather(raw);
  if (clean.startsWith("wiki") || clean.startsWith("wikipedia") || clean.startsWith("que es") || clean.startsWith("quien es")) return wikipedia(raw, clean);
  if (clean.startsWith("buscar") || clean.startsWith("busca")) return webSearch(raw);
  if (clean.startsWith("abrir") || clean.startsWith("abre")) return openSite(raw);
  if (clean.startsWith("calcula") || clean.startsWith("calcular") || clean.startsWith("cuanto es")) return calculate(raw);
  if (clean.startsWith("nota") || clean.startsWith("guardar nota") || clean === "notas") return notes(raw, clean);
  if (clean.startsWith("tarea") || clean.startsWith("crear tarea") || clean.startsWith("agregar tarea") || clean === "tareas") return tasks(raw, clean);
  if (clean.startsWith("recuerda") || clean.startsWith("recordar") || clean.includes("que recuerdas") || clean === "memoria") return memory(raw, clean);
  if (clean.startsWith("temporizador") || clean.startsWith("timer") || clean.startsWith("alarma")) return timer(raw, clean);
  if (clean.includes("leer archivo") || clean.includes("analizar archivo") || clean.includes("archivo")) return requestFile();
  if (clean.includes("exportar bitacora")) return exportLog();
  if (clean.includes("copiar respuesta")) return copyLastAnswer();
  setResult("Comando no reconocido", ["Prueba: ayuda, clima Bogota, wiki Nikola Tesla, calcula 18*7, nota guardar idea, tarea agregar comprar bateria, leer archivo."]);
  return "No tengo ese protocolo exacto todavia. Escribe ayuda para ver los comandos reales disponibles.";
}

function menuCommand(clean) {
  const shouldClose = clean.includes("oculta") || clean.includes("cerrar") || clean.includes("cierra") || clean.includes("esconde");
  const open = !shouldClose;
  if (typeof window.setJarvisMenuOpen === "function") window.setJarvisMenuOpen(open);
  setResult(open ? "Menu K.A.I." : "Menu oculto", [
    open ? "Paneles de opciones desplegados." : "Paneles de opciones ocultos.",
    "Puedes decir: muestrame todas sus opciones, abrir menu, ocultar menu."
  ]);
  return open ? "Menu desplegado con todas mis opciones." : "Menu oculto. Cabina limpia.";
}
function showHelp() {
  setResult("Comandos reales", [
    ["Datos", "sistema, internet, clima Bogota, wiki Tesla"],
    ["Acciones", "abrir youtube, buscar curso JavaScript"],
    ["Productividad", "nota guardar texto, notas, tarea agregar texto, tareas"],
    ["Utilidades", "calcula 18*(7+3), temporizador 5 minutos, leer archivo"],
    ["Memoria", "recuerda que proyecto = KAI, memoria"],
    ["Interfaz", "modo enfoque, modo escaneo, modo comando, limpiar"]
  ]);
  return "Puedo mostrar datos del sistema, consultar clima y Wikipedia, abrir sitios, buscar en la web, guardar notas, manejar tareas, calcular, temporizar y analizar archivos de texto.";
}

function sayHello() {
  setResult("Saludo", ["Interfaz K.A.I. activa.", "Estoy listo para datos, archivos, notas, tareas, clima, busquedas y comandos locales."]);
  return "Hola. Ya tengo protocolos reales activos. Puedes pedirme clima, wiki, sistema, notas, tareas, calculos o analizar archivos.";
}

function clearLog() {
  terminalLog.innerHTML = "";
  logIndex = 0;
  logCount.textContent = "0";
  actionState.history = [];
  setResult("Bitacora", ["Bitacora despejada."]);
  return "Bitacora despejada.";
}

function diagnostic() {
  const notesCount = readStore(jarvisKeys.notes, []).length;
  const allTasks = readStore(jarvisKeys.tasks, []);
  const memoryCount = Object.keys(readStore(jarvisKeys.memory, {})).length;
  setResult("Diagnostico operativo", [
    ["Voz", SpeechRecognition ? "Disponible" : "No disponible en este navegador"],
    ["Sintesis", synth ? "Disponible" : "No disponible"],
    ["Conexion", navigator.onLine ? "Online" : "Offline"],
    ["Notas", String(notesCount)],
    ["Tareas", `${allTasks.filter((task) => !task.done).length} pendientes de ${allTasks.length}`],
    ["Memoria", `${memoryCount} registros`]
  ]);
  return "Diagnostico completado. Ya tengo voz, almacenamiento local, acciones de red, archivos y utilidades listas segun permisos del navegador.";
}

function currentTime() {
  const value = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  setResult("Hora actual", [["Local", value], ["Zona", Intl.DateTimeFormat().resolvedOptions().timeZone || "No disponible"]]);
  return `Son las ${value}.`;
}

function currentDate() {
  const value = new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  setResult("Fecha actual", [["Hoy", value]]);
  return `Hoy es ${value}.`;
}

function visualMode(mode) {
  setMode(mode);
  const labels = { focus: "Modo enfoque activado.", scan: "Modo escaneo activado.", command: "Modo comando restaurado." };
  setResult("Modo visual", [["Activo", mode.toUpperCase()], ["Estado", labels[mode]]]);
  return labels[mode];
}
async function systemInfo() {
  const battery = await batteryInfo();
  setResult("Datos del navegador", [
    ["Plataforma", navigator.platform || "No disponible"],
    ["Idioma", navigator.language || "No disponible"],
    ["CPU logica", navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} nucleos` : "No disponible"],
    ["Memoria estimada", navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "No disponible"],
    ["Pantalla", `${screen.width} x ${screen.height}`],
    ["Ventana", `${window.innerWidth} x ${window.innerHeight}`],
    ["Bateria", battery],
    ["Agente", navigator.userAgent.slice(0, 96)]
  ]);
  return "Datos reales del entorno cargados: pantalla, navegador, procesador logico, memoria aproximada y bateria si el navegador la permite.";
}

async function batteryInfo() {
  if (!navigator.getBattery) return "No disponible";
  try {
    const battery = await navigator.getBattery();
    return `${Math.round(battery.level * 100)}% ${battery.charging ? "cargando" : "sin cargar"}`;
  } catch {
    return "No disponible";
  }
}

function networkInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  setResult("Conexion", [
    ["Estado", navigator.onLine ? "Online" : "Offline"],
    ["Tipo", connection?.effectiveType || "No disponible"],
    ["Descarga estimada", connection?.downlink ? `${connection.downlink} Mbps` : "No disponible"],
    ["Latencia", connection?.rtt ? `${connection.rtt} ms` : "No disponible"],
    ["Ahorro de datos", connection?.saveData ? "Activo" : "No activo o no disponible"]
  ]);
  return navigator.onLine ? "Conexion activa. Puedo intentar consultas online como clima, Wikipedia y busquedas." : "El navegador reporta que estas offline.";
}

async function weather(raw) {
  const city = payload(raw, ["clima", "clima en", "weather"]);
  const place = city ? await geocode(city) : await currentPosition();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("No pude consultar el clima en Open-Meteo.");
  const data = await response.json();
  const current = data.current;
  const description = weatherText[current.weather_code] || "condicion no clasificada";
  setResult("Clima actual", [
    ["Lugar", place.name],
    ["Temperatura", `${current.temperature_2m} C`],
    ["Sensacion", `${current.apparent_temperature} C`],
    ["Humedad", `${current.relative_humidity_2m}%`],
    ["Viento", `${current.wind_speed_10m} km/h`],
    ["Condicion", description]
  ]);
  return `Clima en ${place.name}: ${current.temperature_2m} grados, ${description}, humedad ${current.relative_humidity_2m} por ciento.`;
}

async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("No pude buscar esa ciudad.");
  const data = await response.json();
  const place = data.results?.[0];
  if (!place) throw new Error(`No encontre coordenadas para ${city}.`);
  return {
    latitude: place.latitude,
    longitude: place.longitude,
    name: [place.name, place.admin1, place.country].filter(Boolean).join(", ")
  };
}

function currentPosition() {
  if (!navigator.geolocation) throw new Error("Tu navegador no permite geolocalizacion.");
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, name: "tu ubicacion actual" }),
      () => reject(new Error("No pude obtener tu ubicacion. Prueba con: clima Bogota.")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  });
}

async function wikipedia(raw, clean) {
  let topic = payload(raw, ["wiki", "wikipedia"]);
  if (!topic && clean.startsWith("que es")) topic = payload(raw, ["que es"]);
  if (!topic && clean.startsWith("quien es")) topic = payload(raw, ["quien es"]);
  if (!topic) throw new Error("Dime el tema. Ejemplo: wiki Nikola Tesla.");
  const response = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("No encontre un resumen de Wikipedia para ese tema.");
  const data = await response.json();
  const extract = data.extract || "Resumen no disponible.";
  setResult("Wikipedia", [["Titulo", data.title || topic], ["Resumen", extract.slice(0, 700)], ["Fuente", data.content_urls?.desktop?.page || "Wikipedia"]]);
  return `${data.title || topic}: ${extract.slice(0, 260)}${extract.length > 260 ? "..." : ""}`;
}

function webSearch(raw) {
  const query = payload(raw, ["buscar", "busca"]);
  if (!query) throw new Error("Dime que quieres buscar. Ejemplo: buscar tutorial JavaScript.");
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  openExternal(url);
  setResult("Busqueda web", [["Consulta", query], ["Motor", "Google"], ["Accion", "Abri una pestana con resultados"]]);
  return `Abri una busqueda web para ${query}.`;
}

function openSite(raw) {
  const target = normalizeCommand(payload(raw, ["abrir", "abre"]));
  if (!target) throw new Error("Dime que quieres abrir. Ejemplo: abrir youtube.");
  const url = shortcuts[target] || (target.includes(".") ? ensureProtocol(target) : `https://www.google.com/search?q=${encodeURIComponent(target)}`);
  openExternal(url);
  setResult("Abrir", [["Destino", target], ["URL", url]]);
  return `Abriendo ${target}.`;
}

function calculate(raw) {
  let expression = payload(raw, ["calcula", "calcular", "cuanto es"]);
  expression = expression.replace(/,/g, ".").replace(/%/g, "/100");
  if (!expression || !/^[0-9+\-*/().\s]+$/.test(expression) || expression.length > 120) {
    throw new Error("Solo puedo calcular expresiones numericas simples. Ejemplo: calcula 18*(7+3).");
  }
  const value = Function(`"use strict"; return (${expression});`)();
  if (!Number.isFinite(value)) throw new Error("El calculo no produjo un numero valido.");
  setResult("Calculadora", [["Expresion", expression], ["Resultado", String(value)]]);
  return `El resultado es ${value}.`;
}

function notes(raw, clean) {
  const saved = readStore(jarvisKeys.notes, []);
  if (clean === "notas" || clean === "nota" || clean.includes("listar notas")) {
    setResult("Notas", saved.length ? saved.map((note, index) => [`${index + 1}`, note.text]) : ["No hay notas guardadas."]);
    return saved.length ? `Tienes ${saved.length} notas guardadas.` : "No tienes notas guardadas todavia.";
  }
  if (clean.includes("borrar notas") || clean.includes("limpiar notas")) {
    writeStore(jarvisKeys.notes, []);
    setResult("Notas", ["Todas las notas fueron eliminadas."]);
    return "Notas eliminadas.";
  }
  const deleteText = payload(raw, ["nota borrar", "borrar nota", "eliminar nota"]);
  if (deleteText) {
    const index = Number.parseInt(deleteText, 10) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= saved.length) throw new Error("Indica un numero de nota valido.");
    const [removed] = saved.splice(index, 1);
    writeStore(jarvisKeys.notes, saved);
    setResult("Nota borrada", [["Texto", removed.text]]);
    return "Nota borrada.";
  }
  const text = payload(raw, ["nota guardar", "guardar nota", "nota agregar", "agregar nota"]);
  if (!text) throw new Error("Para guardar usa: nota guardar tu texto.");
  saved.push({ text, createdAt: new Date().toISOString() });
  writeStore(jarvisKeys.notes, saved);
  setResult("Nota guardada", [["Texto", text], ["Total", String(saved.length)]]);
  return "Nota guardada en memoria local.";
}

function tasks(raw, clean) {
  const saved = readStore(jarvisKeys.tasks, []);
  if (clean === "tareas" || clean.includes("listar tareas")) {
    setResult("Tareas", saved.length ? saved.map((task, index) => [`${index + 1}. ${task.done ? "OK" : "PEND"}`, task.text]) : ["No hay tareas guardadas."]);
    return saved.length ? `Tienes ${saved.filter((task) => !task.done).length} tareas pendientes.` : "No tienes tareas guardadas.";
  }
  if (clean.includes("limpiar tareas") || clean.includes("borrar tareas")) {
    writeStore(jarvisKeys.tasks, []);
    setResult("Tareas", ["Todas las tareas fueron eliminadas."]);
    return "Tareas eliminadas.";
  }
  const completeText = payload(raw, ["tarea completar", "completar tarea", "tarea lista"]);
  if (completeText) {
    const index = Number.parseInt(completeText, 10) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= saved.length) throw new Error("Indica un numero de tarea valido.");
    saved[index].done = true;
    writeStore(jarvisKeys.tasks, saved);
    setResult("Tarea completada", [["Tarea", saved[index].text]]);
    return "Tarea marcada como completada.";
  }
  const text = payload(raw, ["tarea agregar", "agregar tarea", "crear tarea", "tarea crear"]);
  if (!text) throw new Error("Para crear usa: tarea agregar tu pendiente.");
  saved.push({ text, done: false, createdAt: new Date().toISOString() });
  writeStore(jarvisKeys.tasks, saved);
  setResult("Tarea creada", [["Tarea", text], ["Pendientes", String(saved.filter((task) => !task.done).length)]]);
  return "Tarea agregada.";
}
function memory(raw, clean) {
  const saved = readStore(jarvisKeys.memory, {});
  if (clean === "memoria" || clean.includes("que recuerdas")) {
    const entries = Object.entries(saved);
    setResult("Memoria", entries.length ? entries.map(([key, value]) => [key, value]) : ["No tengo recuerdos guardados."]);
    return entries.length ? `Tengo ${entries.length} recuerdos guardados.` : "Aun no tengo recuerdos guardados.";
  }
  const text = payload(raw, ["recuerda que", "recuerda", "recordar"]);
  if (!text) throw new Error("Usa: recuerda que proyecto = KAI.");
  const parts = text.split("=").map((part) => part.trim()).filter(Boolean);
  const key = parts.length >= 2 ? parts[0] : `recuerdo ${Object.keys(saved).length + 1}`;
  const value = parts.length >= 2 ? parts.slice(1).join(" = ") : text;
  saved[key] = value;
  writeStore(jarvisKeys.memory, saved);
  setResult("Memoria actualizada", [[key, value]]);
  return `Recordare: ${key}, ${value}.`;
}

function timer(raw, clean) {
  const match = clean.match(/(\d+(?:\.\d+)?)/);
  if (!match) throw new Error("Indica duracion. Ejemplo: temporizador 5 minutos.");
  const amount = Number(match[1]);
  const multiplier = clean.includes("hora") ? 3600000 : clean.includes("segundo") ? 1000 : 60000;
  const ms = Math.max(1000, amount * multiplier);
  const label = `${amount} ${multiplier === 3600000 ? "hora(s)" : multiplier === 1000 ? "segundo(s)" : "minuto(s)"}`;
  const id = window.setTimeout(() => {
    const message = `Temporizador completado: ${label}.`;
    addLog("TIMER", message);
    setResult("Temporizador", [message], "DONE");
    speak(message);
    targetVoiceEnergy = 1;
  }, ms);
  actionState.timers.push({ id, label, endsAt: Date.now() + ms });
  setResult("Temporizador iniciado", [["Duracion", label], ["Finaliza", new Date(Date.now() + ms).toLocaleTimeString("es-CO")]]);
  return `Temporizador iniciado por ${label}.`;
}

function requestFile() {
  if (!fileInput) throw new Error("El selector de archivos no esta disponible.");
  actionState.pendingFile = true;
  fileInput.value = "";
  fileInput.click();
  setResult("Archivo", ["Selecciona un archivo de texto, Markdown, CSV, JSON, HTML, CSS, JS o LOG para analizarlo."], "WAIT");
  return "Selecciona un archivo y lo analizare localmente en el navegador.";
}

async function analyzeSelectedFile(file) {
  if (!file) return;
  busy("FILE");
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const words = text.match(/[\p{L}\p{N}_-]+/gu) || [];
  const common = topWords(words);
  setResult("Analisis de archivo", [
    ["Archivo", file.name],
    ["Tamano", bytes(file.size)],
    ["Lineas", String(lines.length)],
    ["Palabras", String(words.length)],
    ["Caracteres", String(text.length)],
    ["Terminos frecuentes", common || "No disponible"],
    ["Vista previa", text.slice(0, 380).replace(/\s+/g, " ") || "Archivo vacio"]
  ]);
  complete(`Analisis listo. ${file.name} tiene ${lines.length} lineas y ${words.length} palabras.`, "ARCHIVO");
}

function topWords(words) {
  const stop = new Set(["que", "para", "con", "una", "por", "del", "las", "los", "and", "the", "this", "that", "function", "const", "let", "var"]);
  const counts = new Map();
  words.map((word) => normalizeCommand(word)).filter((word) => word.length > 3 && !stop.has(word)).forEach((word) => {
    counts.set(word, (counts.get(word) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word, count]) => `${word} (${count})`).join(", ");
}

function bytes(value) {
  if (!Number.isFinite(value)) return "No disponible";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function exportLog() {
  const blob = new Blob([JSON.stringify(actionState.history, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `jarvis-bitacora-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setResult("Exportar", [["Entradas", String(actionState.history.length)], ["Formato", "JSON"]]);
  return "Bitacora exportada como JSON.";
}

async function copyLastAnswer() {
  if (!actionState.lastAnswer) throw new Error("No hay una respuesta previa para copiar.");
  if (!navigator.clipboard) throw new Error("El portapapeles no esta disponible en este contexto.");
  await navigator.clipboard.writeText(actionState.lastAnswer);
  setResult("Portapapeles", [["Copiado", actionState.lastAnswer.slice(0, 180)]]);
  return "Ultima respuesta copiada al portapapeles.";
}

function refreshRealTelemetry() {
  const notes = readStore(jarvisKeys.notes, []);
  const savedTasks = readStore(jarvisKeys.tasks, []);
  const liveTimers = actionState.timers.filter((item) => item.endsAt > Date.now());
  actionState.timers = liveTimers;
  const liveValues = [
    ["Conexion", navigator.onLine ? "OK" : "OFF"],
    ["Notas", String(notes.length)],
    ["Tareas", String(savedTasks.filter((task) => !task.done).length)],
    ["Timers", String(liveTimers.length)]
  ];
  if (!sensorFeed) return;
  sensorFeed.innerHTML = "";
  liveValues.forEach(([label, value]) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const state = document.createElement("strong");
    name.textContent = label;
    state.textContent = value;
    item.append(name, state);
    sensorFeed.appendChild(item);
  });
}

if (fileInput) {
  fileInput.addEventListener("change", () => {
    if (actionState.pendingFile) analyzeSelectedFile(fileInput.files[0]);
    actionState.pendingFile = false;
  });
}

setResult("Sistema listo", [
  ["Prueba", "ayuda"],
  ["Datos", "sistema, internet, clima Bogota, wiki Tesla"],
  ["Productividad", "nota guardar..., tarea agregar..., temporizador 5 minutos"],
  ["Archivos", "leer archivo"]
]);
coreCaption.textContent = "Sistema listo. Escribe ayuda para ver acciones reales.";
addLog("UPGRADE", "Motor de acciones reales cargado: APIs, datos locales, archivos, notas, tareas y utilidades.");
refreshRealTelemetry();
setInterval(refreshRealTelemetry, 2600);







