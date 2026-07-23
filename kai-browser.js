const http = require("http");
const { spawn } = require("child_process");

const PORT = Number(process.env.KAI_BRIDGE_PORT || process.env.JARVIS_BRIDGE_PORT || 8765);
const URL = `http://127.0.0.1:${PORT}/index.html`;

function openBrowser(url) {
  const child = spawn("cmd", ["/c", "start", "", url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
}

function bridgeOnline() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/api/status`, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.setTimeout(900, () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

async function main() {
  if (await bridgeOnline()) {
    openBrowser(URL);
    console.log(`K.A.I. ya estaba activo. Abriendo ${URL}`);
    return;
  }

  const { startBridge } = require("./kai-bridge");
  await startBridge();
  openBrowser(URL);
  console.log(`K.A.I. modo voz rapida: ${URL}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});



