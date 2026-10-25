// Desktop shell: serves the built game from an app:// origin (ES modules need a real origin) and opens
// one dark window (menu-less except macOS's minimal app menu, so Cmd+Q/H/M work). F11, Alt+Enter and
// Cmd+Ctrl+F toggle fullscreen while the window has focus; the game itself handles everything else.
const { app, BrowserWindow, protocol, net, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Smoke tests attach over CDP: BR_DEBUG_PORT=9471 open the app binary directly. BR_SMOKE=1 keeps the window
// off-screen and unfocused (still rendering) so a test run doesn't interrupt whoever is using the machine.
if (process.env.BR_DEBUG_PORT) app.commandLine.appendSwitch('remote-debugging-port', process.env.BR_DEBUG_PORT);
const SMOKE = process.env.BR_SMOKE === '1';
if (SMOKE) app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const DIST = path.join(__dirname, 'dist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 600, backgroundColor: '#0b0b0f',
    title: '暴力鹈鹕 BEAK RASH', autoHideMenuBar: true, show: false, ...(SMOKE ? { x: -4000, y: -4000 } : {}),
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.once('ready-to-show', () => (SMOKE ? win.showInactive() : win.show()));
  win.loadURL('app://game/index.html');
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    if (key === 'f11' || (input.alt && key === 'enter') || (input.meta && input.control && key === 'f')) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(process.platform === 'darwin'
    ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }])
    : null);
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(DIST, rel));
    if (!file.startsWith(DIST)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());
