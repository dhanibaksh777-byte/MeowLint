import * as vscode from 'vscode';
import { CatViewProvider } from './catViewProvider';
import { MoodManager } from './moodManager';
import { Roaster } from './roaster';
import { GameState } from './gameState';

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('MeowLint');
  outputChannel.appendLine('MeowLint BUILD 2 activated');
  console.log('MeowLint BUILD 2 activated');

  const gameState = new GameState(context);
  const moodManager = new MoodManager();
  const catProvider = new CatViewProvider(context.extensionUri);
  const roaster = new Roaster(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('meowLint.cat', catProvider)
  );

  // Send initial game state to webview
  catProvider.updateGameState(gameState.getState());

  gameState.onChange(state => {
    catProvider.updateGameState(state);
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
        gameState.recordRoast();
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
        gameState.recordRoast();
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
}

function shouldRoast(document: vscode.TextDocument): boolean {
  if (document.languageId === 'plaintext' || document.languageId === '') return false;

  if (document.getText().length > 4000) return false;

  return true;
}

export function deactivate() {}