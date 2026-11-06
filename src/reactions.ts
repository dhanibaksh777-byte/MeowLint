import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ReactionConfig {
  idle: string[];
  watching: string[];
  angry: string[];
  shocked: string[];
  omg: string[];
  suspicious: string[];
  sleeping: string[];
  smug: string[];
  celebrate: string[];
  confused: string[];
}

export const REACTION_CONFIG: ReactionConfig = {
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

export interface ReactionUriMap {
  [key: string]: string;
}

export class ReactionManager {
  private context: vscode.ExtensionContext;
  private extensionUri: vscode.Uri;
  private reactionUriMap: ReactionUriMap = {};
  private missingFiles: string[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.extensionUri = context.extensionUri;
    this.buildUriMap();
  }

  private buildUriMap(): void {
    const config = REACTION_CONFIG;
    const missing: string[] = [];

    for (const [reactionId, files] of Object.entries(config) as [string, string[]][]) {
      let resolved = false;
      for (const file of files) {
        const filePath = path.join(this.context.extensionPath, 'media', file);
        try {
          fs.statSync(filePath);
          this.reactionUriMap[reactionId] = vscode.Uri.joinPath(this.extensionUri, 'media', file).toString();
          resolved = true;
          break;
        } catch {
          // File doesn't exist, try next variant
        }
      }
      if (!resolved && files.length > 0) {
        const firstFile = files[0];
        this.reactionUriMap[reactionId] = vscode.Uri.joinPath(this.extensionUri, 'media', firstFile).toString();
        missing.push(firstFile);
      } else if (!resolved && files.length === 0) {
        this.reactionUriMap[reactionId] = vscode.Uri.joinPath(this.extensionUri, 'media', 'logo.jpg').toString();
      }
    }

    this.missingFiles = missing;
    for (const missingFile of missing) {
      console.log(`[MeowLint] missing reaction image: ${missingFile}`);
    }
  }

  public getUri(reactionId: string): string | undefined {
    return this.reactionUriMap[reactionId];
  }

  public getMissingFiles(): string[] {
    return this.missingFiles;
  }

  public getUriMap(): ReactionUriMap {
    return { ...this.reactionUriMap };
  }
}

export function getReactionUri(extensionUri: vscode.Uri, reactionId: string): string | undefined {
  const config = REACTION_CONFIG;
  const files = config[reactionId as keyof ReactionConfig];
  if (!files || files.length === 0) return undefined;
  return vscode.Uri.joinPath(extensionUri, 'media', files[0]).toString();
}