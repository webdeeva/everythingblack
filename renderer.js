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
        this.bookmarks = new Set();
        
        this.initializeElements();
        this.setupEventListeners();
        this.createDebugInfo();
        this.createNewTab();
        this.loadBookmarks();
    }

    initializeElements() {
        // Navigation controls
        this.urlBar = document.getElementById('url-bar');
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
    }

    createDebugInfo() {
        const debugDiv = document.createElement('div');
        debugDiv.className = 'debug-info';
        document.body.appendChild(debugDiv);

        const updateDebugInfo = () => {
            const webview = this.getActiveWebview();
            const toolbar = document.querySelector('.toolbar');
            const mainContainer = document.querySelector('.main-container');
            const webviewsContainer = document.querySelector('.webview-wrapper');

            const getElementInfo = (el) => {
                if (!el) return 'null';
                const rect = el.getBoundingClientRect();
                const computed = window.getComputedStyle(el);
                return `
                    Size: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}
                    Position: ${rect.left.toFixed(0)},${rect.top.toFixed(0)}
                    Offset: ${el.offsetWidth}x${el.offsetHeight}
                    Client: ${el.clientWidth}x${el.clientHeight}
                    Scroll: ${el.scrollWidth}x${el.scrollHeight}
                    Style Height: ${computed.height}
                    Style Display: ${computed.display}
                `;
            };

            debugDiv.innerHTML = `
                Window: ${window.innerWidth}x${window.innerHeight}
                Document: ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}

                Toolbar:
                ${getElementInfo(toolbar)}

                Main Container:
                ${getElementInfo(mainContainer)}

                Webviews Container:
                ${getElementInfo(webviewsContainer)}

                Active Webview:
                ${getElementInfo(webview)}

                Active Tab: ${this.activeTabId || 'none'}
                URL: ${webview ? webview.getURL() : 'none'}
            `;
        };

        // Store for use in other methods
        this.debugDiv = debugDiv;
        this.updateDebugInfo = updateDebugInfo;

        // Update debug info frequently
        setInterval(updateDebugInfo, 1000);
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

        // DevTools event
        this.devToolsBtn.addEventListener('click', () => {
            const webview = this.getActiveWebview();
            if (webview) {
                webview.toggleDevTools();
            }
        });

        // Bookmark event
        this.bookmarkBtn.addEventListener('click', () => this.toggleBookmark());

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

    createNewTab(url = 'about:blank') {
        const tabId = 'tab-' + Date.now();
        
        // Create tab element
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.setAttribute('data-tab-id', tabId);
        tab.innerHTML = `
            <span class="tab-title">New Tab</span>
            <button class="tab-close">×</button>
        `;
        
        // Create webview
        const webview = document.createElement('webview');
        webview.setAttribute('id', tabId);
        webview.setAttribute('src', url);
        webview.setAttribute('autosize', 'on');
        webview.setAttribute('webpreferences', 'contextIsolation=false');
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
    }

    togglePanel(panel) {
        const wasActive = panel.classList.contains('active');
        // Hide all panels
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        // Show clicked panel if it wasn't active
        if (!wasActive) {
            panel.classList.add('active');
        }
    }

    async toggleBookmark() {
        const url = this.getActiveWebview().getURL();
        if (this.bookmarks.has(url)) {
            this.bookmarks.delete(url);
            this.bookmarkBtn.classList.remove('active');
            ipcRenderer.send('remove-bookmark', url);
        } else {
            this.bookmarks.add(url);
            this.bookmarkBtn.classList.add('active');
            ipcRenderer.send('add-bookmark', url);
        }
        this.loadBookmarks();
    }

    updateBookmarkButton(url) {
        if (this.bookmarks.has(url)) {
            this.bookmarkBtn.classList.add('active');
        } else {
            this.bookmarkBtn.classList.remove('active');
        }
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
            this.bookmarks = new Set(bookmarks);
            this.bookmarksPanel.innerHTML = bookmarks.map(url => `
                <div class="bookmark">
                    <a href="#" onclick="window.browser.createNewTab('${url}')">${url}</a>
                </div>
            `).join('');
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

// Initialize browser when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.browser = new Browser();
});
