export type GamePhase =
  | 'LOBBY'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'ROUND_LEADERBOARD'
  | 'GAME_OVER'
  | 'REPORT';

export interface WordSubmission {
  id: string;
  playerId: string;
  playerName: string;
  department: string;
  word: string;
  round: number;
  category: string;
  timestampMs: number; // ms since round started
  isValid: boolean;
  accuracyScore: number; // 0 to 100
  speedBonus: number; // 0 to 50
  uniquenessBonus: number; // 0 or 20
  totalPoints: number;
  reason: string;
}

export interface Player {
  id: string;
  name: string;
  department: string;
  avatarColor: string;
  connected: boolean;
  totalScore: number;
  roundScores: Record<number, number>; // roundNumber -> score
  validWordsCount: number;
  totalSubmissionsCount: number;
  avgReactionTimeMs: number;
  fastestSubmissionMs: number | null;
  joinedAt: number;
}

export interface RoundCategory {
  roundNumber: number;
  title: string;
  description: string;
  examples: string[];
  difficulty: '標準' | '進階' | '挑戰';
}

export interface RoundSummary {
  roundNumber: number;
  category: RoundCategory;
  top5Players: {
    id: string;
    name: string;
    department: string;
    roundScore: number;
    totalScore: number;
    validCount: number;
  }[];
  totalSubmissions: number;
  validSubmissions: number;
  uniqueWordsCount: number;
  fastestWord?: {
    word: string;
    playerName: string;
    timeMs: number;
  };
  mostCreativeWord?: {
    word: string;
    playerName: string;
    accuracyScore: number;
  };
}

export interface AIReportInsights {
  executiveSummary: string;
  teamCreativityAnalysis: string;
  speedAndAccuracyBalance: string;
  departmentHighlights: string[];
  topCreativeWords: { word: string; category: string; playerName: string; comment: string }[];
  recommendations: string[];
}

export interface RoomState {
  pin: string;
  title: string;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  roundDurationSec: number;
  roundStartTime: number | null;
  timeRemainingSec: number;
  categories: RoundCategory[];
  players: Record<string, Player>;
  submissions: WordSubmission[]; // all submissions across rounds
  roundSummaries: RoundSummary[];
  aiReport: AIReportInsights | null;
  isGeneratingCategories: boolean;
  isGeneratingReport: boolean;
}
