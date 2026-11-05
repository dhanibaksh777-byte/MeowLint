import * as vscode from 'vscode';

export class MoodManager {
  private mood: 'idle' | 'sleeping' | 'angry' = 'idle';
  private idleTimer: NodeJS.Timeout | undefined;
  private textDocumentChangeDisposables: vscode.Disposable[] = [];
  private diagnosticsDisposables: vscode.Disposable[] = [];
  private sleepAfterSeconds: number;
  private lastDiagnosticCheck: Map<string, vscode.Diagnostic[]> = new Map();

  constructor() {
    const config = vscode.workspace.getConfiguration('meowlint');
    this.sleepAfterSeconds = config.get('sleepAfterSeconds', 30);

    this.setupTextDocumentChanges();
    this.setupDiagnostics();
    this.resetIdleTimer();
  }

  private setupTextDocumentChanges(): void {
    this.textDocumentChangeDisposables.push(
      vscode.workspace.onDidChangeTextDocument(() => {
        if (this.mood === 'sleeping') {
          this.setMood('idle');
        }
        this.resetIdleTimer();
      })
    );
  }

  private setupDiagnostics(): void {
    this.diagnosticsDisposables.push(
      vscode.languages.onDidChangeDiagnostics(event => {
        const fileUri = event.uris[0];
        const diagnostics = vscode.languages.getDiagnostics(fileUri);
        this.lastDiagnosticCheck.set(fileUri.toString(), diagnostics);
        this.checkForErrors();
      })
    );
  }

  private checkForErrors(): void {
    for (const [uri, diagnostics] of this.lastDiagnosticCheck) {
      if (diagnostics.length > 0) {
        this.setMood('angry');
        return;
      }
    }
    if (this.mood === 'angry') {
      this.setMood('idle');
    }
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      if (this.mood !== 'angry') {
        this.setMood('sleeping');
      }
    }, this.sleepAfterSeconds * 1000);
  }

  public getMood(): 'idle' | 'sleeping' | 'angry' {
    return this.mood;
  }

  public setMood(newMood: 'idle' | 'sleeping' | 'angry'): void {
    this.mood = newMood;
    this.resetIdleTimer();
  }

  public dispose(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.textDocumentChangeDisposables.forEach(d => d.dispose());
    this.diagnosticsDisposables.forEach(d => d.dispose());
  }
}