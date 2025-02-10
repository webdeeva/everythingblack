const { app, BrowserWindow, ipcMain, webContents } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'Everything Black Browser',
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            devTools: true
        }
    });

    // Enable dev tools for webviews
    app.on('web-contents-created', (event, contents) => {
        if (contents.getType() === 'webview') {
            contents.on('dom-ready', () => {
                contents.setWebRTCIPHandlingPolicy('default_public_interface_only');
            });
            contents.on('devtools-opened', () => {
                contents.devToolsWebContents?.focus();
            });
        }
    });

    // Enable dev tools globally
    app.commandLine.appendSwitch('auto-detect-utf8', 'true');
    app.commandLine.appendSwitch('enable-features', 'NetworkService,NetworkServiceInProcess');

    mainWindow.loadFile('index.html');
    
    // Handle window state
    let windowState = {
        x: undefined,
        y: undefined,
        width: 1280,
        height: 800,
        isMaximized: false
    };

    // Load saved window state
    const savedState = store.get('windowState');
    if (savedState) {
        windowState = savedState;
        mainWindow.setBounds({
            x: windowState.x,
            y: windowState.y,
            width: windowState.width,
            height: windowState.height
        });
        if (windowState.isMaximized) {
            mainWindow.maximize();
        }
    }

    // Save window state on changes
    const saveState = () => {
        if (!mainWindow.isMaximized()) {
            const bounds = mainWindow.getBounds();
            windowState.x = bounds.x;
            windowState.y = bounds.y;
            windowState.width = bounds.width;
            windowState.height = bounds.height;
        }
        windowState.isMaximized = mainWindow.isMaximized();
        store.set('windowState', windowState);
    };

    mainWindow.on('resize', saveState);
    mainWindow.on('move', saveState);
    mainWindow.on('close', saveState);
}

// Handle bookmarks
const defaultBookmarks = {
    'favorites-bar': [],
    'tech': [],
    'government': [],
    'business': [],
    'social': [],
    'lifestyle': [],
    'family': [],
    'shopping': [],
    'health': [],
    'finance': []
};

let bookmarks = store.get('bookmarks') || defaultBookmarks;

ipcMain.on('add-bookmark', (event, { folder, bookmark }) => {
    if (!bookmarks[folder]) {
        bookmarks[folder] = [];
    }
    
    // Remove bookmark if it exists in any folder
    Object.keys(bookmarks).forEach(f => {
        bookmarks[f] = bookmarks[f].filter(b => b.url !== bookmark.url);
    });
    
    // Add to selected folder
    bookmarks[folder].push(bookmark);
    store.set('bookmarks', bookmarks);
});

ipcMain.on('remove-bookmark', (event, url) => {
    Object.keys(bookmarks).forEach(folder => {
        bookmarks[folder] = bookmarks[folder].filter(b => b.url !== url);
    });
    store.set('bookmarks', bookmarks);
});

ipcMain.on('get-bookmarks', (event) => {
    event.reply('bookmarks', bookmarks);
});

// Handle history
let history = store.get('history') || [];

ipcMain.on('add-history', (event, url) => {
    history.unshift({
        url,
        timestamp: Date.now()
    });
    history = history.slice(0, 100); // Keep last 100 entries
    store.set('history', history);
});

ipcMain.on('get-history', (event) => {
    event.reply('history', history);
});

// Handle devtools
ipcMain.on('toggle-devtools', (event) => {
    const sender = event.sender;
    if (sender.isDevToolsOpened()) {
        sender.closeDevTools();
    } else {
        sender.openDevTools({ mode: 'right' });
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// Window control handlers
ipcMain.on('window-control', (event, command) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    switch (command) {
        case 'minimize':
            win.minimize();
            break;
        case 'maximize':
            if (win.isMaximized()) {
                win.unmaximize();
                event.reply('window-maximized', false);
            } else {
                win.maximize();
                event.reply('window-maximized', true);
            }
            break;
        case 'close':
            win.close();
            break;
    }
});
