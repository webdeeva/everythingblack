const { ipcRenderer } = require('electron');
let web3Instance;

(async () => {
    const Web3 = (await import('web3')).default;
    web3Instance = Web3;
})();

class Browser {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.web3 = null;
        this.customRPC = '';
        this.chainId = '';
        this.explorerUrl = '';
        this.bookmarks = {
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
        
        this.initializeElements();
        this.setupEventListeners();
        this.createNewTab();
        this.loadBookmarks();
    }

    initializeElements() {
        // Navigation controls
        this.urlBar = document.getElementById('url-bar');
        this.urlLock = document.getElementById('url-lock');
        this.backBtn = document.getElementById('back-button');
        this.forwardBtn = document.getElementById('forward-button');
        this.refreshBtn = document.getElementById('refresh-button');
        this.goBtn = document.getElementById('go-button');
        this.devToolsBtn = document.getElementById('devtools-button');
        this.bookmarkBtn = document.getElementById('bookmark-button');
        
        // Tab controls
        this.newTabBtn = document.getElementById('new-tab-button');
        this.tabsContainer = document.getElementById('tabs-container');
        this.webviewsContainer = document.querySelector('.webview-wrapper');

        // Sidebar controls
        this.sidebar = document.querySelector('.sidebar');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        
        // Sidebar panels
        this.bookmarksPanel = document.getElementById('bookmarks-panel');
        this.historyPanel = document.getElementById('history-panel');
        this.web3Panel = document.getElementById('web3-panel');
        
        // Web3 elements
        this.connectWalletBtn = document.getElementById('connect-wallet');
        this.walletInfo = document.getElementById('wallet-info');
        this.rpcInput = document.getElementById('rpc-url');
        this.chainIdInput = document.getElementById('chain-id');
        this.explorerInput = document.getElementById('explorer-url');
        this.updateNetworkBtn = document.getElementById('update-network');

        // Bookmark elements
        this.bookmarkDropdown = document.getElementById('bookmark-dropdown');
        this.addBookmarkBtn = document.getElementById('add-bookmark-btn');
        this.favoritesBar = document.getElementById('favorites-bar');
    }

    setupEventListeners() {
        // Navigation events
        this.backBtn.addEventListener('click', () => this.getActiveWebview()?.goBack());
        this.forwardBtn.addEventListener('click', () => this.getActiveWebview()?.goForward());
        this.refreshBtn.addEventListener('click', () => this.getActiveWebview()?.reload());
        this.goBtn.addEventListener('click', () => this.navigateToUrl());
        this.urlBar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.navigateToUrl();
        });

        // Sidebar toggle event
        this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());

        // DevTools event
        this.devToolsBtn.addEventListener('click', () => {
            const webview = this.getActiveWebview();
            if (webview) {
                try {
                    webview.inspectElement(0, 0);
                } catch (e) {
                    console.error('DevTools error:', e);
                }
            }
        });

        // Bookmark events
        this.bookmarkBtn.addEventListener('click', () => this.toggleBookmark());
        this.addBookmarkBtn.addEventListener('click', () => this.addBookmark());

        // Close bookmark dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#bookmark-dropdown') && 
                !e.target.closest('#bookmark-button')) {
                this.bookmarkDropdown.classList.remove('visible');
            }
        });

        // Tab events
        this.newTabBtn.addEventListener('click', () => this.createNewTab());

        // Sidebar toggle events
        document.getElementById('toggle-bookmarks').addEventListener('click', () => {
            this.togglePanel(this.bookmarksPanel);
            this.loadBookmarks();
        });
        document.getElementById('toggle-history').addEventListener('click', () => {
            this.togglePanel(this.historyPanel);
            this.loadHistory();
        });
        document.getElementById('toggle-web3').addEventListener('click', () => {
            this.togglePanel(this.web3Panel);
        });

        // Web3 events
        this.connectWalletBtn.addEventListener('click', () => this.connectWallet());
        this.updateNetworkBtn.addEventListener('click', () => this.updateNetwork());
    }

    createNewTab(url = 'welcome.html') {
        const tabId = 'tab-' + Date.now();
        
        // Create tab element
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.setAttribute('data-tab-id', tabId);
        tab.innerHTML = `
            <span class="tab-title">New Tab</span>
            <button class="tab-close"><i class="fas fa-times"></i></button>
        `;
        
        // Create webview
        const webview = document.createElement('webview');
        webview.setAttribute('id', tabId);
        webview.setAttribute('src', url);
        webview.setAttribute('autosize', 'on');
        webview.setAttribute('nodeintegration', 'on');
        webview.setAttribute('webpreferences', 'javascript=yes, plugins=yes');
        webview.setAttribute('allowpopups', 'yes');
        webview.setAttribute('preload', 'preload.js');
        webview.style.minWidth = '900px';
        webview.style.minHeight = '600px';
        
        // Add event listeners
        tab.addEventListener('click', () => this.activateTab(tabId));
        tab.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tabId);
        });
        
        webview.addEventListener('page-title-updated', (e) => {
            tab.querySelector('.tab-title').textContent = e.title;
        });
        
        webview.addEventListener('did-navigate', (e) => {
            this.urlBar.value = e.url;
            ipcRenderer.send('add-history', e.url);
            this.updateBookmarkButton(e.url);
            this.updateUrlLock(e.url);
        });

        webview.addEventListener('did-navigate-in-page', (e) => {
            this.urlBar.value = e.url;
            this.updateUrlLock(e.url);
        });

        // Append elements
        this.tabsContainer.appendChild(tab);
        this.webviewsContainer.appendChild(webview);
        
        // Store tab info
        this.tabs.push({ id: tabId, url });
        
        // Activate the new tab
        this.activateTab(tabId);
    }

    activateTab(tabId) {
        // Deactivate current tab
        document.querySelector('.tab.active')?.classList.remove('active');
        document.querySelector('webview.active')?.classList.remove('active');
        
        // Activate new tab
        document.querySelector(`[data-tab-id="${tabId}"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');
        
        this.activeTabId = tabId;
        const webview = this.getActiveWebview();
        this.urlBar.value = webview.getURL();
        this.updateBookmarkButton(webview.getURL());
    }

    closeTab(tabId) {
        const tabIndex = this.tabs.findIndex(tab => tab.id === tabId);
        if (tabIndex === -1) return;
        
        // Remove elements
        document.querySelector(`[data-tab-id="${tabId}"]`).remove();
        document.getElementById(tabId).remove();
        
        // Update tabs array
        this.tabs.splice(tabIndex, 1);
        
        // If closing active tab, activate another tab
        if (this.activeTabId === tabId) {
            const newActiveTab = this.tabs[Math.max(0, tabIndex - 1)];
            if (newActiveTab) {
                this.activateTab(newActiveTab.id);
            } else {
                this.createNewTab();
            }
        }
    }

    getActiveWebview() {
        return document.getElementById(this.activeTabId);
    }

    navigateToUrl() {
        let url = this.urlBar.value;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        this.getActiveWebview().loadURL(url);
        this.updateUrlLock(url);
    }

    updateUrlLock(url) {
        if (url.startsWith('https://')) {
            this.urlLock.classList.add('visible');
        } else {
            this.urlLock.classList.remove('visible');
        }
    }

    togglePanel(panel) {
        // If sidebar is collapsed, expand it first
        if (this.sidebar.classList.contains('collapsed')) {
            this.sidebar.classList.remove('collapsed');
            this.sidebar.classList.add('expanded');
        }
        
        const wasActive = panel.classList.contains('active');
        // Hide all panels
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        // Show clicked panel if it wasn't active
        if (!wasActive) {
            panel.classList.add('active');
        }
    }

    toggleSidebar() {
        this.sidebar.classList.toggle('collapsed');
        this.sidebar.classList.toggle('expanded');
        
        // Hide all panels when collapsing
        if (this.sidebar.classList.contains('collapsed')) {
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        }
    }

    async toggleBookmark() {
        const dropdown = document.getElementById('bookmark-dropdown');
        const webview = this.getActiveWebview();
        const url = webview.getURL();
        const title = webview.getTitle() || url;
        
        // Toggle dropdown visibility
        if (dropdown.classList.contains('visible')) {
            dropdown.classList.remove('visible');
        } else {
            dropdown.classList.add('visible');
            document.getElementById('bookmark-name').value = title;
            
            // Get favicon
            try {
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`;
                this.currentFavicon = faviconUrl;
            } catch (e) {
                this.currentFavicon = null;
            }
        }
    }

    updateBookmarkButton(url) {
        let isBookmarked = false;
        for (const folder in this.bookmarks) {
            if (this.bookmarks[folder] && Array.isArray(this.bookmarks[folder]) && 
                this.bookmarks[folder].some(b => b.url === url)) {
                isBookmarked = true;
                break;
            }
        }
        
        if (isBookmarked) {
            this.bookmarkBtn.classList.add('active');
        } else {
            this.bookmarkBtn.classList.remove('active');
        }
    }

    addBookmark() {
        const webview = this.getActiveWebview();
        const url = webview.getURL();
        const name = document.getElementById('bookmark-name').value;
        const folder = document.getElementById('bookmark-folder').value;
        
        const bookmark = {
            url,
            name,
            favicon: this.currentFavicon
        };
        
        // Initialize folder if it doesn't exist
        if (!this.bookmarks[folder]) {
            this.bookmarks[folder] = [];
        }
        
        // Remove existing bookmark with same URL from any folder
        Object.keys(this.bookmarks).forEach(f => {
            if (this.bookmarks[f] && Array.isArray(this.bookmarks[f])) {
                this.bookmarks[f] = this.bookmarks[f].filter(b => b.url !== url);
            }
        });
        
        // Add new bookmark
        this.bookmarks[folder].push(bookmark);
        ipcRenderer.send('add-bookmark', { folder, bookmark });
        
        document.getElementById('bookmark-dropdown').classList.remove('visible');
        this.updateBookmarkButton(url);
        this.updateFavoritesBar();
        this.loadBookmarks();
    }

    updateFavoritesBar() {
        const favoritesBar = document.getElementById('favorites-bar');
        favoritesBar.innerHTML = '';
        
        const visibleItems = [];
        const overflowItems = [];
        let totalWidth = 0;
        const maxBarWidth = favoritesBar.offsetWidth - 50; // Leave space for overflow button
        
        // Create and measure items
        if (this.bookmarks['favorites-bar'] && Array.isArray(this.bookmarks['favorites-bar'])) {
            this.bookmarks['favorites-bar'].forEach(bookmark => {
                const item = document.createElement('div');
                item.className = 'favorite-item';
                item.innerHTML = `
                    ${bookmark.favicon ? `<img src="${bookmark.favicon}" alt="">` : ''}
                    <span>${bookmark.name}</span>
                `;
                item.onclick = () => this.createNewTab(bookmark.url);
                
                // Temporarily add to measure
                favoritesBar.appendChild(item);
                const itemWidth = item.offsetWidth;
                favoritesBar.removeChild(item);
                
                if (totalWidth + itemWidth <= maxBarWidth) {
                    visibleItems.push(item);
                    totalWidth += itemWidth + 5; // 5px for gap
                } else {
                    overflowItems.push(bookmark);
                }
            });
        }
        
        // Add visible items
        visibleItems.forEach(item => favoritesBar.appendChild(item));
        
        // Add overflow button if needed
        if (overflowItems.length > 0) {
            const overflowButton = document.createElement('div');
            overflowButton.className = 'favorites-overflow';
            overflowButton.innerHTML = `
                <i class="fas fa-chevron-double-right"></i>
                <div class="favorites-overflow-dropdown"></div>
            `;
            
            const dropdown = overflowButton.querySelector('.favorites-overflow-dropdown');
            overflowItems.forEach(bookmark => {
                const item = document.createElement('div');
                item.className = 'favorite-item';
                item.innerHTML = `
                    ${bookmark.favicon ? `<img src="${bookmark.favicon}" alt="">` : ''}
                    <span>${bookmark.name}</span>
                `;
                item.onclick = () => this.createNewTab(bookmark.url);
                dropdown.appendChild(item);
            });
            
            favoritesBar.appendChild(overflowButton);
        }
        
        // Add folder items
        Object.keys(this.bookmarks).forEach(folder => {
            if (folder === 'favorites-bar') return;
            
            if (this.bookmarks[folder] && Array.isArray(this.bookmarks[folder]) && 
                this.bookmarks[folder].length > 0) {
                const folderItem = document.createElement('div');
                folderItem.className = 'favorite-item favorite-folder';
                folderItem.innerHTML = `
                    <i class="fas fa-folder"></i>
                    <span>${folder.charAt(0).toUpperCase() + folder.slice(1)}</span>
                    <div class="folder-dropdown"></div>
                `;
                
                const dropdown = folderItem.querySelector('.folder-dropdown');
                this.bookmarks[folder].forEach(bookmark => {
                    const item = document.createElement('div');
                    item.className = 'favorite-item';
                    item.innerHTML = `
                        ${bookmark.favicon ? `<img src="${bookmark.favicon}" alt="">` : ''}
                        <span>${bookmark.name}</span>
                    `;
                    item.onclick = () => this.createNewTab(bookmark.url);
                    dropdown.appendChild(item);
                });
                
                favoritesBar.appendChild(folderItem);
            }
        });
    }

    async connectWallet() {
        try {
            if (!this.web3) {
                this.web3 = new web3Instance(this.customRPC || 'http://localhost:8545');
            }
            
            const accounts = await this.web3.eth.requestAccounts();
            const balance = await this.web3.eth.getBalance(accounts[0]);
            
            this.walletInfo.innerHTML = `
                <p>Address: ${accounts[0]}</p>
                <p>Balance: ${this.web3.utils.fromWei(balance, 'ether')} ETH</p>
            `;
            
            this.connectWalletBtn.textContent = 'Connected';
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            this.walletInfo.innerHTML = `<p class="error">Failed to connect wallet: ${error.message}</p>`;
        }
    }

    updateNetwork() {
        this.customRPC = this.rpcInput.value;
        this.chainId = this.chainIdInput.value;
        this.explorerUrl = this.explorerInput.value;
        
        if (this.customRPC) {
            this.web3 = new web3Instance(this.customRPC);
            // Reset connection status
            this.connectWalletBtn.textContent = 'Connect Wallet';
            this.walletInfo.innerHTML = '';
        }
    }

    async loadBookmarks() {
        ipcRenderer.send('get-bookmarks');
        ipcRenderer.once('bookmarks', (event, bookmarks) => {
            this.bookmarks = bookmarks;
            
            // Update bookmarks panel
            this.bookmarksPanel.innerHTML = Object.entries(bookmarks).map(([folder, items]) => `
                <div class="bookmark-folder">
                    <h3>${folder.charAt(0).toUpperCase() + folder.slice(1)}</h3>
                    ${items.map(bookmark => `
                        <div class="bookmark">
                            <a href="#" onclick="window.browser.createNewTab('${bookmark.url}')">
                                ${bookmark.favicon ? `<img src="${bookmark.favicon}" alt="" width="16" height="16">` : ''}
                                ${bookmark.name}
                            </a>
                        </div>
                    `).join('')}
                </div>
            `).join('');
            
            this.updateFavoritesBar();
            this.updateBookmarkButton(this.getActiveWebview()?.getURL());
        });
    }

    async loadHistory() {
        ipcRenderer.send('get-history');
        ipcRenderer.once('history', (event, history) => {
            this.historyPanel.innerHTML = history.map(item => `
                <div class="history-item">
                    <a href="#" onclick="window.browser.createNewTab('${item.url}')">
                        ${item.url}
                    </a>
                    <span class="timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                </div>
            `).join('');
        });
    }
}

// Window controls
document.getElementById('minimize-button').addEventListener('click', () => {
    ipcRenderer.send('window-control', 'minimize');
});

document.getElementById('maximize-button').addEventListener('click', () => {
    ipcRenderer.send('window-control', 'maximize');
});

document.getElementById('close-button').addEventListener('click', () => {
    ipcRenderer.send('window-control', 'close');
});

ipcRenderer.on('window-maximized', (event, isMaximized) => {
    document.getElementById('maximize-button').innerHTML = isMaximized ? 
        '<i class="fas fa-clone"></i>' : 
        '<i class="fas fa-square"></i>';
});

document.addEventListener('DOMContentLoaded', () => {
    window.browser = new Browser();
});
