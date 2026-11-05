import * as vscode from 'vscode';

const GEMINI_MODEL = 'gemini-2.0-flash-lite';

export class Roaster {
  private extensionContext: vscode.ExtensionContext;
  private roastDebounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(extensionContext: vscode.ExtensionContext) {
    this.extensionContext = extensionContext;
  }

  public async generateRoast(document: vscode.TextDocument): Promise<string | null> {
    if (!this.shouldRoast(document)) {
      return null;
    }

    const apiKey = await this.extensionContext.secrets.get('geminiApiKey');
    if (!apiKey) {
      return null;
    }

    const roastIntensity = this.getRoastIntensity();
    const content = document.getText();
    const roast = await this.roastWithGemini(content, apiKey, document.languageId, roastIntensity);

    return roast;
  }

  private shouldRoast(document: vscode.TextDocument): boolean {
    if (document.languageId === 'plaintext' || document.languageId === '') {
      return false;
    }

    if (document.getText().length > 4000) {
      return false;
    }

    return true;
  }

  private getRoastIntensity(): 'mild' | 'medium' | 'savage' {
    const config = vscode.workspace.getConfiguration('meowlint');
    const intensity = config.get('roastIntensity', 'medium') as string;
    if (['mild', 'medium', 'savage'].includes(intensity)) {
      return intensity as 'mild' | 'medium' | 'savage';
    }
    return 'medium';
  }

  private async roastWithGemini(content: string, apiKey: string, languageId: string, intensity: 'mild' | 'medium' | 'savage'): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: this.getRoastPrompt(languageId, content, intensity)
              }]
            }]
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          return "I'm taking a nap... too many requests!";
        } else if (response.status === 503) {
          return "I'm purring in my sleep... service unavailable!";
        } else {
          return "I'm hiding from errors... something went wrong!";
        }
      }

      const data = await response.json();

      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      } else {
        return "I'm thinking... no roast today!";
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return "I'm chasing my tail... timeout!";
        }
      }

      return "I'm hiding from the internet... check your connection!";
    }
  }

  private getRoastPrompt(languageId: string, content: string, intensity: 'mild' | 'medium' | 'savage'): string {
    const basePrompt = `Act as a grumpy, sarcastic cat reviewing this ${languageId} code. Keep it under 2 short sentences. Roast actual code issues like poor naming, excessive nesting, duplicated logic, or missing error handling. Be playful but not abusive. Focus on real code quality problems.`;

    let intensityModifier = '';
    switch (intensity) {
      case 'mild':
        intensityModifier = 'Be gentle and kind with your roasts, like a sleepy cat.';
        break;
      case 'savage':
        intensityModifier = 'Be brutally honest and savage, no mercy!';
        break;
      case 'medium':
        intensityModifier = 'Be balanced - witty but not overly harsh.';
        break;
    }

    return `${basePrompt} ${intensityModifier}\n\nCode to review:\n${content}`;
  }
}