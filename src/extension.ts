import * as vscode from 'vscode';
import { CatViewProvider } from './catViewProvider';
import { MoodManager } from './moodManager';
import { Roaster } from './roaster';
import { GameState } from './gameState';

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('MeowLint');
  outputChannel.appendLine('MeowLint BUILD 3 activated');
  console.log('MeowLint BUILD 3 activated');

  const gameState = new GameState(context);
  const moodManager = new MoodManager();
  const catProvider = new CatViewProvider(context.extensionUri);
  const roaster = new Roaster(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('meowLint.cat', catProvider)
  );

  // Create and show status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '🐱 Lv - 🔥 0';
  statusBarItem.tooltip = 'MeowLint - click to open';
  statusBarItem.command = 'workbench.view.extension.meowLint';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Update status bar on game state changes
  gameState.onChange((state) => {
    statusBarItem.text = `🐱 Lv ${state.level} · 🔥 ${state.streak}`;
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('meowlint.hello', () => {
      vscode.window.showInformationMessage('Meow! MeowLint is alive');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('meowlint.setApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your Gemini API Key (password mode)',
        password: true,
        ignoreFocusOut: true
      });

      if (apiKey) {
        await context.secrets.store('geminiApiKey', apiKey);
        vscode.window.showInformationMessage('API key saved successfully!');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('meowlint.roastCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const document = editor.document;
      if (!shouldRoast(document)) {
        return;
      }

      const roast = await roaster.generateRoast(document);
      if (roast) {
        catProvider.updateSpeechBubble(roast);
        gameState.recordRoastReceived();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('meowlint.resetProgress', () => {
      vscode.window.showInformationMessage('Are you sure you want to reset all progress? This cannot be undone.', { modal: true }, 'Reset').then(selection => {
        if (selection === 'Reset') {
          gameState.reset();
          vscode.window.showInformationMessage('MeowLint progress has been reset!');
        }
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('meowlint.showStatus', () => {
      const state = gameState.getState();
      const msg = `MeowLint Status:\n` +
        `Version: 0.0.1\n` +
        `View Provider Registered: yes\n` +
        `GameState Loaded: yes (Lv ${state.level}, ${state.levelTitle})\n` +
        `Total Roasts: ${state.totalRoasts}\n` +
        `Errors Fixed: ${state.errorsFixed}\n` +
        `Streak: ${state.streak}\n` +
        `Annoyance: ${state.annoyance}%`;
      vscode.window.showInformationMessage(msg);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (!shouldRoast(document)) return;

      const config = vscode.workspace.getConfiguration('meowlint');
      if (!config.get('enableRoasts')) return;

      const apiKey = await context.secrets.get('geminiApiKey');
      if (!apiKey) {
        catProvider.updateSpeechBubble('Set your Gemini API key with MeowLint: Set Gemini API Key');
        return;
      }

      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      const hasErrors = diagnostics.length > 0;
      const errorCount = diagnostics.length;

      const roast = await roaster.generateRoast(document);
      if (roast) {
        catProvider.updateSpeechBubble(roast);
        gameState.recordRoastReceived();
      }

      gameState.recordCleanSave(hasErrors, errorCount);

      if (hasErrors && errorCount > 0) {
        gameState.addXp(25);
      }
    })
  );

  moodManager.setMood('idle');
  catProvider.updateMood('idle');
  catProvider.updateSpeechBubble('Your code has feelings. Your cat doesn\'t care.');

  // Debug commands
  context.subscriptions.push(
    vscode.commands.registerCommand('meowlint.debug.add100xp', () => {
      const result = gameState.addXp(100);
      catProvider.updateGameState(gameState.getState());
      vscode.window.showInformationMessage(`Added 100 XP. Now at Lv ${result.newLevel}.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('meowlint.debug.unlockAchievement', async () => {
      const achievementPick = await vscode.window.showQuickPick(
        Object.entries(gameState.getState().achievements).map(([k, v]) => ({
          label: k + (v ? ' ✓' : ''),
          description: v ? 'already unlocked' : 'locked'
        })),
        { placeHolder: 'Select achievement to unlock' }
      );
      if (achievementPick) {
        const key = achievementPick.label.split(' ')[0];
        if (!gameState.getState().achievements.find((a: any) => a.id === key)?.unlocked) {
          gameState.unlockAchievement(key);
          catProvider.updateGameState(gameState.getState());
          catProvider.updateSpeechBubble('Achievement unlocked: ' + key);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('meowlint.debug.cycleReactions', async () => {
      const reactions = ['idle', 'watching', 'angry', 'shocked', 'omg', 'suspicious', 'sleeping', 'smug', 'celebrate', 'confused'];
      let i = 0;
      const cycle = () => {
        if (i >= reactions.length) return;
        const r = reactions[i];
        catProvider.postReaction(r, 2000);
        catProvider.updateSpeechBubble('Reaction: ' + r);
        i++;
        setTimeout(cycle, 2500);
      };
      cycle();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('meowlint.debug.playReaction', async () => {
      const reactionNames = ['idle', 'watching', 'angry', 'shocked', 'omg', 'suspicious', 'sleeping', 'smug', 'celebrate', 'confused'];
      const picked = await vscode.window.showQuickPick(
        reactionNames.map(r => ({ label: r })),
        { placeHolder: 'Select reaction to play' }
      );
      if (picked) {
        catProvider.postReaction(picked.label, 4000);
        catProvider.updateSpeechBubble('Reaction: ' + picked.label);
      }
    })
  );
}

function shouldRoast(document: vscode.TextDocument): boolean {
  if (document.languageId === 'plaintext' || document.languageId === '') return false;

  if (document.getText().length > 4000) return false;

  return true;
}

export function deactivate() {}