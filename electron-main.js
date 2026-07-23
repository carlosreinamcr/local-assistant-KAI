const { app, BrowserWindow, shell, session } = require("electron");
const http = require("http");
const path = require("path");

const BRIDGE_PORT = Number(process.env.KAI_BRIDGE_PORT || process.env.JARVIS_BRIDGE_PORT || 8765);
const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}`;
const ROOT = __dirname;
let mainWindow = null;
const allowedMediaPermissions = new Set(["media", "audioCapture", "videoCapture", "audioinput", "videoinput"]);

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

function isJarvisOrigin(url = "") {
  return url.startsWith(BRIDGE_URL) || url.startsWith("file://");
}

function configureDesktopPermissions() {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details?.requestingUrl || webContents.getURL();
    callback(allowedMediaPermissions.has(permission) && isJarvisOrigin(requestingUrl));
  });

  defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const origin = requestingOrigin || webContents?.getURL?.() || "";
    return allowedMediaPermissions.has(permission) && isJarvisOrigin(origin);
  });

  if (typeof defaultSession.setDevicePermissionHandler === "function") {
    defaultSession.setDevicePermissionHandler((details) => {
      return ["media", "audioinput", "videoinput"].includes(details.deviceType) && isJarvisOrigin(details.origin || "");
    });
  }
}

function requestStatus() {
  return new Promise((resolve) => {
    const req = http.get(`${BRIDGE_URL}/api/status`, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          resolve(Boolean(data.ok));
        } catch {
          resolve(false);
        }
      });
    });
    req.setTimeout(900, () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

async function waitForBridge(timeoutMs = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await requestStatus()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function ensureBridge() {
  if (await requestStatus()) return { reused: true, online: true };
  const { startBridge } = require("./kai-bridge");
  await startBridge();
  const online = await waitForBridge();
  return { reused: false, online };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: "#03050b",
    title: "K.A.I. Desktop",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(ROOT, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(BRIDGE_URL)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(`${BRIDGE_URL}/index.html`);
}

app.setAppUserModelId("local.kai.desktop");

app.whenReady().then(async () => {
  configureDesktopPermissions();
  const bridge = await ensureBridge();
  if (!bridge.online && !bridge.reused) {
    console.error("No pude iniciar el puente local de K.A.I.");
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});






