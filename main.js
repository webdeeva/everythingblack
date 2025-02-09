const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true,
            webSecurity: true,
            allowRunningInsecureContent: false
        }
    });

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
let bookmarks = new Set(store.get('bookmarks') || []);

ipcMain.on('add-bookmark', (event, url) => {
    bookmarks.add(url);
    store.set('bookmarks', Array.from(bookmarks));
});

ipcMain.on('remove-bookmark', (event, url) => {
    bookmarks.delete(url);
    store.set('bookmarks', Array.from(bookmarks));
});

ipcMain.on('get-bookmarks', (event) => {
    event.reply('bookmarks', Array.from(bookmarks));
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

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
