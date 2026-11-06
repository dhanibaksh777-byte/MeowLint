import * as vscode from 'vscode';

export interface GameStateData {
  level: number;
  xp: number;
  totalXp: number;
  streak: number;
  bestStreak: number;
  totalRoasts: number;
  errorsFixed: number;
  achievements: Record<string, boolean>;
  seenReactions: Record<string, boolean>;
  lastCleanSave: number;
  lastSaveTime: number;
}

export interface GameStateShape {
  level: number;
  levelTitle: string;
  xp: number;
  xpToNext: number;
  totalXp: number;
  streak: number;
  bestStreak: number;
  totalRoasts: number;
  errorsFixed: number;
  annoyance: number;
  mood: 'idle' | 'sleeping' | 'angry';
  achievements: Array<{ id: string; name: string; description: string; unlocked: boolean }>;
}

const ACHIEVEMENTS: Record<string, { name: string; description: string }> = {
  firstRoast: { name: 'First Roast', description: 'Received your first code roast' },
  cleanFreak: { name: 'Clean Freak', description: '10 clean saves in a row' },
  bugSlayer: { name: 'Bug Slayer', description: 'Fixed 25 errors total' },
  nightOwl: { name: 'Night Owl', description: 'Saved a file after midnight' },
  survivor: { name: 'Survivor', description: 'Received 10 roasts' },
  catWhisperer: { name: 'Cat Whisperer', description: 'Reached Level 5' },
  reactionCollector: { name: 'Reaction Collector', description: 'Seen every reaction at least once' }
};

const LEVEL_TITLES = [
  'Kitten Coder',
  'Alley Debugger',
  'Lint Hunter',
  'Refactor Ninja',
  'Code Whisperer',
  'Grumpy Legend'
];

function xpToNextLevel(level: number): number {
  return 50 + (level - 1) * 25;
}

function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += xpToNextLevel(i);
  }
  return total;
}

export class GameState {
  private context: vscode.ExtensionContext;
  private data: GameStateData;
  private changeListeners: Array<(state: GameStateShape) => void> = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.data = this.load();
    this.migrate();
  }

  private migrate(): void {
    if (this.data.lastSaveTime === undefined) {
      this.data.lastSaveTime = 0;
    }
    if (this.data.seenReactions === undefined) {
      this.data.seenReactions = {};
    }
  }

  private load(): GameStateData {
    const saved = this.context.globalState.get<GameStateData>('meowlint.gameState');
    return saved || this.getDefaultState();
  }

  private getDefaultState(): GameStateData {
    return {
      level: 1,
      xp: 0,
      totalXp: 0,
      streak: 0,
      bestStreak: 0,
      totalRoasts: 0,
      errorsFixed: 0,
      achievements: {},
      seenReactions: {},
      lastCleanSave: 0,
      lastSaveTime: 0
    };
  }

  private save(): void {
    this.context.globalState.update('meowlint.gameState', this.data);
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.changeListeners.forEach(listener => listener(this.getState()));
  }

  public onChange(listener: (state: GameStateShape) => void): vscode.Disposable {
    this.changeListeners.push(listener);
    return { dispose: () => {
      const idx = this.changeListeners.indexOf(listener);
      if (idx >= 0) this.changeListeners.splice(idx, 1);
    }};
  }

  public getState(): GameStateShape {
    const level = this.data.level;
    const xpToNext = xpToNextLevel(level);
    const currentLevelXp = this.data.totalXp - totalXpForLevel(level);
    const annoyance = this.calculateAnnoyance();

    return {
      level: this.data.level,
      levelTitle: this.getLevelTitle(),
      xp: currentLevelXp,
      xpToNext,
      totalXp: this.data.totalXp,
      streak: this.data.streak,
      bestStreak: this.data.bestStreak,
      totalRoasts: this.data.totalRoasts,
      errorsFixed: this.data.errorsFixed,
      annoyance,
      mood: annoyance > 66 ? 'angry' : annoyance > 33 ? 'sleeping' : 'idle',
      achievements: this.getAchievements()
    };
  }

  private calculateAnnoyance(): number {
    let annoyance = 50;
    annoyance -= this.data.streak * 10;
    annoyance += this.data.errorsFixed * 5;
    return Math.max(0, Math.min(100, annoyance));
  }

  public getLevelTitle(): string {
    const idx = Math.min(this.data.level - 1, 5);
    return LEVEL_TITLES[idx];
  }

  public addXp(amount: number): { leveledUp: boolean; newLevel: number; oldLevel: number } {
    const oldLevel = this.data.level;
    this.data.totalXp += amount;
    let newLevel = 1;
    while (this.data.totalXp >= totalXpForLevel(newLevel + 1) && newLevel < 100) {
      newLevel++;
    }
    this.data.level = newLevel;
    const leveledUp = newLevel > oldLevel;
    if (leveledUp && this.data.level === 5) {
      this.unlockAchievement('catWhisperer');
    }
    this.save();
    return { leveledUp, newLevel: this.data.level, oldLevel };
  }

  public recordCleanSave(hasErrors: boolean, errorCount: number): { leveledUp: boolean; newLevel: number; annoyance: number } {
    const now = Date.now();
    const isMidnight = new Date().getHours() === 0;
    if (isMidnight) this.unlockAchievement('nightOwl');

    let leveledUp = false;
    let newLevel = this.data.level;

    if (!hasErrors) {
      this.data.streak++;
      this.data.lastCleanSave = now;
      const xpResult = this.addXp(10);
      leveledUp = xpResult.leveledUp;
      newLevel = xpResult.newLevel;
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
    return { leveledUp, newLevel, annoyance: this.calculateAnnoyance() };
  }

  public recordRoastReceived(): void {
    this.data.totalRoasts++;
    if (this.data.totalRoasts >= 10) {
      this.unlockAchievement('survivor');
    }
    if (this.data.totalRoasts === 1) {
      this.unlockAchievement('firstRoast');
    }
    this.save();
  }

  public recordErrorsFixed(prevStreak: number, errorCount: number): void {
    if (prevStreak > 0 && errorCount > 0) {
      this.data.errorsFixed += errorCount;
      if (this.data.errorsFixed >= 25) {
        this.unlockAchievement('bugSlayer');
      }
      this.save();
    }
  }

  public markReactionSeen(reactionId: string): boolean {
    if (!this.data.seenReactions[reactionId]) {
      this.data.seenReactions[reactionId] = true;
      this.save();
      // Check if all non-idle reactions seen
      const nonIdleReactions = ['watching', 'angry', 'shocked', 'omg', 'suspicious', 'smug', 'celebrate', 'confused'];
      const allSeen = nonIdleReactions.every(r => this.data.seenReactions[r]);
      if (allSeen) {
        this.unlockAchievement('reactionCollector');
      }
      return true;
    }
    return false;
  }

  public hasReactionBeenSeen(reactionId: string): boolean {
    return !!this.data.seenReactions[reactionId];
  }

  public unlockAchievement(key: string): boolean {
    if (!this.data.achievements[key]) {
      this.data.achievements[key] = true;
      return true;
    }
    return false;
  }

  public getAchievements(): Array<{ id: string; name: string; description: string; unlocked: boolean }> {
    return Object.entries(ACHIEVEMENTS).map(([key, value]) => ({
      id: key,
      name: value.name,
      description: value.description,
      unlocked: this.data.achievements[key] || false
    }));
  }

  public reset(): void {
    this.data = this.getDefaultState();
    this.save();
  }
}