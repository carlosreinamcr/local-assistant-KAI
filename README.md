# K.A.I. - Knowledge Augmented Interface

K.A.I. is a local, futuristic assistant cockpit built with JavaScript. It combines a fast browser voice interface, a visual HUD, local memory, Gemini-powered reasoning, and a Node.js bridge that can perform approved real actions on the computer.

K.A.I. started as a AI-assistant local assistant experiment. The current direction is intentionally hybrid:

```text
Browser / Chrome / Edge
- Fast speech recognition
- Visual cockpit
- Commands and conversation
- Gemini AI responses

Node local bridge
- Create folders
- Copy files
- Generate projects
- Open local apps such as VS Code
- Run only approved safe actions

Optional Electron shell
- Desktop wrapper and future native panels
- Not recommended as the main voice engine yet
```

## Espanol

### Que hace K.A.I.

K.A.I. permite controlar una cabina local desde texto o voz y convertir ordenes en acciones reales cuando el puente Node esta activo.

Funciones actuales:

- HUD futurista con particulas, nucleo visual, telemetria y paneles.
- Voz rapida en navegador usando Web Speech API de Chrome/Edge.
- Consola central para escribir ordenes largas.
- Respuestas habladas con boton para parar audio.
- Memoria local con notas, tareas y datos recordados.
- Temporizadores, diagnostico, estado del sistema y bitacora.
- Consultas de clima con Open-Meteo.
- Resumenes desde Wikipedia.
- Busquedas web y apertura de sitios.
- Lectura basica de archivos de texto seleccionados por el usuario.
- Exportacion de bitacora en JSON.
- Paneles externos sincronizados: dashboard, mision, bitacora y datos.
- IA opcional con Google Gemini.
- Modo agente para convertir prompts abiertos en planes estructurados.
- Puente Node para acciones reales permitidas en el PC.
- Creacion de carpetas en Escritorio o Documentos.
- Apertura real de Visual Studio Code.
- Creacion de proyectos web basicos.
- Creacion de proyectos WebAR con GLB.
- Creacion de proyectos MindAR con Three.js, GLB y archivo `.mind`.
- Copia de assets como `.glb` desde Escritorio y `.mind` desde Descargas cuando el prompt lo indique.
- Arranque de servidores locales para proyectos generados.

### Como usar

Instala dependencias:

```bash
npm install
```

Inicia K.A.I. en modo recomendado:

```bash
npm start
```

Esto levanta el puente local en `http://127.0.0.1:8765` y abre la interfaz en el navegador. Esta es la mejor experiencia de voz porque Chrome/Edge tiene reconocimiento rapido.

Scripts disponibles:

```bash
npm start          # modo navegador rapido + puente Node
npm run browser    # igual que npm start
npm run bridge     # solo levanta el puente local
npm run electron   # abre el wrapper Electron opcional
npm run desktop    # alias de Electron
```

### Comandos de ejemplo

```text
ayuda
diagnostico
sistema
internet
clima Bogota
wiki Nikola Tesla
buscar tutorial JavaScript
abrir youtube
calcula 18*(7+3)
nota guardar llamar al cliente mañana
notas
tarea agregar revisar demo de KAI
tareas
recuerda que proyecto = KAI
memoria
temporizador 5 minutos
leer archivo
exportar bitacora
para audio
modo enfoque
modo escaneo
abrir paneles
estado puente local
abre visual studio code
crea una carpeta en mi escritorio que se llame DemoKAI
crear proyecto ar miprimerawebar
crea una carpeta en mi escritorio que se llame RealidadAumentada1 dentro de ella crea una aplicacion de realidad aumentada utilizando MindAR y copia Kai.glb desde mi escritorio y targets.mind desde descargas
```

### Gemini IA

K.A.I. puede usar Google Gemini para responder, explicar, investigar, planear y convertir ordenes abiertas en planes. Pega tu API key en `MENU > Nucleo IA > KEY`, o escribe:

```text
api key TU_CLAVE
modelo ia gemini-3.6-flash
probar ia
```

La clave queda guardada en `localStorage` de esa ventana/origen. Para una version publica, se recomienda mover las llamadas de Gemini a backend o a un servicio local seguro.

### Seguridad

El navegador no puede tocar libremente el disco por seguridad. K.A.I. usa un puente Node local que solo expone acciones permitidas. El puente limita rutas a Escritorio, Documentos, Descargas y la carpeta del proyecto.

No subas API keys a GitHub. Este repositorio no debe contener claves privadas.

### Electron

Electron queda como wrapper opcional. En este momento no es la ruta principal para voz porque su reconocimiento no es tan rapido ni confiable como Chrome/Edge. La arquitectura recomendada es navegador para voz + Node para acciones reales.

## English

### What K.A.I. Does

K.A.I. is a local assistant cockpit that can receive text or voice commands and execute real approved computer actions through a local Node.js bridge.

Current features:

- Futuristic animated HUD with visual core, particles, telemetry and panels.
- Fast browser voice recognition through Chrome/Edge Web Speech API.
- Central command console for long instructions.
- Spoken responses with a stop-audio control.
- Local memory with notes, tasks and saved facts.
- Timers, diagnostics, system information and activity log.
- Weather queries through Open-Meteo.
- Wikipedia summaries.
- Web search and site opening commands.
- Basic user-selected text file analysis.
- JSON activity log export.
- Synced external panels: dashboard, mission, log and data.
- Optional Google Gemini AI.
- Agent mode that converts broad prompts into structured plans.
- Local Node bridge for approved real PC actions.
- Folder creation on Desktop or Documents.
- Real Visual Studio Code launching.
- Basic web project generation.
- WebAR project generation with GLB support.
- MindAR + Three.js project generation with GLB and `.mind` asset support.
- Asset copying from Desktop/Downloads when requested.
- Local server startup for generated projects.

### How to Run

Install dependencies:

```bash
npm install
```

Start the recommended mode:

```bash
npm start
```

This starts the local bridge at `http://127.0.0.1:8765` and opens the browser interface. This is the best voice experience because Chrome/Edge provide fast speech recognition.

Available scripts:

```bash
npm start          # fast browser mode + Node bridge
npm run browser    # same as npm start
npm run bridge     # local bridge only
npm run electron   # optional Electron wrapper
npm run desktop    # Electron alias
```

### Example Commands

```text
help
diagnostics
system
internet
weather Bogota
wiki Nikola Tesla
search JavaScript tutorial
open youtube
calculate 18*(7+3)
save note call the client tomorrow
tasks
remember project = KAI
timer 5 minutes
read file
export log
stop audio
focus mode
scan mode
open panels
local bridge status
open visual studio code
create a folder on my desktop called DemoKAI
create AR project miprimerawebar
create a folder on my desktop called RealidadAumentada1 and inside it build a MindAR augmented reality app, copy Kai.glb from my desktop and targets.mind from downloads
```

Some commands are currently optimized for Spanish because the assistant was built in Spanish first. Contributions to improve English command parsing are welcome.

### Gemini AI

K.A.I. can use Google Gemini for conversation, explanations, research, planning and agent mode. Add your API key in `MENU > AI Core > KEY`, or type:

```text
api key YOUR_KEY
modelo ia gemini-3.6-flash
test ia
```

The key is stored in browser `localStorage` for that specific origin/window. For public deployments, move Gemini calls to a backend or trusted local service.

### Security

Browsers cannot freely access your filesystem, and that is good. K.A.I. uses a local Node bridge with a small allowlist of actions. The bridge limits filesystem access to Desktop, Documents, Downloads and the project directory.

Do not commit API keys to GitHub. This project should not include private credentials.

### Electron

Electron is included as an optional wrapper and future native UI layer. It is not currently recommended as the main voice engine because Chrome/Edge speech recognition is faster and more reliable.

## Project Structure

```text
index.html          Main cockpit UI
styles.css          HUD visual system
app.js              Core UI, voice, speech synthesis and command shell
actions.js          Local browser actions, notes, tasks, timers and diagnostics
kai-ai.js        Gemini AI layer and advanced assistant commands
bridge-client.js    Browser client for the local Node bridge
kai-bridge.js    Local Node server and approved PC actions
kai-browser.js   Recommended launcher: bridge + browser
kai-windows.js   Multi-window panels and fullscreen helpers
panel.html          External panel UI
panel.js            External panel synchronization
main/preload files  Optional Electron wrapper
```

The main public files now use the `kai-*` prefix. Some internal browser globals and storage keys may still keep legacy names for compatibility with earlier local data.

## Contributing

Good next steps for the community:

- Improve English command parsing.
- Add more safe bridge skills.
- Add confirmation flows for risky actions.
- Add a plugin system for new tools.
- Add tests for command parsing and bridge actions.
- Improve the UI accessibility and mobile layout.
- Add packaged releases.

## License

No license has been selected yet. Choose a license before publishing if you want others to reuse, modify or distribute the code.


