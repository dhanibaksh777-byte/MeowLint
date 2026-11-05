import * as vscode from 'vscode';

export interface GameStateData {
  xp: number;
  level: number;
  streak: number;
  totalRoasts: number;
  bestStreak: number;
  errorsFixed: number;
  achievements: Record<string, boolean>;
  lastCleanSave: number;
}

const ACHIEVEMENTS: Record<string, { name: string; description: string }> = {
  firstRoast: { name: 'First Roast', description: 'Received your first code roast' },
  cleanFreak: { name: 'Clean Freak', description: '10 clean saves in a row' },
  bugSlayer: { name: 'Bug Slayer', description: 'Fixed 25 errors total' },
  nightOwl: { name: 'Night Owl', description: 'Saved a file after midnight' },
  survivor: { name: 'Survivor', description: 'Received 10 roasts' },
  catWhisperer: { name: 'Cat Whisperer', description: 'Reached Level 5' }
};

const LEVEL_TITLES = [
  'Kitten Coder',
  'Alley Debugger',
  'Lint Hunter',
  'Refactor Ninja',
  'Code Whisperer',
  'Grumpy Legend'
];

const XP_PER_LEVEL = 100;

export class GameState {
  private context: vscode.ExtensionContext;
  private data: GameStateData;
  private changeListeners: Array<(data: GameStateData) => void> = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.data = this.load();
  }

  private load(): GameStateData {
    const saved = this.context.globalState.get<GameStateData>('meowlint.gameState');
    return saved || this.getDefaultState();
  }

  private getDefaultState(): GameStateData {
    return {
      xp: 0,
      level: 1,
      streak: 0,
      totalRoasts: 0,
      bestStreak: 0,
      errorsFixed: 0,
      achievements: {},
      lastCleanSave: 0
    };
  }

  private save(): void {
    this.context.globalState.update('meowlint.gameState', this.data);
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.changeListeners.forEach(listener => listener(this.data));
  }

  public onChange(listener: (data: GameStateData) => void): vscode.Disposable {
    this.changeListeners.push(listener);
    return { dispose: () => {
      const idx = this.changeListeners.indexOf(listener);
      if (idx >= 0) this.changeListeners.splice(idx, 1);
    }};
  }

  public getState(): GameStateData {
    return { ...this.data };
  }

  public getLevelTitle(): string {
    const idx = Math.min(this.data.level - 1, LEVEL_TITLES.length - 1);
    return LEVEL_TITLES[idx];
  }

  public getXpForNextLevel(): number {
    return XP_PER_LEVEL;
  }

  public getXpProgress(): number {
    return this.data.xp % XP_PER_LEVEL;
  }

  public getAnnoyanceLevel(): number {
    return Math.min(100, Math.max(0, 50 - this.data.streak * 5 + (this.data.errorsFixed % 10) * 2));
  }

  public addXp(amount: number): { leveledUp: boolean; newLevel: number } {
    const oldLevel = this.data.level;
    this.data.xp += amount;
    this.data.level = Math.floor(this.data.xp / XP_PER_LEVEL) + 1;
    const leveledUp = this.data.level > oldLevel;
    if (leveledUp && this.data.level === 5) {
      this.unlockAchievement('catWhisperer');
    }
    this.save();
    return { leveledUp, newLevel: this.data.level };
  }

  public recordCleanSave(hasErrors: boolean, errorCount: number): void {
    const now = Date.now();
    const isMidnight = new Date().getHours() === 0;
    if (isMidnight) this.unlockAchievement('nightOwl');

    if (!hasErrors) {
      this.data.streak++;
      this.data.lastCleanSave = now;
      this.addXp(10);
      if (this.data.streak > this.data.bestStreak) {
        this.data.bestStreak = this.data.streak;
      }
      if (this.data.streak >= 10) {
        this.unlockAchievement('cleanFreak');
      }
    } else {
      const prevStreak = this.data.streak;
      this.data.streak = 0;
      this.addXp(2);
      if (prevStreak > 0 && errorCount > 0) {
        this.data.errorsFixed += errorCount;
        if (this.data.errorsFixed >= 25) {
          this.unlockAchievement('bugSlayer');
        }
      }
    }
    this.save();
  }

  public recordRoast(): void {
    this.data.totalRoasts++;
    if (this.data.totalRoasts >= 10) {
      this.unlockAchievement('survivor');
    }
    this.save();
  }

  private unlockAchievement(key: string): boolean {
    if (!this.data.achievements[key]) {
      this.data.achievements[key] = true;
      return true;
    }
    return false;
  }

  public getAchievements(): Array<{ key: string; name: string; description: string; unlocked: boolean }> {
    return Object.entries(ACHIEVEMENTS).map(([key, value]) => ({
      key,
      name: value.name,
      description: value.description,
      unlocked: this.data.achievements[key] || false
    }));
  }

  public getLockedAchievementsCount(): number {
    return Object.keys(ACHIEVEMENTS).filter(k => !this.data.achievements[k]).length;
  }

  public reset(): void {
    this.data = this.getDefaultState();
    this.save();
  }
}