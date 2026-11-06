import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class CatViewProvider implements vscode.WebviewViewProvider {
  private mood: 'idle' | 'sleeping' | 'angry' = 'idle';
  private speechBubble: string = 'Mrrp. I\'m watching you.';
  private gameState: any = null;
  private webviewView?: vscode.WebviewView;
  private extensionUri: vscode.Uri;
  private reactionUriMap: Record<string, string> = {};
  private buildVersion: number = 4;
  private stateMessageCount: number = 0;
  private lastStateTime: number = Date.now();
  private latestJsError: string | null = null;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
    this.buildReactionUriMap();
  }

  private buildReactionUriMap(): void {
    const reactions: Record<string, string[]> = {
      idle: ['logo.jpg'],
      watching: ['watching.jpg'],
      angry: ['angry.jpg'],
      shocked: ['shocked.jpg'],
      omg: ['omg.webp'],
      suspicious: ['suspecious.webp'],
      sleeping: [],
      smug: [],
      celebrate: ['omg.webp'],
      confused: ['suspecious.webp']
    };

    for (const [reactionId, files] of Object.entries(reactions)) {
      let resolved = false;
      for (const file of files) {
        const filePath = path.join(this.extensionUri.fsPath, 'media', file);
        try {
          if (fs.existsSync(filePath)) {
            this.reactionUriMap[reactionId] = vscode.Uri.joinPath(this.extensionUri, 'media', file).toString();
            resolved = true;
            break;
          }
        } catch {
          // continue trying
        }
      }
      if (!resolved && files.length > 0) {
        const firstFile = files[0];
        this.reactionUriMap[reactionId] = vscode.Uri.joinPath(this.extensionUri, 'media', firstFile).toString();
      } else if (!resolved && files.length === 0) {
        this.reactionUriMap[reactionId] = vscode.Uri.joinPath(this.extensionUri, 'media', 'logo.jpg').toString();
      }
    }
  }

  public setReactionUriMap(map: Record<string, string>): void {
    this.reactionUriMap = map;
  }

  public updateGameState(state: any): void {
    this.gameState = state;
    this.postMessageToWebview({ type: 'state', payload: state });
  }

  public updateMood(mood: 'idle' | 'sleeping' | 'angry'): void {
    this.mood = mood;
    this.postMessageToWebview({ type: 'mood', mood });
  }

  public updateSpeechBubble(text: string): void {
    this.speechBubble = text;
    this.postMessageToWebview({ type: 'bubble', text });
  }

  public postMessageToWebview(message: any): void {
    if (this.webviewView) {
      this.webviewView.webview.postMessage(message);
    }
  }

  public postReaction(name: string, durationMs?: number): void {
    this.postMessageToWebview({ type: 'reaction', name, durationMs });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext<unknown>,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.webviewView = webviewView;

    const nonce = (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).substr(2, 16);

    // Check if icon.png exists, fall back to logo.jpg
    const iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'icon.png');
    const logoPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'logo.jpg');
    let headerLogoUri = iconPath.toString();
    try {
      if (!fs.existsSync(iconPath.fsPath)) {
        headerLogoUri = logoPath.toString();
        console.log('[MeowLint] icon.png missing, falling back to logo.jpg');
      }
    } catch {
      // ignore
    }

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media')
      ]
    };

    webviewView.webview.html = this.getHtml(nonce, webviewView.webview.cspSource, headerLogoUri);

    webviewView.title = 'MeowLint';

    webviewView.webview.onDidReceiveMessage(message => {
      if (message.type === 'ready') {
        console.log('[MeowLint] ready received from webview');
        const outputChannel = vscode.window.createOutputChannel('MeowLint');
        outputChannel.appendLine('[MeowLint] ready received from webview');
        outputChannel.dispose();

        this.flushPendingMessages(nonce);
        this.updateMood(this.mood);
        this.updateSpeechBubble(this.speechBubble);
        if (this.gameState) {
          this.updateGameState(this.gameState);
        }
      } else if (message.type === 'state') {
        this.stateMessageCount++;
        this.lastStateTime = Date.now();
        this.gameState = message.payload;
        console.log('[MeowLint] state posted (lv ' + (message.payload?.level || 0) + ', xp ' + (message.payload?.xp || 0) + ')');
        const outputChannel = vscode.window.createOutputChannel('MeowLint');
        outputChannel.appendLine('[MeowLint] state posted (lv ' + (message.payload?.level || 0) + ', xp ' + (message.payload?.xp || 0) + ')');
        outputChannel.dispose();
      }
    });

    webviewView.onDidChangeVisibility(e => {
      if (webviewView.visible && this.gameState) {
        console.log('[MeowLint] webview became visible, re-posting state');
        this.updateGameState(this.gameState);
      }
    });
  }

  private flushPendingMessages(nonce: string): void {
    // Flush any pending messages that were queued before webview was ready
    if (this.gameState) {
      this.updateGameState(this.gameState);
    }
  }

  private getHtml(nonce: string, cspSource: string, headerLogoUri: string): string {
    const gameStateJson = this.gameState ? JSON.stringify(this.gameState).replace(/</g, '\\u003c') : '{}';
    const mood = this.mood;
    const catLogoUri = vscode.Uri.joinPath(this.extensionUri, 'media', 'logo.jpg').toString();

    const csp = `default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'`;

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="${csp}">
          <title>MeowLint</title>
          ${this.getStyle()}
        </head>
        <body class="${mood}">
          <div class="header">
            <div class="header-row">
              <img src="${headerLogoUri}" alt="" class="header-logo" />
              <div class="title">MeowLint</div>
            </div>
            <div class="tagline">Your code has feelings. Your cat doesn't care.</div>
          </div>
          <div class="speech-bubble" id="speech-bubble">${this.speechBubble}</div>
          <div class="cat-card" id="cat-card">
            <div class="cat-img-wrap" id="cat-img-wrap">
              <img id="cat-img-1" class="cat-image cat-img-active" src="${catLogoUri}" alt="" />
              <img id="cat-img-2" class="cat-image cat-img-inactive" src="" alt="" />
              <div id="zzz-text" class="zzz" style="display:none;">Zzz</div>
            </div>
            <div class="reaction-label" id="reaction-label">mood: ${mood}</div>
          </div>
          <div class="level-row">
            <div class="level-title" id="level-title">Loading...</div>
            <div class="xp-text" id="xp-text">XP 0/0</div>
          </div>
          <div class="xp-bar-container">
            <div class="xp-bar" id="xp-bar" style="width: 0%"></div>
          </div>
          <div class="streak-row">
            <span class="streak-icon">🔥</span>
            <span class="streak-value" id="streak-display">0</span>
            <span class="best-streak" id="best-streak">Best: 0</span>
          </div>
          <div class="annoyance-meter">
            <div class="annoyance-header" id="annoyance-header">
              <span>Annoyance (Low)</span><span>0%</span>
            </div>
            <div class="annoyance-bar-container">
              <div class="annoyance-bar" id="annoyance-bar" style="width: 0%"></div>
            </div>
          </div>
          <div class="stats-row">
            <div class="stat-tile">
              <span class="stat-label">Roasts</span>
              <span class="stat-value" id="total-roasts">0</span>
            </div>
            <div class="stat-tile">
              <span class="stat-label">Errors Fixed</span>
              <span class="stat-value" id="errors-fixed">0</span>
            </div>
            <div class="stat-tile">
              <span class="stat-label">Best Streak</span>
              <span class="stat-value" id="best-streak-value">0</span>
            </div>
          </div>
          <div class="achievements-section">
            <div class="achievements-label">Achievements</div>
            <div class="achievements-grid" id="achievements-grid"></div>
          </div>
          <div class="footer-hint">Save a file to feed the cat.</div>
          <div class="footer-diagnostics" id="footer-diagnostics">
            <span>build ${this.buildVersion} | state msgs: ${this.stateMessageCount} | last state: ${new Date(this.lastStateTime).toLocaleTimeString()} | js errors: none</span>
          </div>
          <div id="js-error" class="js-error"></div>
          <script type="application/json" id="initial-state">${gameStateJson}</script>
          <script type="application/json" id="reaction-map">${JSON.stringify(this.reactionUriMap).replace(/</g, '\\u003c')}</script>
          <script nonce="${nonce}">
            ${this.getScript()}
          </script>
        </body>
      </html>
    `;
  }

  private getStyle(): string {
    return `
      <style>
        :root {
          --cat-text: var(--vscode-editor-foreground);
          --cat-muted: var(--vscode-descriptionForeground);
          --cat-accent: var(--vscode-editor-selectionBackground);
          --cat-border: var(--vscode-panel-border);
        }
        body {
          margin: 0;
          padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', sans-serif;
          background-color: var(--vscode-editor-background);
          color: var(--cat-text);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          min-height: 100vh;
          box-sizing: border-box;
          overflow-y: auto;
          width: 100%;
        }
        .header {
          text-align: center;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 0 16px;
          width: 100%;
        }
        .header-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
        }
        .header-logo {
          width: 32px;
          height: 32px;
          border-radius: 50%;
        }
        .title {
          font-size: 20px;
          font-weight: bold;
          color: var(--cat-text);
        }
        .tagline {
          font-size: 13px;
          font-style: italic;
          opacity: 0.7;
          color: var(--cat-muted);
          line-height: 1.4;
          width: 100%;
          max-width: 300px;
        }
        .speech-bubble {
          position: relative;
          background: var(--vscode-editor-background);
          border: 2px solid var(--vscode-editor-foreground);
          border-radius: 12px;
          padding: 8px 12px;
          white-space: pre-wrap;
          word-wrap: break-word;
          max-width: 280px;
          font-size: 14px;
          line-height: 1.4;
          z-index: 10;
          animation: popIn 200ms ease-out;
          margin-bottom: 8px;
        }
        .speech-bubble::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 8px solid var(--vscode-editor-background);
          border-bottom: none;
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .cat-card {
          position: relative;
          width: 180px;
          height: 180px;
          border-radius: 16px;
          overflow: hidden;
          margin: 8px 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cat-img-wrap {
          position: relative;
          width: 180px;
          height: 180px;
        }
        .cat-image {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          opacity: 0;
          transition: opacity 250ms ease;
        }
        .cat-img-active {
          opacity: 1;
        }
        .cat-img-inactive {
          opacity: 0;
        }
        .idle .cat-image {
          animation: breathing 3s ease-in-out infinite;
        }
        .sleeping .cat-image {
          animation: sleeping 4s ease-in-out infinite;
          opacity: 0.6;
        }
        .sleeping .cat-image.cat-img-active {
          opacity: 0.6;
        }
        .angry .cat-image {
          animation: angryShake 0.5s ease-in-out infinite;
        }
        .level-up .cat-image {
          animation: bounce 1s ease-in-out;
        }
        @keyframes breathing {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes sleeping {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { transform: translateY(-3px) scale(1.01); opacity: 0.5; }
        }
        @keyframes angryShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        @keyframes zzzFloat {
          0%, 100% { transform: translateY(0); opacity: 0.7; }
          50% { transform: translateY(-10px); opacity: 1; }
        }
        .zzz {
          position: absolute;
          top: -20px;
          left: 50%;
          font-size: 18px;
          animation: zzzFloat 2s ease-in-out infinite;
          pointer-events: none;
        }
        .reaction-label {
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          color: var(--cat-muted);
        }
        .level-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          padding: 0 8px;
          margin-top: 8px;
        }
        .level-title {
          font-size: 16px;
          font-weight: bold;
          color: var(--cat-text);
        }
        .xp-text {
          font-size: 12px;
          color: var(--cat-muted);
          font-family: monospace;
        }
        .xp-bar-container {
          width: 100%;
          height: 20px;
          background: var(--vscode-editor-background);
          border-radius: 10px;
          border: 2px solid var(--cat-border);
          overflow: hidden;
          margin-top: 4px;
        }
        .xp-bar {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #8BC34A);
          width: 0%;
          transition: width 0.5s ease;
        }
        .streak-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--cat-text);
          margin-top: 8px;
        }
        .streak-icon {
          font-size: 16px;
        }
        .streak-value {
          font-weight: bold;
        }
        .best-streak {
          margin-left: 12px;
          font-size: 12px;
          color: var(--cat-muted);
        }
        .annoyance-meter {
          width: 100%;
          margin-top: 8px;
        }
        .annoyance-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
          font-size: 12px;
          color: var(--cat-muted);
        }
        .annoyance-bar-container {
          height: 8px;
          background: var(--vscode-editor-background);
          border-radius: 4px;
          border: 1px solid var(--cat-border);
          overflow: hidden;
        }
        .annoyance-bar {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #FF9800, #F44336);
          width: 0%;
          transition: width 0.3s ease;
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          width: 100%;
          margin-top: 8px;
          padding: 0 8px;
        }
        .stat-tile {
          padding: 8px;
          background: var(--vscode-editor-background);
          border-radius: 8px;
          border: 1px solid var(--cat-border);
          text-align: center;
        }
        .stat-label {
          font-size: 11px;
          font-weight: bold;
          opacity: 0.8;
          display: block;
          margin-bottom: 4px;
        }
        .stat-value {
          font-size: 14px;
          font-family: monospace;
          font-weight: bold;
        }
        .achievements-section {
          width: 100%;
          margin-top: 12px;
          padding: 0 8px;
        }
        .achievements-label {
          font-size: 14px;
          font-weight: bold;
          color: var(--cat-text);
          margin-bottom: 8px;
        }
        .achievements-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
          gap: 8px;
          width: 100%;
        }
        .achievement {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px;
          background: var(--vscode-editor-background);
          border-radius: 8px;
          border: 1px solid var(--cat-border);
          opacity: 0.6;
          transition: all 0.3s ease;
        }
        .achievement.unlocked {
          opacity: 1;
          background: var(--vscode-editor-selectionBackground);
          border-color: var(--cat-border);
          box-shadow: 0 0 8px rgba(var(--vscode-editor-foreground), 0.3);
        }
        .achievement-icon {
          font-size: 20px;
          margin-bottom: 4px;
        }
        .achievement-name {
          font-size: 10px;
          text-align: center;
          font-weight: bold;
          width: 100%;
        }
        .footer-hint {
          margin-top: 12px;
          font-size: 11px;
          color: var(--cat-muted);
          text-align: center;
          font-style: italic;
        }
        .footer-diagnostics {
          margin-top: 8px;
          font-size: 11px;
          color: var(--cat-muted);
          text-align: center;
          padding: 4px 0;
          width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .js-error {
          margin-top: 8px;
          font-size: 11px;
          color: #ff5555;
          text-align: center;
          display: none;
          padding: 4px 0;
          width: 100%;
        }
        .js-error.visible {
          display: block;
        }
      </style>
    `;
  }

  private getScript(): string {
    return `
      // Safe element getter with null guard
      const $ = (id) => document.getElementById(id);

      let gameState = null;
      let catMood = 'idle';
      let speechBubbleText = '';
      let reactionMap = {};
      let stateMessageCount = 0;
      let lastStateTime = Date.now();
      let latestJsError = null;

      // Read initial state from embedded script tag (STEP 1: before listener)
      const initialStateScript = document.getElementById('initial-state');
      if (initialStateScript) {
        try {
          const initialData = JSON.parse(initialStateScript.textContent);
          if (initialData && Object.keys(initialData).length > 0) {
            gameState = initialData;
            renderState();
          }
        } catch (e) {
          console.error('[MeowLint] Failed to parse initial state:', e);
        }
      }

      // Read reaction map from embedded script tag
      const reactionMapScript = document.getElementById('reaction-map');
      if (reactionMapScript) {
        try {
          reactionMap = JSON.parse(reactionMapScript.textContent);
        } catch (e) {
          console.error('[MeowLint] Failed to parse reaction map:', e);
        }
      }

      // Register message listener FIRST (STEP 2)
      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'state') {
          gameState = message.payload;
          stateMessageCount++;
          lastStateTime = Date.now();
          renderState();
          updateDiagnostics();
        }
        if (message.type === 'bubble') {
          speechBubbleText = message.text;
          showBubble(message.text, message.kind);
        }
        if (message.type === 'mood') {
          catMood = message.mood;
          renderCat(message.mood);
        }
        if (message.type === 'reactionMap') {
          reactionMap = message.map;
        }
        if (message.type === 'reaction') {
          playReaction(message.name, message.durationMs);
        }
      });

      // Post ready AFTER listener is registered (STEP 3)
      const vscode = acquireVsCodeApi();
      vscode.postMessage({ type: 'ready' });

      // Error handling
      window.onerror = function(msg, url, line, col, error) {
        latestJsError = msg || 'unknown';
        const el = $('js-error');
        if (el) {
          el.textContent = 'JS Error: ' + latestJsError;
          el.classList.add('visible');
        }
        const diag = $('footer-diagnostics');
        if (diag) {
          diag.innerHTML = '<span style="color:#ff5555;">build 4 | state msgs: ' + stateMessageCount + ' | last state: ' + new Date(lastStateTime).toLocaleTimeString() + ' | js errors: ' + latestJsError + '</span>';
        }
        console.error('[MeowLint] JS Error:', msg, url, line, col, error);
        return true;
      };

      window.onunhandledrejection = function(event) {
        latestJsError = event.reason?.message || String(event.reason);
        const el = $('js-error');
        if (el) {
          el.textContent = 'Unhandled Rejection: ' + latestJsError;
          el.classList.add('visible');
        }
        const diag = $('footer-diagnostics');
        if (diag) {
          diag.innerHTML = '<span style="color:#ff5555;">build 4 | state msgs: ' + stateMessageCount + ' | last state: ' + new Date(lastStateTime).toLocaleTimeString() + ' | js errors: ' + latestJsError + '</span>';
        }
        console.error('[MeowLint] Unhandled Rejection:', event.reason);
        event.preventDefault();
      };

      function updateDiagnostics() {
        const diag = $('footer-diagnostics');
        if (diag) {
          const errorStr = latestJsError ? latestJsError : 'none';
          diag.innerHTML = '<span>build 4 | state msgs: ' + stateMessageCount + ' | last state: ' + new Date(lastStateTime).toLocaleTimeString() + ' | js errors: ' + errorStr + '</span>';
        }
      }

      // Render functions wrapped in try/catch so one failure never stops others
      function renderState() {
        try {
          if (!gameState) return;

          const levelTitle = $('level-title');
          if (levelTitle) levelTitle.textContent = 'Lv ' + gameState.level + ' - ' + (gameState.levelTitle || 'Kitten Coder');

          const xpText = $('xp-text');
          if (xpText) xpText.textContent = 'XP ' + gameState.xp + '/' + gameState.xpToNext;

          const xpBar = $('xp-bar');
          if (xpBar) xpBar.style.width = Math.round((gameState.xp / gameState.xpToNext) * 100) + '%';

          const streakDisplay = $('streak-display');
          if (streakDisplay) streakDisplay.innerHTML = '<span class="streak-icon">🔥</span> ' + gameState.streak;

          const bestStreak = $('best-streak');
          if (bestStreak) bestStreak.textContent = 'Best: ' + gameState.bestStreak;

          const totalRoasts = $('total-roasts');
          if (totalRoasts) totalRoasts.textContent = gameState.totalRoasts;

          const errorsFixed = $('errors-fixed');
          if (errorsFixed) errorsFixed.textContent = gameState.errorsFixed;

          const bestStreakValue = $('best-streak-value');
          if (bestStreakValue) bestStreakValue.textContent = gameState.bestStreak;

          const annoyanceBar = $('annoyance-bar');
          if (annoyanceBar) annoyanceBar.style.width = gameState.annoyance + '%';

          const annoyanceHeader = $('annoyance-header');
          if (annoyanceHeader) {
            const level = gameState.annoyance < 33 ? 'Low' : gameState.annoyance < 66 ? 'Medium' : 'High';
            annoyanceHeader.innerHTML = '<span>Annoyance (' + level + ')</span><span>' + Math.round(gameState.annoyance) + '%</span>';
          }

          renderAchievements();
          updateDiagnostics();
        } catch (e) {
          console.error('[MeowLint] renderState error:', e);
          latestJsError = e.message || String(e);
          updateDiagnostics();
        }
      }

      function renderAchievements() {
        try {
          const grid = $('achievements-grid');
          if (!grid || !gameState) return;

          const achievements = gameState.achievements || [];

          grid.innerHTML = '';
          achievements.forEach(ach => {
            const div = document.createElement('div');
            div.className = 'achievement ' + (ach.unlocked ? 'unlocked' : '');
            div.innerHTML = '<div class="achievement-icon">' + (ach.unlocked ? '🔓' : '🔒') + '</div>' +
              '<div class="achievement-name">' + ach.name + '</div>';
            div.title = ach.name + ': ' + ach.description;
            grid.appendChild(div);
          });
        } catch (e) {
          console.error('[MeowLint] renderAchievements error:', e);
          latestJsError = e.message || String(e);
          updateDiagnostics();
        }
      }

      function showBubble(text, kind) {
        try {
          const bubble = $('speech-bubble');
          if (!bubble) return;

          bubble.textContent = text;
          bubble.style.animation = 'none';
          const reflow = bubble.offsetHeight;
          bubble.style.animation = 'popIn 200ms ease-out';
        } catch (e) {
          console.error('[MeowLint] showBubble error:', e);
          latestJsError = e.message || String(e);
          updateDiagnostics();
        }
      }

      function renderCat(mood) {
        try {
          const body = document.body;
          body.className = mood;
          const img1 = $('cat-img-1');
          const img2 = $('cat-img-2');
          const zzz = $('zzz-text');

          if (img1) img1.style.display = 'none';
          const reflow = img1 ? img1.offsetHeight : 0;
          if (img1) img1.style.display = 'block';
          if (img2) img2.style.display = 'none';
          const reflow2 = img2 ? img2.offsetHeight : 0;
          if (img2) img2.style.display = 'block';

          if (zzz) {
            if (mood === 'sleeping') zzz.style.display = 'block';
            else zzz.style.display = 'none';
          }
        } catch (e) {
          console.error('[MeowLint] renderCat error:', e);
          latestJsError = e.message || String(e);
          updateDiagnostics();
        }
      }

      function playReaction(name, durationMs) {
        try {
          const uri = reactionMap[name];
          if (!uri) return;

          const label = $('reaction-label');
          if (label) label.textContent = 'mood: ' + name;

          const img1 = $('cat-img-1');
          const img2 = $('cat-img-2');

          const active = document.querySelector('.cat-img-active');
          const inactive = document.querySelector('.cat-img-inactive');

          if (active === img1 && img2) {
            img2.src = uri;
            img2.classList.remove('cat-img-inactive');
            img2.classList.add('cat-img-active');
            img1.classList.remove('cat-img-active');
            img1.classList.add('cat-img-inactive');
          } else if (img1) {
            img1.src = uri;
            img1.classList.remove('cat-img-inactive');
            img1.classList.add('cat-img-active');
            img2.classList.remove('cat-img-active');
            img2.classList.add('cat-img-inactive');
          }

          if (durationMs) {
            setTimeout(() => {
              try {
                if (active === img1 && img2) {
                  img2.classList.remove('cat-img-active');
                  img2.classList.add('cat-img-inactive');
                  img1.classList.remove('cat-img-inactive');
                  img1.classList.add('cat-img-active');
                } else if (img1) {
                  img1.classList.remove('cat-img-active');
                  img1.classList.add('cat-img-inactive');
                  img2.classList.remove('cat-img-inactive');
                  img2.classList.add('cat-img-active');
                }
                if (label) label.textContent = 'mood: ' + catMood;
              } catch (e2) {
                console.error('[MeowLint] playReaction timeout error:', e2);
              }
            }, durationMs);
          }
        } catch (e) {
          console.error('[MeowLint] playReaction error:', e);
          latestJsError = e.message || String(e);
          updateDiagnostics();
        }
      }
    `;
  }

  private getWebviewUri(filename: string): string {
    if (!this.webviewView) return '';
    const uri = vscode.Uri.joinPath(this.extensionUri, 'media', filename);
    return this.webviewView.webview.asWebviewUri(uri).toString();
  }

  private getIsDarkTheme(): boolean {
    return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
  }
}
