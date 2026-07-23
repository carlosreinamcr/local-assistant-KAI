const http = require("http");
const fs = require("fs/promises");
const fssync = require("fs");
const path = require("path");
const os = require("os");
const { spawn, execFileSync } = require("child_process");
const net = require("net");

const PORT = Number(process.env.KAI_BRIDGE_PORT || process.env.JARVIS_BRIDGE_PORT || 8765);
const ROOT = __dirname;
const DESKTOP = path.join(os.homedir(), "Desktop");
const DOCUMENTS = path.join(os.homedir(), "Documents");
const DOWNLOADS = path.join(os.homedir(), "Downloads");
const allowedRoots = [DESKTOP, DOCUMENTS, DOWNLOADS, ROOT].map((item) => path.resolve(item).toLowerCase());

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mind": "application/octet-stream"
};

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(body, null, 2));
}

function safeName(value) {
  return String(value || "mi-proyecto-kai")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64) || "mi-proyecto-kai";
}

function ensureAllowed(targetPath) {
  const resolved = path.resolve(targetPath);
  const lower = resolved.toLowerCase();
  if (!allowedRoots.some((root) => lower === root || lower.startsWith(root + path.sep))) {
    throw new Error(`Ruta fuera de zonas permitidas: ${resolved}`);
  }
  return resolved;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function writeFileSafe(filePath, content) {
  const resolved = ensureAllowed(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, content, "utf8");
  return resolved;
}

function runDetached(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || ROOT,
    detached: true,
    stdio: "ignore",
    shell: false,
    windowsHide: true
  });
  child.unref();
}

function knownRoot(location) {
  const normalized = String(location || "").toLowerCase();
  if (normalized === "downloads" || normalized === "descargas") return DOWNLOADS;
  if (normalized === "documents" || normalized === "documentos") return DOCUMENTS;
  return DESKTOP;
}

function openBrowser(url) {
  try {
    runDetached("cmd", ["/c", "start", "", url], { cwd: ROOT });
    return { ok: true, url, method: "cmd-start" };
  } catch (error) {
    return { ok: false, url, warning: error.message };
  }
}

function findAvailablePort(start = 3000) {
  return new Promise((resolve) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.once("error", () => tryPort(port + 1));
      server.once("listening", () => server.close(() => resolve(port)));
      server.listen(port, "127.0.0.1");
    };
    tryPort(start);
  });
}

async function launchProject(projectPath) {
  const target = ensureAllowed(projectPath);
  const port = await findAvailablePort(3000);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: target,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, PORT: String(port) }
  });
  child.unref();
  const url = `http://127.0.0.1:${port}`;
  return { ok: true, port, url, browser: openBrowser(url) };
}

async function copyKnownAsset(options, projectPath, kind) {
  if (!options?.fileName) return null;
  const sourceRoot = knownRoot(options.location);
  const source = ensureAllowed(path.join(sourceRoot, path.basename(options.fileName)));
  if (!fssync.existsSync(source)) {
    return { ok: false, kind, source, warning: `No encontre ${path.basename(options.fileName)} en ${sourceRoot}.` };
  }
  const targetName = kind === "mind" ? "targets.mind" : path.basename(options.fileName);
  const target = ensureAllowed(path.join(projectPath, "assets", targetName));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
  return { ok: true, kind, source, target, fileName: targetName, relativePath: `assets/${targetName}` };
}
function findVSCodeExecutable() {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Microsoft VS Code", "Code.exe"),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Microsoft VS Code", "Code.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Microsoft VS Code", "Code.exe"),
    path.join(os.homedir(), "AppData", "Local", "Programs", "Microsoft VS Code", "Code.exe")
  ].filter(Boolean);
  return candidates.find((candidate) => fssync.existsSync(candidate)) || null;
}

function hasVSCodeCommand() {
  try {
    execFileSync("where.exe", ["code"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function openVSCode(projectPath = ROOT) {
  const target = ensureAllowed(projectPath || ROOT);
  const executable = findVSCodeExecutable();
  if (executable) {
    try {
      runDetached(executable, [target], { cwd: target });
      return { ok: true, method: "Code.exe", executable };
    } catch (error) {
      return { ok: false, method: "Code.exe", warning: error.message, executable };
    }
  }

  if (hasVSCodeCommand()) {
    try {
      runDetached("cmd", ["/c", "code", target], { cwd: target });
      return { ok: true, method: "code" };
    } catch (error) {
      return { ok: false, method: "code", warning: error.message };
    }
  }

  try {
    runDetached("cmd", ["/c", "start", "", target], { cwd: target });
    return { ok: false, method: "explorer", warning: "No encontre Code.exe ni el comando code. Abri la carpeta en Windows." };
  } catch (fallbackError) {
    return { ok: false, method: "none", warning: fallbackError.message };
  }
}
function arIndex(projectName) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${projectName} | WebAR GLB</title>
    <meta name="description" content="Aplicacion WebAR generada por K.A.I. para cargar modelos GLB.">
    <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"></script>
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <main class="ar-shell">
      <section class="hud">
        <p class="eyebrow">WebAR GLB Lab</p>
        <h1>${projectName}</h1>
        <p class="summary">Carga un modelo <strong>.glb</strong>, inspeccionalo en 3D y abre AR en dispositivos compatibles.</p>
        <div class="actions">
          <label class="file-button">
            <input id="modelInput" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json">
            Seleccionar GLB
          </label>
          <button id="resetModel">Modelo demo</button>
        </div>
        <dl class="telemetry">
          <div><dt>Modelo</dt><dd id="modelName">assets/model.glb</dd></div>
          <div><dt>Estado</dt><dd id="modelStatus">Esperando modelo</dd></div>
          <div><dt>AR</dt><dd>Scene Viewer / Quick Look / WebXR</dd></div>
        </dl>
      </section>

      <model-viewer
        id="viewer"
        src="assets/model.glb"
        alt="Modelo 3D GLB"
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        auto-rotate
        shadow-intensity="1"
        exposure="1.05"
        tone-mapping="aces"
        interaction-prompt="auto">
        <button slot="ar-button" class="ar-button">Ver en AR</button>
        <div class="poster" slot="poster">Coloca tu GLB en assets/model.glb o selecciona uno.</div>
      </model-viewer>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`;
}

function arStyles() {
  return `:root {
  color-scheme: dark;
  --bg: #030711;
  --panel: rgba(8, 20, 34, 0.72);
  --line: rgba(94, 230, 255, 0.34);
  --cyan: #68e7ff;
  --mint: #52f2bd;
  --ink: #eefcff;
  --muted: #99aebe;
}

* { box-sizing: border-box; }
html, body { min-height: 100%; margin: 0; }
body {
  background:
    radial-gradient(circle at 72% 24%, rgba(82, 242, 189, 0.18), transparent 30%),
    linear-gradient(135deg, #030711, #071624 58%, #030711);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif;
}

.ar-shell {
  display: grid;
  grid-template-columns: minmax(280px, 390px) minmax(0, 1fr);
  min-height: 100dvh;
  gap: 18px;
  padding: clamp(14px, 2vw, 28px);
}

.hud {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 20px;
  backdrop-filter: blur(18px);
  box-shadow: 0 22px 70px rgba(0,0,0,.38), inset 0 0 40px rgba(104,231,255,.07);
}

.eyebrow { margin: 0 0 8px; color: var(--mint); text-transform: uppercase; font-size: .74rem; }
h1 { margin: 0; font-size: clamp(2.1rem, 7vw, 4.8rem); line-height: .88; }
.summary { color: var(--muted); line-height: 1.55; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 18px 0; }
.file-button, button {
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(0,0,0,.22);
  color: var(--ink);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.file-button input { display: none; }
.telemetry { display: grid; gap: 10px; margin: 0; }
.telemetry div { border-bottom: 1px solid rgba(104,231,255,.18); padding-bottom: 9px; }
dt { color: var(--mint); font-size: .7rem; text-transform: uppercase; }
dd { margin: 4px 0 0; color: var(--ink); overflow-wrap: anywhere; }

model-viewer {
  width: 100%;
  min-height: calc(100dvh - clamp(28px, 4vw, 56px));
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(rgba(104,231,255,.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(104,231,255,.06) 1px, transparent 1px),
    radial-gradient(circle, rgba(104,231,255,.18), transparent 48%);
  background-size: 36px 36px, 36px 36px, 100% 100%;
  box-shadow: inset 0 0 80px rgba(0,0,0,.48);
}

.ar-button {
  position: absolute;
  right: 18px;
  bottom: 18px;
  padding: 0 18px;
  background: linear-gradient(135deg, rgba(104,231,255,.34), rgba(82,242,189,.18));
}

.poster {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--muted);
  text-align: center;
  padding: 24px;
}

@media (max-width: 820px) {
  .ar-shell { grid-template-columns: 1fr; }
  model-viewer { min-height: 58dvh; }
}
`;
}

function arApp() {
  return `const viewer = document.querySelector("#viewer");
const modelInput = document.querySelector("#modelInput");
const modelName = document.querySelector("#modelName");
const modelStatus = document.querySelector("#modelStatus");
const resetModel = document.querySelector("#resetModel");
let objectUrl = null;

function setModel(url, name) {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = url.startsWith("blob:") ? url : null;
  viewer.src = url;
  modelName.textContent = name;
  modelStatus.textContent = "Cargando";
}

modelInput.addEventListener("change", () => {
  const file = modelInput.files[0];
  if (!file) return;
  setModel(URL.createObjectURL(file), file.name);
});

resetModel.addEventListener("click", () => setModel("assets/model.glb", "assets/model.glb"));

viewer.addEventListener("load", () => {
  modelStatus.textContent = "Modelo cargado";
});

viewer.addEventListener("error", () => {
  modelStatus.textContent = "No se pudo cargar. Coloca un GLB en assets/model.glb o selecciona uno.";
});
`;
}

function arReadme(projectName) {
  return `# ${projectName}

Aplicacion WebAR generada por K.A.I.

## Uso rapido

1. Coloca tu modelo en \`assets/model.glb\`, o usa el boton \`Seleccionar GLB\` en la interfaz.
2. Ejecuta:

\`\`\`bash
npm start
\`\`\`

3. Abre \`http://localhost:3000\`.

## AR

El visor usa \`<model-viewer>\` con modos \`webxr scene-viewer quick-look\`. En escritorio veras el modelo 3D; en moviles compatibles podras abrir AR.

## Archivos

- \`index.html\`: interfaz WebAR.
- \`styles.css\`: HUD visual.
- \`app.js\`: carga de GLB local.
- \`assets/model.glb\`: coloca aqui tu modelo.
`;
}
function mindarIndex(projectName) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${projectName} | MindAR GLB</title>
    <meta name="description" content="Aplicacion MindAR generada por K.A.I. para cargar un modelo GLB y un target .mind.">
    <link rel="stylesheet" href="styles.css">
    <script type="importmap">
      {
        "imports": {
          "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
          "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
          "mindar-image-three": "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js"
        }
      }
    </script>
  </head>
  <body>
    <main class="mindar-shell">
      <section class="control-deck">
        <p class="eyebrow">MindAR Image Tracking</p>
        <h1>${projectName}</h1>
        <p class="summary">Carga tu modelo <strong>.glb</strong>, carga tu target <strong>.mind</strong> y arranca una escena AR con seguimiento de imagen.</p>
        <div class="action-grid">
          <label class="file-button">
            <input id="glbInput" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json">
            Cargar GLB
          </label>
          <label class="file-button">
            <input id="mindInput" type="file" accept=".mind,application/octet-stream">
            Cargar .mind
          </label>
          <button id="startButton" disabled>Iniciar AR</button>
          <button id="stopButton" disabled>Detener</button>
        </div>
        <dl class="telemetry">
          <div><dt>GLB</dt><dd id="glbName">Pendiente</dd></div>
          <div><dt>MIND</dt><dd id="mindName">Pendiente</dd></div>
          <div><dt>Estado</dt><dd id="statusText">Carga un archivo .mind para iniciar</dd></div>
        </dl>
      </section>
      <section id="arContainer" class="ar-container" aria-label="Escena MindAR">
        <div id="emptyState" class="empty-state">La camara AR aparecera aqui cuando pulses Iniciar AR.</div>
      </section>
    </main>
    <script type="module" src="app.js"></script>
  </body>
</html>
`;
}

function mindarStyles() {
  return `:root {
  color-scheme: dark;
  --bg: #020611;
  --panel: rgba(6, 18, 31, 0.78);
  --line: rgba(104, 231, 255, 0.34);
  --cyan: #68e7ff;
  --mint: #52f2bd;
  --amber: #ffd166;
  --ink: #eefcff;
  --muted: #9fb4c4;
}
* { box-sizing: border-box; }
html, body { min-height: 100%; margin: 0; overflow: hidden; }
body {
  background:
    linear-gradient(rgba(104,231,255,.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(104,231,255,.05) 1px, transparent 1px),
    radial-gradient(circle at 72% 22%, rgba(82,242,189,.18), transparent 34%),
    linear-gradient(135deg, #020611, #071626 62%, #020611);
  background-size: 42px 42px, 42px 42px, 100% 100%, 100% 100%;
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif;
}
.mindar-shell {
  display: grid;
  grid-template-columns: minmax(300px, 390px) minmax(0, 1fr);
  gap: 16px;
  height: 100dvh;
  padding: clamp(12px, 2vw, 22px);
}
.control-deck, .ar-container {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 22px 70px rgba(0,0,0,.42), inset 0 0 42px rgba(104,231,255,.06);
}
.control-deck { padding: 20px; overflow: auto; }
.eyebrow { margin: 0 0 8px; color: var(--mint); text-transform: uppercase; font-size: .76rem; }
h1 { margin: 0; font-size: clamp(2.1rem, 6vw, 4.4rem); line-height: .9; }
.summary { color: var(--muted); line-height: 1.55; }
.action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 18px 0; }
.file-button, button {
  min-height: 46px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(0,0,0,.25);
  color: var(--ink);
  display: grid;
  place-items: center;
  text-align: center;
  cursor: pointer;
  padding: 0 12px;
}
.file-button input { display: none; }
button:disabled { opacity: .42; cursor: not-allowed; }
#startButton:not(:disabled) { background: linear-gradient(135deg, rgba(104,231,255,.28), rgba(82,242,189,.18)); }
.telemetry { display: grid; gap: 10px; margin: 0; }
.telemetry div { border-bottom: 1px solid rgba(104,231,255,.18); padding-bottom: 9px; }
dt { color: var(--mint); font-size: .7rem; text-transform: uppercase; }
dd { margin: 4px 0 0; color: var(--ink); overflow-wrap: anywhere; }
.ar-container { position: relative; min-height: 0; overflow: hidden; }
.empty-state { position: absolute; inset: 0; display: grid; place-items: center; padding: 28px; text-align: center; color: var(--muted); }
canvas { display: block; }
@media (max-width: 860px) {
  html, body { overflow: auto; }
  .mindar-shell { grid-template-columns: 1fr; height: auto; min-height: 100dvh; }
  .ar-container { min-height: 62dvh; }
}
`;
}

function mindarApp(defaults = {}) {
  const defaultGlb = JSON.stringify(defaults.glb || "");
  const defaultMind = JSON.stringify(defaults.mind || "");
  return `import * as THREE from "three";
import { MindARThree } from "mindar-image-three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const container = document.querySelector("#arContainer");
const emptyState = document.querySelector("#emptyState");
const glbInput = document.querySelector("#glbInput");
const mindInput = document.querySelector("#mindInput");
const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const glbName = document.querySelector("#glbName");
const mindName = document.querySelector("#mindName");
const statusText = document.querySelector("#statusText");

const DEFAULT_GLB = ${defaultGlb};
const DEFAULT_MIND = ${defaultMind};

let glbUrl = DEFAULT_GLB;
let mindUrl = DEFAULT_MIND;
let mindarThree = null;
let anchor = null;
let loadedModel = null;
let running = false;

function setStatus(text) {
  statusText.textContent = text;
}

function revokeUrl(url) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

function updateStartState() {
  startButton.disabled = !mindUrl || running;
  stopButton.disabled = !running;
}

function createPlaceholder() {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(0.55, 0.55, 0.55);
  const material = new THREE.MeshStandardMaterial({ color: 0x68e7ff, metalness: 0.35, roughness: 0.28 });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(0, 0, 0);
  group.add(cube);
  return group;
}

function fitModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  object.scale.multiplyScalar(0.75 / maxAxis);
  object.position.sub(center.multiplyScalar(object.scale.x));
  object.rotation.x = 0;
}

async function loadModel() {
  if (!anchor) return;
  if (loadedModel) anchor.group.remove(loadedModel);
  if (!glbUrl) {
    loadedModel = createPlaceholder();
    anchor.group.add(loadedModel);
    return;
  }
  setStatus("Cargando GLB...");
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(glbUrl);
  loadedModel = gltf.scene;
  fitModel(loadedModel);
  anchor.group.add(loadedModel);
  setStatus("GLB cargado. Apunta la camara al target.");
}

async function stopAR() {
  if (!mindarThree) return;
  try { await mindarThree.stop(); } catch {}
  const renderer = mindarThree.renderer;
  renderer.setAnimationLoop(null);
  renderer.dispose();
  container.querySelectorAll("canvas, video").forEach((node) => node.remove());
  mindarThree = null;
  anchor = null;
  loadedModel = null;
  running = false;
  emptyState.style.display = "grid";
  setStatus(mindUrl ? "AR detenido. Puedes iniciar otra vez." : "Carga un archivo .mind para iniciar.");
  updateStartState();
}

async function startAR() {
  if (!mindUrl) {
    setStatus("Primero carga tu archivo .mind.");
    return;
  }
  await stopAR();
  emptyState.style.display = "none";
  setStatus("Inicializando MindAR...");
  mindarThree = new MindARThree({ container, imageTargetSrc: mindUrl });
  const { renderer, scene, camera } = mindarThree;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.6));
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(0, 1, 1);
  scene.add(light);
  anchor = mindarThree.addAnchor(0);
  await loadModel();
  await mindarThree.start();
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  running = true;
  setStatus("AR activo. Apunta la camara al target compilado en tu .mind.");
  updateStartState();
}

glbInput.addEventListener("change", async () => {
  const file = glbInput.files?.[0];
  if (!file) return;
  revokeUrl(glbUrl);
  glbUrl = URL.createObjectURL(file);
  glbName.textContent = file.name;
  setStatus(running ? "Actualizando GLB..." : "GLB listo. Falta iniciar AR.");
  if (running) await loadModel();
});

mindInput.addEventListener("change", async () => {
  const file = mindInput.files?.[0];
  if (!file) return;
  revokeUrl(mindUrl);
  mindUrl = URL.createObjectURL(file);
  mindName.textContent = file.name;
  setStatus("Target .mind listo. Pulsa Iniciar AR.");
  if (running) await stopAR();
  updateStartState();
});

startButton.addEventListener("click", () => startAR().catch((error) => {
  console.error(error);
  setStatus("No pude iniciar MindAR: " + error.message);
  emptyState.style.display = "grid";
  running = false;
  updateStartState();
}));
stopButton.addEventListener("click", stopAR);
window.addEventListener("beforeunload", () => { revokeUrl(glbUrl); revokeUrl(mindUrl); });
if (DEFAULT_GLB) glbName.textContent = DEFAULT_GLB.split("/").pop();
if (DEFAULT_MIND) mindName.textContent = DEFAULT_MIND.split("/").pop();
if (DEFAULT_MIND) setStatus(DEFAULT_GLB ? "Assets listos. Pulsa Iniciar AR." : "Target .mind listo. Puedes cargar un GLB o iniciar con placeholder.");
updateStartState();
`;
}

function mindarReadme(projectName) {
  return `# ${projectName}

Aplicacion MindAR generada por K.A.I.

## Que hace

- Carga un modelo \`.glb\` desde el navegador.
- Carga un target compilado \`.mind\` desde el navegador.
- Inicia una escena AR con MindAR Image Tracking + Three.js.
- Coloca el GLB sobre el target con indice 0 del archivo \`.mind\`.

## Ejecutar

\`\`\`bash
npm start
\`\`\`

Abre \`http://localhost:3000\`.

## Uso

1. Pulsa \`Cargar GLB\` y selecciona tu modelo 3D.
2. Pulsa \`Cargar .mind\` y selecciona tu archivo target de MindAR.
3. Pulsa \`Iniciar AR\` y permite la camara.
4. Apunta la camara a la imagen usada para compilar el target.

## Notas

MindAR necesita permisos de camara y normalmente funciona mejor servido por HTTP/HTTPS, por eso este proyecto trae \`server.js\`.
`;
}
function webIndex(projectName) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${projectName}</title>
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <main class="app">
      <section class="hero">
        <p class="eyebrow">Proyecto generado por K.A.I.</p>
        <h1>${projectName}</h1>
        <p>Base lista para convertirla en una aplicacion web real.</p>
        <button id="actionButton">Iniciar</button>
      </section>
      <section id="output" class="output">Sistema listo.</section>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`;
}

function webStyles() {
  return `:root { color-scheme: dark; --ink:#eefcff; --muted:#9fb5c3; --cyan:#6ae7ff; --mint:#54f2bc; }
* { box-sizing: border-box; }
html, body { min-height: 100%; margin: 0; }
body {
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 70% 20%, rgba(84,242,188,.2), transparent 30%), linear-gradient(135deg,#050915,#071b2b);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif;
}
.app { width: min(980px, 92vw); }
.hero { border: 1px solid rgba(106,231,255,.34); border-radius: 8px; padding: clamp(24px, 5vw, 56px); background: rgba(4,14,26,.68); box-shadow: 0 24px 80px rgba(0,0,0,.42); }
.eyebrow { color: var(--mint); text-transform: uppercase; font-size: .78rem; }
h1 { margin: 0; font-size: clamp(2.6rem, 9vw, 6rem); line-height: .9; }
p { color: var(--muted); line-height: 1.6; }
button { min-height: 44px; padding: 0 18px; border: 1px solid rgba(106,231,255,.42); border-radius: 6px; background: rgba(106,231,255,.13); color: var(--ink); cursor: pointer; }
.output { margin-top: 14px; color: var(--mint); }
`;
}

function webApp(projectName) {
  return `const output = document.querySelector("#output");
const button = document.querySelector("#actionButton");
button.addEventListener("click", () => {
  output.textContent = "${projectName} ejecutandose. Siguiente paso: define la funcionalidad principal.";
});
`;
}

function webReadme(projectName) {
  return `# ${projectName}

Proyecto web generado por K.A.I.

## Ejecutar

\`\`\`bash
npm start
\`\`\`

Abre \`http://localhost:3000\`.
`;
}

function staticServer() {
  return `const http = require("http");
const fs = require("fs");
const path = require("path");
const PORT = Number(process.env.PORT || 3000);
const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".mind": "application/octet-stream" };

http.createServer((req, res) => {
  const url = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(__dirname, url);
  if (!file.startsWith(__dirname)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => console.log("WebAR listo en http://localhost:" + PORT));
`;
}

async function createFolder(options = {}) {
  const folderName = safeName(options.name || "nueva-carpeta-kai");
  const base = options.location === "documents" ? DOCUMENTS : DESKTOP;
  const folderPath = ensureAllowed(path.join(base, folderName));
  await fs.mkdir(folderPath, { recursive: true });
  return { ok: true, type: "create-folder", name: folderName, path: folderPath };
}

async function createWebProject(options = {}) {
  const projectName = safeName(options.name || "miwebkai");
  const base = options.location === "documents" ? DOCUMENTS : DESKTOP;
  const projectPath = ensureAllowed(path.join(base, projectName));
  await fs.mkdir(projectPath, { recursive: true });
  await writeFileSafe(path.join(projectPath, "index.html"), webIndex(projectName));
  await writeFileSafe(path.join(projectPath, "styles.css"), webStyles());
  await writeFileSafe(path.join(projectPath, "app.js"), webApp(projectName));
  await writeFileSafe(path.join(projectPath, "README.md"), webReadme(projectName));
  await writeFileSafe(path.join(projectPath, "server.js"), staticServer());
  await writeFileSafe(path.join(projectPath, "package.json"), JSON.stringify({ scripts: { start: "node server.js" }, dependencies: {}, devDependencies: {} }, null, 2));
  const vscode = options.openVSCode === false ? { ok: false, method: "skipped" } : openVSCode(projectPath);
  return { ok: true, type: "create-web-project", projectName, projectPath, vscode, next: [`Ejecuta: cd "${projectPath}" && npm start`, "Abre http://localhost:3000"] };
}

function mindarTutorialText(projectName, defaults) {
  return [
    `Mini tutorial: ${projectName}`,
    "",
    "1. Verifica los archivos",
    `   - Modelo GLB: ${defaults.glb || "cargalo con el boton Cargar GLB"}`,
    `   - Target MindAR: ${defaults.mind || "cargalo con el boton Cargar .mind"}`,
    "",
    "2. Inicia el servidor local",
    "   - Abre una terminal en esta carpeta.",
    "   - Ejecuta: npm start",
    "   - Abre la URL que aparece, normalmente http://localhost:3000",
    "",
    "3. Usa la app",
    "   - Permite el acceso a la camara cuando el navegador lo pida.",
    "   - Si los archivos ya estan precargados, pulsa Iniciar AR.",
    "   - Si quieres cambiarlos, usa Cargar GLB y Cargar .mind.",
    "   - Apunta la camara a la imagen usada para compilar targets.mind.",
    "",
    "4. Si no funciona",
    "   - Confirma que targets.mind corresponde a la imagen que estas apuntando.",
    "   - Usa un servidor local; no abras index.html directamente como file://.",
    "   - Revisa la consola del navegador por errores de camara, permisos o carga del modelo.",
    "   - Prueba desde Chrome o Edge actualizado.",
    "",
    "Creado por K.A.I."
  ].join("\n");
}

async function writeRequestedTextFile(options, projectPath, projectName, defaults) {
  if (!options?.fileName) return null;
  const fileName = safeName(options.fileName).replace(/\.txt$/i, "") + ".txt";
  const target = ensureAllowed(path.join(projectPath, fileName));
  const content = options.kind === "mindar-tutorial"
    ? mindarTutorialText(projectName, defaults)
    : String(options.content || `Notas para ${projectName}`);
  await writeFileSafe(target, content);
  return { ok: true, fileName, target };
}
async function createMindARProject(options = {}) {
  const projectName = safeName(options.name || "mindar-webar");
  const base = options.location === "documents" ? DOCUMENTS : DESKTOP;
  const projectPath = ensureAllowed(path.join(base, projectName));
  await fs.mkdir(path.join(projectPath, "assets"), { recursive: true });

  const copiedGlb = await copyKnownAsset(options.glb, projectPath, "glb");
  const copiedMind = await copyKnownAsset(options.mind, projectPath, "mind");
  const defaults = {
    glb: copiedGlb?.ok ? copiedGlb.relativePath : "",
    mind: copiedMind?.ok ? copiedMind.relativePath : ""
  };

  await writeFileSafe(path.join(projectPath, "index.html"), mindarIndex(projectName));
  await writeFileSafe(path.join(projectPath, "styles.css"), mindarStyles());
  await writeFileSafe(path.join(projectPath, "app.js"), mindarApp(defaults));
  await writeFileSafe(path.join(projectPath, "README.md"), mindarReadme(projectName));
  await writeFileSafe(path.join(projectPath, "server.js"), staticServer());
  await writeFileSafe(path.join(projectPath, "package.json"), JSON.stringify({
    scripts: { start: "node server.js" },
    dependencies: {},
    devDependencies: {}
  }, null, 2));
  const assetReport = [
    `# Assets copiados por K.A.I.`,
    "",
    copiedGlb?.ok ? `- GLB: ${copiedGlb.source} -> ${copiedGlb.target}` : `- GLB: ${copiedGlb?.warning || "No solicitado"}`,
    copiedMind?.ok ? `- MIND: ${copiedMind.source} -> ${copiedMind.target}` : `- MIND: ${copiedMind?.warning || "No solicitado"}`,
    "",
    `Defaults en app.js:`,
    `- DEFAULT_GLB: ${defaults.glb || "pendiente"}`,
    `- DEFAULT_MIND: ${defaults.mind || "pendiente"}`
  ].join("\n");

  await writeFileSafe(path.join(projectPath, "assets", "README.md"), [
    "Puedes guardar aqui tus archivos .glb y .mind, aunque la app tambien permite cargarlos con botones.",
    copiedGlb?.ok ? `GLB copiado: ${copiedGlb.fileName}` : "GLB pendiente: usa el boton Cargar GLB o copia tu modelo aqui.",
    copiedMind?.ok ? `MIND copiado: ${copiedMind.fileName}` : "MIND pendiente: usa el boton Cargar .mind o copia tu target aqui."
  ].join("\n"));
  await writeFileSafe(path.join(projectPath, "KAI_ASSETS.md"), assetReport);
  const textFile = await writeRequestedTextFile(options.textFile, projectPath, projectName, defaults);

  const server = options.startServer ? await launchProject(projectPath) : null;
  const browser = options.openBrowser && !server ? openBrowser(`http://127.0.0.1:3000`) : server?.browser || null;
  const vscode = options.openVSCode === false ? { ok: false, method: "skipped" } : openVSCode(projectPath);
  const nextUrl = server?.url || "http://localhost:3000";

  return {
    ok: true,
    type: "create-mindar-project",
    projectName,
    projectPath,
    assets: { glb: copiedGlb, mind: copiedMind },
    defaults,
    server,
    textFile,
    browser,
    vscode,
    next: [
      server ? `Servidor iniciado: ${nextUrl}` : `Ejecuta: cd "${projectPath}" && npm start`,
      `Abre ${nextUrl}`,
      copiedGlb?.ok && copiedMind?.ok ? "Assets copiados y precargados." : "Revisa assets faltantes en el resultado."
    ]
  };
}
async function createARProject(options = {}) {
  const projectName = safeName(options.name || "miprimerawebar");
  const base = options.location === "documents" ? DOCUMENTS : DESKTOP;
  const projectPath = ensureAllowed(path.join(base, projectName));
  await fs.mkdir(path.join(projectPath, "assets"), { recursive: true });

  await writeFileSafe(path.join(projectPath, "index.html"), arIndex(projectName));
  await writeFileSafe(path.join(projectPath, "styles.css"), arStyles());
  await writeFileSafe(path.join(projectPath, "app.js"), arApp());
  await writeFileSafe(path.join(projectPath, "README.md"), arReadme(projectName));
  await writeFileSafe(path.join(projectPath, "server.js"), staticServer());
  await writeFileSafe(path.join(projectPath, "package.json"), JSON.stringify({
    scripts: { start: "node server.js" },
    dependencies: {},
    devDependencies: {}
  }, null, 2));
  await writeFileSafe(path.join(projectPath, "assets", "README.md"), "Coloca aqui tu modelo como model.glb.\n");

  const vscode = options.openVSCode === false ? { ok: false, method: "skipped" } : openVSCode(projectPath);
  return {
    ok: true,
    type: "create-ar-project",
    projectName,
    projectPath,
    vscode,
    next: [
      `Coloca un GLB en ${path.join(projectPath, "assets", "model.glb")}`,
      `Ejecuta: cd "${projectPath}" && npm start`,
      "Abre http://localhost:3000"
    ]
  };
}


function recognizeSpeechOnce(options = {}) {
  return new Promise((resolve) => {
    const seconds = Math.max(3, Math.min(15, Number(options.seconds) || 8));
    const script = `
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$recognizerInfo = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | Where-Object { $_.Culture.Name -eq "es-ES" } | Select-Object -First 1
if (-not $recognizerInfo) { $recognizerInfo = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | Select-Object -First 1 }
if (-not $recognizerInfo) { throw "No hay reconocedores de voz instalados en Windows." }
$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine -ArgumentList $recognizerInfo
$grammar = New-Object System.Speech.Recognition.DictationGrammar
$recognizer.LoadGrammar($grammar)
$recognizer.SetInputToDefaultAudioDevice()
$result = $recognizer.Recognize([TimeSpan]::FromSeconds(${seconds}))
if ($result -and $result.Text) {
  ConvertTo-Json @{ ok = $true; text = $result.Text; confidence = $result.Confidence; culture = $recognizer.RecognizerInfo.Culture.Name } -Compress
} else {
  ConvertTo-Json @{ ok = $false; text = ""; error = "No escuche una frase clara."; culture = $recognizer.RecognizerInfo.Culture.Name } -Compress
}
$recognizer.Dispose()
`;

    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
      cwd: ROOT,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, text: "", error: "Tiempo de escucha agotado." });
    }, (seconds + 7) * 1000);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, text: "", error: error.message });
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || "{}";
        const data = JSON.parse(line);
        resolve(data);
      } catch {
        resolve({ ok: false, text: "", error: (stderr || stdout || "Windows Speech no devolvio texto.").trim() });
      }
    });
  });
}
async function handleAPI(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.url === "/api/status") {
    return json(res, 200, {
      ok: true,
      name: "K.A.I. Local Bridge",
      port: PORT,
      root: ROOT,
      desktop: DESKTOP,
      allowedActions: ["create-folder", "create-web-project", "create-ar-project", "create-mindar-project", "open-vscode", "open-voice-browser", "recognize-speech"]
    });
  }
  if (req.url === "/api/action" && req.method === "POST") {
    const body = await readBody(req);
    if (body.action === "create-folder") return json(res, 200, await createFolder(body));
    if (body.action === "create-web-project") return json(res, 200, await createWebProject(body));
    if (body.action === "create-ar-project") return json(res, 200, await createARProject(body));
    if (body.action === "create-mindar-project") return json(res, 200, await createMindARProject(body));
    if (body.action === "recognize-speech") return json(res, 200, await recognizeSpeechOnce(body));
    if (body.action === "open-voice-browser") return json(res, 200, { ok: true, url: `${BRIDGE_URL}/index.html`, browser: openBrowser(`${BRIDGE_URL}/index.html`) });
    if (body.action === "open-vscode") {
      const target = ensureAllowed(body.path || ROOT);
      return json(res, 200, { ok: true, target, vscode: openVSCode(target) });
    }
    return json(res, 400, { ok: false, error: `Accion no permitida: ${body.action}` });
  }
  return false;
}

async function serveStatic(req, res) {
  const cleanUrl = decodeURIComponent(req.url.split("?")[0]);
  const relative = cleanUrl === "/" ? "index.html" : cleanUrl.replace(/^\/+/, "");
  const file = ensureAllowed(path.join(ROOT, relative));
  if (!file.toLowerCase().startsWith(ROOT.toLowerCase())) return json(res, 403, { ok: false, error: "Forbidden" });
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(data);
  } catch {
    json(res, 404, { ok: false, error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const handled = await handleAPI(req, res);
    if (handled === false) await serveStatic(req, res);
  } catch (error) {
    json(res, 500, { ok: false, error: error.message });
  }
});

function startBridge() {
  return new Promise((resolve, reject) => {
    if (server.listening) {
      resolve({ ok: true, port: PORT, reused: true });
      return;
    }
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => {
      server.off("error", reject);
      console.log(`K.A.I. bridge activo en http://127.0.0.1:${PORT}`);
      console.log(`HUD: http://127.0.0.1:${PORT}/index.html`);
      if (process.argv.includes("--open")) openBrowser(`${BRIDGE_URL}/index.html`);
      resolve({ ok: true, port: PORT, reused: false });
    });
  });
}

if (require.main === module) {
  startBridge().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { startBridge, PORT };



























