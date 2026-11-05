import * as vscode from 'vscode';

export class CatViewProvider implements vscode.WebviewViewProvider {
  private mood: 'idle' | 'sleeping' | 'angry' = 'idle';
  private speechBubble: string = '';
  private gameState: any = null;
  private webviewView?: vscode.WebviewView;
  private extensionUri: vscode.Uri;
  private emojiMap = {
    idle: '🐱',
    sleeping: '😴',
    angry: '😾'
  };
  private spriteConfig = {
    frameWidth: 32,
    frameCount: 8,
    fileName: 'logo.jpg'
  };

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  public updateGameState(gameState: any): void {
    this.gameState = gameState;
    this.postMessageToWebview({
      type: 'gameStateUpdated',
      gameState
    });
  }

  public updateMood(mood: 'idle' | 'sleeping' | 'angry'): void {
    this.mood = mood;
    this.postMessageToWebview({
      type: 'moodChanged',
      mood
    });
  }

  public updateSpeechBubble(text: string): void {
    this.speechBubble = text;
    this.postMessageToWebview({
      type: 'speechBubbleUpdated',
      text
    });
  }

  private postMessageToWebview(message: any): void {
    if (this.webviewView) {
      this.webviewView.webview.postMessage(message);
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext<unknown>,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media')
      ]
    };

    webviewView.webview.html = this.getHtml();

    webviewView.title = 'MeowLint';

    webviewView.webview.onDidReceiveMessage(message => {
      if (message.type === 'ready') {
        this.updateMood(this.mood);
        this.updateSpeechBubble(this.speechBubble);
        if (this.gameState) {
          this.updateGameState(this.gameState);
        }
      }
    });
  }

  private getHtml(): string {
    const style = `
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: sans-serif;
          background-color: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          padding: 20px;
          box-sizing: border-box;
        }
        .build-banner {
          background: #ff4444;
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: bold;
          margin-bottom: 20px;
          text-align: center;
          font-size: 18px;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .tagline {
          font-size: 14px;
          font-style: italic;
          opacity: 0.7;
        }
        .speech-bubble {
          position: absolute;
          top: -60px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--vscode-editor-background);
          border: الیpx solid var(--vscode-editor-foreground);
          border-radius: 12px;
          padding: 8px 12px;
          white-space: pre-wrap;
          word-wrap: break-word;
          max-width: 280px;
          font-size: 14px;
          line-height: 1.4;
          z-index: 10;
          animation: fadeIn 0.3s ease;
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
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .main-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          width: 100%;
          max-width: 500px;
        }
        .cat-image {
          display: block;
          width: 180px;
          max-width: 100%;
          height: auto;
          margin: 0 auto;
          border-radius: 16px;
        }
        .stats-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          padding: 0 20px;
        }
        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: var(--vscode-editor-background);
          border-radius: 8px;
          border: 1px solid var(--vscode-editor-foreground);
          font-size: 13px;
        }
        .stat-label {
          font-weight: bold;
          opacity: 0.8;
        }
        .stat-value {
          font-family: 'Consolas', 'Monaco', monospace;
        }
        .achievements-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          width: 100%;
          padding: 0 20px;
        }
        .achievement {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px;
          background: var(--vscode-editor-background);
          border-radius: 8px;
          border: 1px solid var(--vscode-editor-foreground);
          opacity: 0.7;
          transition: all 0.3s ease;
        }
        .achievement.unlocked {
          opacity: 1;
          background: var(--vscode-editor-selectionBackground);
          border-color: var(--vscode-editor-foreground);
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
        }
        .level-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 0 20px;
          margin-top: 10px;
        }
        .level-title {
          font-size: 16px;
          font-weight: bold;
          color: var(--vscode-editor-foreground);
        }
        .xp-bar-container {
          flex: 1;
          height: 20px;
          background: var(--vscode-editor-background);
          border-radius: 10px;
          border: 2px solid var(--vscode-editor-foreground);
          overflow: hidden;
        }
        .xp-bar {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #8BC34A);
          transition: width 0.5s ease;
        }
        .streak-display {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          font-size: 14px;
          margin-top: 5px;
        }
        .streak-icon {
          font-size: 16px;
        }
        .annoyance-meter {
          width: 100%;
          margin-top: 10px;
          padding: 0 20px;
        }
        .annoyance-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
          font-size: 12px;
        }
        .annoyance-bar-container {
          height: 8px;
          background: var(--vscode-editor-background);
          border-radius: 4px;
          border: 1px solid var(--vscode-editor-foreground);
          overflow: hidden;
        }
        .annoyance-bar {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #FF9800, #F44336);
          transition: width 0.3s ease;
        }
      </style>
    `;

    const script = `
      <script>
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ type: 'ready' });

        let gameState = {};
        let catMood = 'idle';
        let speechBubbleText = '';

        window.addEventListener('message', (event) => {
          const message = event.data;
          if (message.type === 'gameStateUpdated') {
            gameState = message.gameState;
            updateUI();
          }
          if (message.type === 'moodChanged') {
            catMood = message.mood;
            updateUI();
          }
          if (message.type === 'speechBubbleUpdated') {
            speechBubbleText = message.text;
            updateUI();
          }
        });

        function updateUI() {
          if (!gameState) return;

          const levelTitle = document.getElementById('level-title');
          if (levelTitle) levelTitle.textContent = gameState.level <= 6 ? 
            ['Kitten Coder', 'Alley Debugger', 'Lint Hunter', 'Refactor Ninja', 'Code Whisperer', 'Grumpy Legend'][gameState.level - 1] : 
            'Grumpy Legend';

          const xpBar = document.getElementById('xp-bar');
          if (xpBar) xpBar.style.width = ((gameState.xp % 100) / 100 * 100) + '%';

          const streakDisplay = document.getElementById('streak-display');
          if (streakDisplay) streakDisplay.innerHTML = '<span class="streak-icon">🔥</span> ' + gameState.streak;

          const totalRoasts = document.getElementById('total-roasts');
          if (totalRoasts) totalRoasts.textContent = gameState.totalRoasts;

          const bestStreak = document.getElementById('best-streak');
          if (bestStreak) bestStreak.textContent = gameState.bestStreak;

          const errorsFixed = document.getElementById('errors-fixed');
          if (errorsFixed) errorsFixed.textContent = gameState.errorsFixed;

          updateAchievements();
          updateAnnoyanceMeter();
        }

        function updateAchievements() {
          const grid = document.getElementById('achievements-grid');
          if (!grid) return;

          const achievements = [
            { key: 'firstRoast', icon: '🐱' },
            { key: 'cleanFreak', icon: '🔥' },
            { key: 'bugSlayer', icon: '🐛' },
            { key: 'nightOwl', icon: '🦉' },
            { key: 'survivor', icon: '🏆' },
            { key: 'catWhisperer', icon: '💬' }
          ];

          grid.innerHTML = '';
          achievements.forEach(ach => {
            const div = document.createElement('div');
            div.className = 'achievement ' + (gameState.achievements[ach.key] ? 'unlocked' : '');
            div.innerHTML = '<div class="achievement-icon">' + ach.icon + '</div>' + '<div class="achievement-name">' + ach.key.charAt(0).toUpperCase() + ach.key.slice(1).replace(/([A-Z])/g, ' $1').trim() + '</div>';
            div.title = ach.key + ': ' + getAchievementDescription(ach.key);
            grid.appendChild(div);
          });
        }

        function getAchievementDescription(key) {
          const descriptions = {
            firstRoast: 'Received your first code roast',
            cleanFreak: '10 clean saves in a row',
            bugSlayer: 'Fixed 25 errors total',
            nightOwl: 'Saved a file after midnight',
            survivor: 'Received 10 roasts',
            catWhisperer: 'Reached Level 5'
          };
          return descriptions[key] || '';
        }

        function updateAnnoyanceMeter() {
          const bar = document.getElementById('annoyance-bar');
          if (!bar) return;

          const annoyance = Math.min(100, Math.max(0, 50 - gameState.streak * 5 + (gameState.errorsFixed % 10) * 2));
          bar.style.width = annoyance + '%';

          const header = document.getElementById('annoyance-header');
          if (header) {
            const level = annoyance < 33 ? 'Low' : annoyance < 66 ? 'Medium' : 'High';
            header.innerHTML = '<span>Cat Mood (' + level + ')</span><span>' + Math.round(annoyance) + '%</span>';
          }
        }
      </script>
    `;

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src vscode-resource: data:; style-src 'unsafe-inline';">
          <title>MeowLint</title>
          ${style}
          ${script}
        </head>
        <body>
          <div class="build-banner">BUILD 2 - NEW HTML LOADED</div>
          <div class="header">
            <div class="title">MeowLint</div>
            <div class="tagline">Your code has feelings. Your cat doesn't care.</div>
          </div>
          <div class="speech-bubble" id="speech-bubble">${this.speechBubble}</div>
          <img id="cat-image" class="cat-image" src="${this.getWebviewUri('logo.jpg')}" alt="Cat" />
          <div class="main-container">
            <div class="level-container">
              <div class="level-title" id="level-title">Loading...</div>
              <div class="xp-bar-container">
                <div class="xp-bar" id="xp-bar" style="width: 0%"></div>
              </div>
            </div>
            <div class="streak-display" id="streak-display">🔥 0</div>
            <div class="stats-section">
              <div class="stat-row">
                <span class="stat-label">Total Roasts:</span>
                <span class="stat-value" id="total-roasts">0</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Best Streak:</span>
                <span class="stat-value" id="best-streak">0</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Errors Fixed:</span>
                <span class="stat-value" id="errors-fixed">0</span>
              </div>
            </div>
            <div class="annoyance-meter">
              <div class="annoyance-header" id="annoyance-header">
                <span>Cat Mood (Low)</span>
                <span>0%</span>
              </div>
              <div class="annoyance-bar-container">
                <div class="annoyance-bar" id="annoyance-bar" style="width: 0%"></div>
              </div>
            </div>
            <div class="achievements-grid" id="achievements-grid">
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getWebviewUri(filename: string): string {
    if (!this.webviewView) return '';
    const uri = vscode.Uri.joinPath(this.extensionUri, 'media', filename);
    return this.webviewView.webview.asWebviewUri(uri).toString();
  }

  private getThemeBackground(): string {
    return this.getIsDarkTheme() ? 'rgba(45, 45, 45, 0.9)' : 'rgba(255, 255, 255, 0.9)';
  }

  private getThemeBorder(): string {
    return this.getIsDarkTheme() ? '#d4d4d4' : '#333';
  }

  private getIsDarkTheme(): boolean {
    return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
  }
}