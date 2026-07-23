const canvas = document.querySelector("#hudCanvas");
const ctx = canvas.getContext("2d");
const commandInput = document.querySelector("#commandInput");
const sendCommand = document.querySelector("#sendCommand");
const voiceButton = document.querySelector("#voiceButton");
const muteButton = document.querySelector("#muteButton");
const terminalLog = document.querySelector("#terminalLog");
const logCount = document.querySelector("#logCount");
const coreCaption = document.querySelector("#coreCaption");
const energyCore = document.querySelector("#energyCore");
const waveStack = document.querySelector("#waveStack");
const listeningState = document.querySelector("#listeningState");
const missionState = document.querySelector("#missionState");
const statusLabel = document.querySelector("#statusLabel");
const packetRate = document.querySelector("#packetRate");
const sensorFeed = document.querySelector("#sensorFeed");
const clockTime = document.querySelector("#clockTime");
const clockDate = document.querySelector("#clockDate");
const menuToggle = document.querySelector("#menuToggle");
const jarvisMenu = document.querySelector("#jarvisMenu");
const meters = {
  cognition: document.querySelector("#cognitionMeter"),
  energy: document.querySelector("#energyMeter"),
  focus: document.querySelector("#focusMeter")
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;
const isDesktopApp = Boolean(window.jarvisDesktop?.isElectron);
let recognition = null;
let muted = false;
let isSpeaking = false;
let activeUtterance = null;
let preferredVoice = null;
let isListening = false;
let isNativeListening = false;
let voiceRecordingStop = null;
let logIndex = 0;
let width = 0;
let height = 0;
let particles = [];
let voiceEnergy = 0.12;
let targetVoiceEnergy = 0.12;
let lastFrame = performance.now();
let activeMode = "command";

const sensorLabels = [
  "Nodos sincronizados",
  "Canal de voz",
  "Memoria local",
  "Motor visual",
  "Parser semantico",
  "Rutina de enfoque",
  "Indice de comandos"
];

const commandResponses = [
  {
    match: ["hola", "saludo", "buenas"],
    reply: "Hola. Interfaz K.A.I. activa. Dime que necesitas y lo convertimos en accion."
  },
  {
    match: ["hora", "tiempo"],
    reply: () => `Son las ${new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}.`
  },
  {
    match: ["fecha"],
    reply: () => `Hoy es ${new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`
  },
  {
    match: ["diagnostico", "diagnostico", "estado"],
    reply: "Diagnostico completado. Nucleo estable, telemetria activa, interfaz visual en rendimiento nominal."
  },
  {
    match: ["tareas", "pendientes"],
    reply: "He preparado tres prioridades: terminar el modulo de voz, conectar memoria persistente y crear automatizaciones locales."
  },
  {
    match: ["analisis", "analizar"],
    reply: "Analisis iniciado. Detecto oportunidad clara: convertir esta interfaz en Electron para controlar archivos, apps y servicios del equipo."
  },
  {
    match: ["modo enfoque", "focus", "concentracion"],
    reply: "Modo enfoque activado. Reduciendo ruido visual y priorizando comandos importantes.",
    action: () => setMode("focus")
  },
  {
    match: ["modo escaneo", "scan", "escanear"],
    reply: "Modo escaneo activado. Aumentando densidad de sensores y lectura visual.",
    action: () => setMode("scan")
  },
  {
    match: ["modo comando", "command"],
    reply: "Modo comando restaurado. Todos los paneles vuelven a operacion normal.",
    action: () => setMode("command")
  },
  {
    match: ["limpiar", "clear", "borrar"],
    reply: "Bitacora despejada.",
    action: () => {
      terminalLog.innerHTML = "";
      logIndex = 0;
      logCount.textContent = "0";
    }
  }
];

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  createParticles();
}

function createParticles() {
  const count = Math.min(160, Math.max(72, Math.floor((width * height) / 14000)));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.34,
    vy: (Math.random() - 0.5) * 0.34,
    size: Math.random() * 1.8 + 0.6,
    hue: Math.random() > 0.74 ? 42 : Math.random() > 0.52 ? 158 : 190,
    orbit: Math.random() * Math.PI * 2
  }));
}

function drawBackground(now) {
  ctx.clearRect(0, 0, width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const pulse = 1 + voiceEnergy * 0.5;

  ctx.save();
  ctx.strokeStyle = "rgba(106, 231, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + Math.sin(now * 0.0004 + x) * 18, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + Math.cos(now * 0.0003 + y) * 18);
    ctx.stroke();
  }
  ctx.restore();

  particles.forEach((particle, index) => {
    particle.orbit += 0.008 + voiceEnergy * 0.012;
    particle.x += particle.vx * pulse + Math.cos(particle.orbit) * 0.08;
    particle.y += particle.vy * pulse + Math.sin(particle.orbit) * 0.08;

    if (particle.x < -20) particle.x = width + 20;
    if (particle.x > width + 20) particle.x = -20;
    if (particle.y < -20) particle.y = height + 20;
    if (particle.y > height + 20) particle.y = -20;

    const alpha = 0.18 + voiceEnergy * 0.45;
    ctx.fillStyle = `hsla(${particle.hue}, 100%, 70%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size + voiceEnergy * 1.5, 0, Math.PI * 2);
    ctx.fill();

    for (let j = index + 1; j < particles.length; j += 1) {
      const other = particles[j];
      const dx = particle.x - other.x;
      const dy = particle.y - other.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 118) {
        ctx.strokeStyle = `rgba(106, 231, 255, ${(1 - dist / 118) * (0.12 + voiceEnergy * 0.22)})`;
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(other.x, other.y);
        ctx.stroke();
      }
    }
  });

  ctx.save();
  ctx.translate(centerX, centerY);
  const ringCount = activeMode === "scan" ? 8 : 5;
  for (let i = 0; i < ringCount; i += 1) {
    const radius = 120 + i * 74 + Math.sin(now * 0.001 + i) * 8 + voiceEnergy * 25;
    ctx.strokeStyle = `rgba(${i % 2 ? "72,245,181" : "106,231,255"}, ${0.11 - i * 0.008})`;
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function animate(now) {
  const delta = Math.min(48, now - lastFrame);
  lastFrame = now;
  targetVoiceEnergy = Math.max(0.08, targetVoiceEnergy * 0.985);
  voiceEnergy += (targetVoiceEnergy - voiceEnergy) * Math.min(1, delta / 120);
  document.documentElement.style.setProperty("--voice-scale", (1 + voiceEnergy * 0.2).toFixed(3));
  drawBackground(now);
  animateWaves(now);
  requestAnimationFrame(animate);
}

function buildWaves() {
  waveStack.innerHTML = "";
  for (let i = 0; i < 44; i += 1) {
    const bar = document.createElement("i");
    waveStack.appendChild(bar);
  }
}

function animateWaves(now) {
  const bars = waveStack.children;
  for (let i = 0; i < bars.length; i += 1) {
    const wave = Math.sin(now * 0.006 + i * 0.54) * 0.5 + 0.5;
    const jitter = Math.sin(now * 0.014 + i * 1.7) * 0.5 + 0.5;
    const heightValue = 10 + (wave * 36 + jitter * 18) * (0.38 + voiceEnergy);
    bars[i].style.height = `${heightValue}px`;
    bars[i].style.opacity = `${0.36 + wave * 0.44 + voiceEnergy * 0.2}`;
  }
}

function addLog(title, message) {
  logIndex += 1;
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<strong>${String(logIndex).padStart(2, "0")} // ${title}</strong>${message}`;
  terminalLog.prepend(entry);
  logCount.textContent = String(logIndex);
  targetVoiceEnergy = Math.min(1, targetVoiceEnergy + 0.28);
}

function updateAudioButton() {
  if (!muteButton) return;
  if (isSpeaking && !muted) {
    muteButton.textContent = "Parar";
    muteButton.title = "Detener lectura de voz";
    muteButton.setAttribute("aria-label", "Detener lectura de voz");
    muteButton.setAttribute("aria-pressed", "false");
    return;
  }
  muteButton.textContent = muted ? "Mudo" : "Audio";
  muteButton.title = muted ? "Activar audio" : "Silenciar audio";
  muteButton.setAttribute("aria-label", muted ? "Activar audio" : "Silenciar audio");
  muteButton.setAttribute("aria-pressed", String(muted));
}

function stopSpeech() {
  if (!synth) return false;
  const hadSpeech = isSpeaking || synth.speaking || synth.pending;
  synth.cancel();
  activeUtterance = null;
  isSpeaking = false;
  targetVoiceEnergy = 0.12;
  statusLabel.textContent = "ONLINE";
  updateAudioButton();
  return hadSpeech;
}


function choosePreferredVoice() {
  if (!synth) return null;
  const voices = synth.getVoices();
  const spanishVoices = voices.filter((voice) => {
    const name = `${voice.name} ${voice.lang}`.toLowerCase();
    return /^es[-_]/i.test(voice.lang) || name.includes("spanish") || name.includes("espanol") || name.includes("espanol") || name.includes("sabina") || name.includes("helena") || name.includes("pablo");
  });

  preferredVoice =
    spanishVoices.find((voice) => /sabina|helena|pablo|microsoft|google/.test(voice.name.toLowerCase())) ||
    spanishVoices[0] ||
    voices[0] ||
    null;

  return preferredVoice;
}

function setupVoices() {
  choosePreferredVoice();
  if (synth) synth.onvoiceschanged = choosePreferredVoice;
}
function speak(text) {
  if (muted || !synth) return;
  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  activeUtterance = utterance;
  const voice = preferredVoice || choosePreferredVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang || "es-ES";
  } else {
    utterance.lang = "es-ES";
  }
  utterance.rate = 0.94;
  utterance.pitch = 0.82;
  utterance.volume = 0.94;
  utterance.onstart = () => {
    isSpeaking = true;
    statusLabel.textContent = "SPEAKING";
    targetVoiceEnergy = 0.85;
    updateAudioButton();
  };
  utterance.onend = () => {
    if (activeUtterance !== utterance) return;
    activeUtterance = null;
    isSpeaking = false;
    statusLabel.textContent = "ONLINE";
    updateAudioButton();
  };
  utterance.onerror = utterance.onend;
  synth.speak(utterance);
}

window.stopJarvisSpeech = stopSpeech;
window.updateJarvisAudioButton = updateAudioButton;
function normalizeCommand(raw) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function runCommand(rawCommand) {
  const cleaned = normalizeCommand(rawCommand);
  if (!cleaned) return;
  addLog("COMANDO", rawCommand);

  const selected = commandResponses.find((item) =>
    item.match.some((keyword) => cleaned.includes(normalizeCommand(keyword)))
  );

  const fallback = "No tengo ese protocolo todavia, pero puedo aprenderlo. Prueba con diagnostico, hora, tareas, analisis o modo escaneo.";
  const response = selected
    ? typeof selected.reply === "function"
      ? selected.reply()
      : selected.reply
    : fallback;

  if (selected?.action) selected.action();
  coreCaption.textContent = response;
  missionState.textContent = "EXECUTED";
  addLog("K.A.I.", response);
  speak(response);
  commandInput.value = "";
}


async function requestMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) return true;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
  return true;
}


function getGeminiVoiceConfig() {
  const rawKey = localStorage.getItem("jarvis.gemini.apiKey.v1");
  let apiKey = "";
  try {
    apiKey = rawKey ? JSON.parse(rawKey) : "";
  } catch {
    apiKey = rawKey || "";
  }
  return { apiKey, model: "gemini-3.6-flash" };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("No pude leer el audio grabado."));
    reader.readAsDataURL(blob);
  });
}

async function recordMicrophoneAudio(options = {}) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este entorno no expone acceso al microfono.");
  if (!window.MediaRecorder) throw new Error("Este entorno no puede grabar audio con MediaRecorder.");

  const maxSeconds = Math.max(15, Math.min(180, Number(options.maxSeconds) || 90));
  const silenceMs = Math.max(900, Math.min(6000, Number(options.silenceMs) || 2200));
  const minRecordMs = Math.max(800, Math.min(10000, Number(options.minRecordMs) || 1500));
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  const samples = new Uint8Array(analyser.fftSize);

  return new Promise((resolve, reject) => {
    let startedAt = performance.now();
    let lastVoiceAt = startedAt;
    let heardVoice = false;
    let rafId = 0;
    let maxTimer = 0;
    let settled = false;

    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (maxTimer) clearTimeout(maxTimer);
      voiceRecordingStop = null;
      stream.getTracks().forEach((track) => track.stop());
      audioContext.close().catch(() => {});
    };

    const stopRecorder = () => {
      if (recorder.state !== "inactive") recorder.stop();
    };

    voiceRecordingStop = stopRecorder;

    const watchSilence = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) {
        const centered = value - 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / samples.length) / 128;
      const now = performance.now();
      targetVoiceEnergy = Math.max(targetVoiceEnergy, Math.min(1, 0.18 + rms * 8));

      if (rms > 0.035) {
        heardVoice = true;
        lastVoiceAt = now;
        coreCaption.textContent = "Te escucho. Sigue hablando o pulsa Parar para procesar.";
      }

      const canAutoStop = heardVoice && now - startedAt > minRecordMs && now - lastVoiceAt > silenceMs;
      if (canAutoStop) {
        stopRecorder();
        return;
      }
      rafId = requestAnimationFrame(watchSilence);
    };

    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(recorder.error || new Error("Fallo la grabacion del microfono."));
    };
    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (!blob.size) reject(new Error("La grabacion quedo vacia."));
      else resolve(blob);
    };

    recorder.start(250);
    maxTimer = setTimeout(stopRecorder, maxSeconds * 1000);
    watchSilence();
  });
}

async function transcribeWithGeminiAudio(blob) {
  const { apiKey, model } = getGeminiVoiceConfig();
  if (!apiKey) throw new Error("Falta configurar la Gemini API key en Nucleo IA.");
  const base64Audio = await blobToBase64(blob);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: "Transcribe exactamente el comando hablado en espanol. Responde solo el texto transcrito, sin comillas, sin explicaciones." },
          { inlineData: { mimeType: blob.type || "audio/webm", data: base64Audio } }
        ]
      }],
      generationConfig: { maxOutputTokens: 160, temperature: 0 }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Gemini Audio HTTP ${response.status}`);
  const text = (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join(" ")
    .trim();
  if (!text) throw new Error("Gemini no devolvio transcripcion.");
  return text.replace(/^['"“”]+|['"“”]+$/g, "").trim();
}

async function openFastVoiceBrowser() {
  coreCaption.textContent = "Abriendo modo voz rapida en el navegador...";
  addLog("VOZ", "Electron no tiene el motor rapido de voz de Chrome/Edge. Abro el modo navegador con puente local.");
  try {
    const response = await fetch("http://127.0.0.1:8765/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open-voice-browser" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "No pude abrir el navegador.");
    if (typeof setResult === "function") {
      setResult("Modo voz rapida", [
        ["Interfaz", data.url || "http://127.0.0.1:8765/index.html"],
        ["Voz", "Chrome/Edge Web Speech, rapido"],
        ["Acciones PC", "Puente Node activo"]
      ], "OPEN");
    }
  } catch (error) {
    coreCaption.textContent = "Abre http://127.0.0.1:8765/index.html en Chrome o Edge para usar voz rapida.";
    addLog("VOZ", `No pude abrir el modo navegador: ${error.message || "sin detalle"}`);
  }
}
async function listenWithGeminiAudio() {
  if (isNativeListening) return;
  if (!getGeminiVoiceConfig().apiKey) {
    addLog("VOZ", "Falta Gemini API key en esta ventana. Abre MENU > Nucleo IA, pega la key y pulsa KEY.");
    coreCaption.textContent = "Para voz en Electron necesito la Gemini API key guardada en esta misma app.";
    if (typeof setResult === "function") {
      setResult("Voz sin configurar", [
        ["Falta", "Gemini API key"],
        ["Donde", "MENU > Nucleo IA > KEY"],
        ["Nota", "Electron, http://127.0.0.1 y file:// tienen localStorage separado."]
      ], "WAIT");
    }
    return;
  }
  isNativeListening = true;
  voiceButton.disabled = false;
  voiceButton.textContent = "Parar";
  voiceButton.classList.add("is-listening");
  listeningState.textContent = "VOICE";
  missionState.textContent = "LISTENING";
  coreCaption.textContent = "Te escucho. Habla natural; me detengo al detectar una pausa.";
  targetVoiceEnergy = 0.82;

  try {
    const audio = await recordMicrophoneAudio({ maxSeconds: 90, silenceMs: 2200, minRecordMs: 1500 });
    voiceButton.textContent = "IA";
    coreCaption.textContent = "Transcribiendo voz con Gemini...";
    const transcript = await transcribeWithGeminiAudio(audio);
    commandInput.value = transcript;
    addLog("VOZ", `Gemini Audio reconocio: ${transcript}`);
    runCommand(transcript);
  } catch (error) {
    addLog("VOZ", `Gemini Audio no pudo transcribir: ${error.message || "sin detalle"}`);
    coreCaption.textContent = "No pude transcribir la voz. Revisa permiso de microfono y API key de Gemini.";
  } finally {
    isNativeListening = false;
    voiceRecordingStop = null;
    voiceButton.disabled = false;
    voiceButton.textContent = "Voz";
    voiceButton.classList.remove("is-listening");
    listeningState.textContent = "MANUAL";
    targetVoiceEnergy = 0.18;
  }
}
async function listenWithNativeBridge() {
  if (isNativeListening) return;
  isNativeListening = true;
  voiceButton.disabled = true;
  voiceButton.textContent = "Oyendo";
  listeningState.textContent = "VOICE";
  missionState.textContent = "LISTENING";
  coreCaption.textContent = "Escuchando desde el microfono del sistema...";
  targetVoiceEnergy = 0.72;

  try {
    const response = await fetch("http://127.0.0.1:8765/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recognize-speech", seconds: 8 })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "No escuche una frase clara.");
    const transcript = String(data.text || "").trim();
    if (!transcript) throw new Error("No escuche una frase clara.");
    commandInput.value = transcript;
    addLog("VOZ", `Windows Speech reconocio: ${transcript}`);
    runCommand(transcript);
  } catch (error) {
    addLog("VOZ", `El reconocimiento nativo no respondio: ${error.message || "sin detalle"}`);
    coreCaption.textContent = "No pude convertir la voz en texto. Prueba texto o instala voz de Windows en espanol.";
  } finally {
    isNativeListening = false;
    voiceButton.disabled = false;
    voiceButton.textContent = "Voz";
    listeningState.textContent = "MANUAL";
    targetVoiceEnergy = 0.18;
  }
}
function setupRecognition() {
  if (isDesktopApp) {
    voiceButton.disabled = false;
    voiceButton.textContent = "Voz";
    voiceButton.title = "Abrir modo voz rapida en Chrome o Edge";
    addLog("VOZ", "Electron queda como panel de escritorio. Para voz rapida usa el modo navegador con el puente local.");
    return;
  }

  if (!SpeechRecognition) {
    voiceButton.disabled = false;
    voiceButton.textContent = "Voz";
    voiceButton.title = "Escuchar usando el puente nativo de Windows";
    addLog("VOZ", "Electron no expone Web Speech Recognition. Active el respaldo nativo del puente local con Windows Speech.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "es-ES";
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isListening = true;
    voiceButton.classList.add("is-listening");
    voiceButton.textContent = "Oyendo";
    listeningState.textContent = "VOICE";
    missionState.textContent = "LISTENING";
    targetVoiceEnergy = 0.7;
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    commandInput.value = transcript.trim();
    coreCaption.textContent = transcript ? `Escuchando: ${transcript}` : "Analizando entrada de voz.";
    targetVoiceEnergy = Math.min(1, 0.45 + transcript.length / 80);
    if (event.results[event.results.length - 1].isFinal) {
      runCommand(transcript);
    }
  };

  recognition.onerror = (event) => {
    const detail = event?.error ? ` (${event.error})` : "";
    addLog("VOZ", `No pude acceder claramente al microfono${detail}. Puedes seguir usando texto.`);
    if (event?.error === "not-allowed") {
      coreCaption.textContent = "Electron no recibio permiso para usar el microfono.";
    }
    if (event?.error === "service-not-allowed" || event?.error === "network") {
      coreCaption.textContent = "Cambio a reconocimiento nativo de Windows.";
      setTimeout(() => listenWithGeminiAudio(), 180);
    }
  };

  recognition.onend = () => {
    isListening = false;
    voiceButton.classList.remove("is-listening");
    voiceButton.textContent = "Voz";
    listeningState.textContent = "MANUAL";
  };
}

async function toggleVoice() {
  if (isDesktopApp) {
    return openFastVoiceBrowser();
  }
  if (!recognition) {
    return listenWithGeminiAudio();
  }
  if (isListening) {
    recognition.stop();
    return;
  }

  try {
    voiceButton.disabled = true;
    voiceButton.textContent = "Permiso";
    await requestMicrophoneAccess();
    recognition.start();
  } catch (error) {
    const detail = error?.message ? ` ${error.message}` : "";
    addLog("VOZ", `No tengo permiso para usar el microfono.${detail}`);
    coreCaption.textContent = "Activa el permiso del microfono para hablar con K.A.I.";
    listeningState.textContent = "MANUAL";
  } finally {
    voiceButton.disabled = false;
    if (!isListening) voiceButton.textContent = "Voz";
  }
}

function setMenuOpen(open) {
  document.body.classList.toggle("menu-open", open);
  if (jarvisMenu) jarvisMenu.setAttribute("aria-hidden", String(!open));
  if (menuToggle) menuToggle.setAttribute("aria-expanded", String(open));
}

function toggleMenu() {
  setMenuOpen(!document.body.classList.contains("menu-open"));
}

window.setJarvisMenuOpen = setMenuOpen;
window.toggleJarvisMenu = toggleMenu;
function setMode(mode) {
  activeMode = mode;
  document.body.classList.toggle("mode-focus", mode === "focus");
  document.body.classList.toggle("mode-scan", mode === "scan");
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  missionState.textContent = mode.toUpperCase();
  targetVoiceEnergy = mode === "scan" ? 0.58 : mode === "focus" ? 0.28 : 0.38;
}

function updateClock() {
  const now = new Date();
  clockTime.textContent = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  clockDate.textContent = now.toLocaleDateString("es-CO", { weekday: "short", month: "short", day: "numeric" });
}

function updateTelemetry() {
  const shift = (base, spread) => Math.max(8, Math.min(99, base + (Math.random() - 0.5) * spread));
  meters.cognition.value = shift(86, 12);
  meters.energy.value = shift(72, 18);
  meters.focus.value = activeMode === "focus" ? shift(88, 8) : shift(64, 22);
  packetRate.textContent = `${Math.floor(24 + Math.random() * 54)} ms`;

  const entries = Array.from({ length: 5 }, () => {
    const label = sensorLabels[Math.floor(Math.random() * sensorLabels.length)];
    const value = Math.random() > 0.34 ? "OK" : `${Math.floor(58 + Math.random() * 40)}%`;
    return `<li><span>${label}</span><strong>${value}</strong></li>`;
  });
  sensorFeed.innerHTML = entries.join("");
}

function wireEvents() {
  sendCommand.addEventListener("click", () => runCommand(commandInput.value));
  commandInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runCommand(commandInput.value);
  });
  voiceButton.addEventListener("click", toggleVoice);
  if (menuToggle) menuToggle.addEventListener("click", toggleMenu);
  muteButton.addEventListener("click", () => {
    if (isSpeaking || synth?.speaking || synth?.pending) {
      stopSpeech();
      addLog("AUDIO", "Lectura de voz detenida.");
      return;
    }
    muted = !muted;
    updateAudioButton();
    addLog("AUDIO", muted ? "Sintesis de voz silenciada." : "Sintesis de voz activada.");
  });
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
  document.querySelectorAll(".module-chip").forEach((button) => {
    button.addEventListener("click", () => runCommand(button.dataset.command));
  });
  window.addEventListener("resize", resizeCanvas);
}

function boot() {
  resizeCanvas();
  buildWaves();
  setupVoices();
  setupRecognition();
  wireEvents();
  updateAudioButton();
  updateClock();
  updateTelemetry();
  setInterval(updateClock, 1000);
  setInterval(updateTelemetry, 2400);
  addLog("BOOT", "K.A.I. inicializado. Voz, HUD y consola preparados.");
  coreCaption.textContent = "Sistema listo. Escribe un comando o activa voz.";
  requestAnimationFrame(animate);
}

boot();




















