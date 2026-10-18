import type {
  RoomState,
  Player,
  WordSubmission,
  RoundCategory,
  RoundSummary,
  AIReportInsights,
} from '../types/game';
import {
  DEFAULT_SELECTED_IDS,
  getCategoriesByIds,
  CATEGORY_KNOWLEDGE_BASE,
  evaluateWordWithOnlineVerification,
} from '../data/categoryLexicon';

export const AVATAR_COLORS = [
  '#2563EB',
  '#4F46E5',
  '#0D9488',
  '#059669',
  '#D97706',
  '#DC2626',
  '#E11D48',
  '#7C3AED',
  '#0284C7',
  '#65A30D',
];

export function createInitialRoomState(customPin?: string): RoomState {
  const initialCategories = getCategoriesByIds(DEFAULT_SELECTED_IDS);
  return {
    pin: customPin || '888168',
    title: '年度企業全員腦力激盪大賽',
    phase: 'LOBBY',
    currentRound: 1,
    totalRounds: initialCategories.length,
    roundDurationSec: 45,
    roundStartTime: null,
    timeRemainingSec: 45,
    categories: initialCategories,
    players: {},
    submissions: [],
    roundSummaries: [],
    aiReport: null,
    isGeneratingCategories: false,
    isGeneratingReport: false,
  };
}

export function buildRoundSummary(roomState: RoomState, roundNum: number): RoundSummary {
  const category = roomState.categories[roundNum - 1] || roomState.categories[0];
  const roundSubs = roomState.submissions.filter((s) => s.round === roundNum);
  const validSubs = roundSubs.filter((s) => s.isValid);
  const uniqueWords = new Set(validSubs.map((s) => s.word.toLowerCase()));

  const playersList = Object.values(roomState.players) as Player[];
  const sortedForRound = [...playersList]
    .sort((a, b) => {
      const rDiff = (b.roundScores[roundNum] || 0) - (a.roundScores[roundNum] || 0);
      if (rDiff !== 0) return rDiff;
      return b.totalScore - a.totalScore;
    })
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      name: p.name,
      department: p.department,
      roundScore: p.roundScores[roundNum] || 0,
      totalScore: p.totalScore,
      validCount: validSubs.filter((s) => s.playerId === p.id).length,
    }));

  let fastestWord: RoundSummary['fastestWord'] = undefined;
  if (validSubs.length > 0) {
    const fastest = [...validSubs].sort((a, b) => a.timestampMs - b.timestampMs)[0];
    fastestWord = {
      word: fastest.word,
      playerName: fastest.playerName,
      timeMs: fastest.timestampMs,
    };
  }

  let mostCreativeWord: RoundSummary['mostCreativeWord'] = undefined;
  if (validSubs.length > 0) {
    const highestAcc = [...validSubs].sort((a, b) => {
      if (b.accuracyScore !== a.accuracyScore) return b.accuracyScore - a.accuracyScore;
      return b.totalPoints - a.totalPoints;
    })[0];
    mostCreativeWord = {
      word: highestAcc.word,
      playerName: highestAcc.playerName,
      accuracyScore: highestAcc.accuracyScore,
    };
  }

  return {
    roundNumber: roundNum,
    category,
    top5Players: sortedForRound,
    totalSubmissions: roundSubs.length,
    validSubmissions: validSubs.length,
    uniqueWordsCount: uniqueWords.size,
    fastestWord,
    mostCreativeWord,
  };
}

export function generateLocalStatisticalReport(roomState: RoomState): AIReportInsights {
  const players = (Object.values(roomState.players) as Player[]).sort(
    (a, b) => b.totalScore - a.totalScore
  );
  const validSubs = roomState.submissions.filter((s) => s.isValid);
  const totalSubs = roomState.submissions.length;
  const accuracyRate = totalSubs > 0 ? Math.round((validSubs.length / totalSubs) * 100) : 0;
  const uniqueWords = new Set(validSubs.map((s) => s.word.toLowerCase()));
  const uniquenessRatio =
    validSubs.length > 0 ? Math.round((uniqueWords.size / validSubs.length) * 100) : 0;

  const avgReactionSec =
    validSubs.length > 0
      ? (validSubs.reduce((acc, s) => acc + s.timestampMs, 0) / validSubs.length / 1000).toFixed(1)
      : '0.0';

  const first10SecCount = validSubs.filter((s) => s.timestampMs <= 10000).length;
  const earlyBurstPct =
    validSubs.length > 0 ? Math.round((first10SecCount / validSubs.length) * 100) : 0;

  const champion = players[0];
  const fastestPlayer = [...players]
    .filter((p) => p.fastestSubmissionMs !== null)
    .sort((a, b) => (a.fastestSubmissionMs || 999999) - (b.fastestSubmissionMs || 999999))[0];

  const roundCounts = roomState.categories.map((c) => {
    const rSubs = validSubs.filter((s) => s.round === c.roundNumber);
    return { title: c.title, count: rSubs.length };
  });
  const mostActiveRound = [...roundCounts].sort((a, b) => b.count - a.count)[0];

  const topSubs = [...validSubs].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 4);

  return {
    executiveSummary:
      totalSubs > 0
        ? `本場賽事共有 ${players.length} 位挑戰者同場競技（支援 100 人同時連線），共 ${roomState.totalRounds} 輪累計提交 ${totalSubs} 次詞彙，其中 ${validSubs.length} 個詞彙通過本地詞庫與網路百科審核（整體準確率 ${accuracyRate}%）。${
            champion
              ? `最終由挑戰者「${champion.name}」以 ${champion.totalScore.toLocaleString()} 分奪得全場總冠軍。`
              : ''
          }`
        : `目前尚無完賽作答數據。當挑戰者完成各輪詞彙挑戰後，系統將自動根據作答秒數、詞庫命中率與積分分布產出完整統計摘要。`,
    teamCreativityAnalysis:
      validSubs.length > 0
        ? `全場共產出 ${uniqueWords.size} 個不重複的有效詞彙，詞彙獨創率達 ${uniquenessRatio}%。其中以「${
            mostActiveRound?.title || '第一輪'
          }」的發想最為熱絡（單輪貢獻 ${
            mostActiveRound?.count || 0
          } 個有效詞），顯示挑戰者在該主題下具備極佳的橫向聯想力。`
        : `待比賽開始後，系統將自動計算各輪「不重複詞彙比例」與「首發獨創加成次數」，評估全場發散思維表現。`,
    speedAndAccuracyBalance:
      validSubs.length > 0
        ? `全體挑戰者平均反應時間為開局後 ${avgReactionSec} 秒，其中有 ${earlyBurstPct}% 的有效詞彙於每輪前 10 秒黃金時間內極速送出，同時維持了 ${accuracyRate}% 的高準確率，展現出快節奏與精準度兼具的反應素質。`
        : `系統將在賽後統計每輪開局前 10 秒的爆發作答比例與平均反應耗時，量化挑戰者在時間壓力下的反應效率。`,
    departmentHighlights: [
      champion
        ? `全場總冠軍為「${champion.name}」（總積分 ${champion.totalScore.toLocaleString()} 分，累計貢獻 ${champion.validWordsCount} 個有效詞彙）。`
        : '個人戰力排行將於挑戰者加入並得分後自動計算。',
      fastestPlayer && fastestPlayer.fastestSubmissionMs !== null
        ? `全場最快極速反應王為「${fastestPlayer.name}」，最快於開局 ${(
            fastestPlayer.fastestSubmissionMs / 1000
          ).toFixed(2)} 秒即成功送出正確詞彙。`
        : `全場共有 ${validSubs.filter((s) => s.uniquenessBonus > 0).length} 次作答獲得「全場首發不撞詞 (+20分)」獎勵。`,
      `雙層審核引擎（內建詞庫 + 網路百科查證）即時完成所有詞彙審核與計分，支援 100 人同場零延遲競速。`,
    ],
    topCreativeWords:
      topSubs.length > 0
        ? topSubs.map((s) => ({
            word: s.word,
            category: s.category,
            playerName: s.playerName,
            comment: `單詞總計 +${s.totalPoints} 分（準確度 ${s.accuracyScore} · 開局 ${(
              s.timestampMs / 1000
            ).toFixed(1)} 秒送出）`,
          }))
        : [
            {
              word: '台灣黑熊',
              category: '動物',
              playerName: '系統範例',
              comment: '精準命中核心詞庫且具備首發獨創加成',
            },
          ],
    recommendations: [
      '建議於企業大型活動、月會或破冰場合直接投影 QR Code，讓 100 位挑戰者掃碼輸入姓名即可秒速開賽。',
      '主持人可於大廳直接勾選本場要進行的單一題庫，系統將依勾選順序進行各輪比拚。',
      '賽後可點擊右上角「下載挑戰者成績報表 CSV」或「匯出詞彙明細 CSV」，直接用於活動頒獎與紀錄留存。',
    ],
  };
}

export function applyPlayerJoin(
  roomState: RoomState,
  id: string,
  name: string,
  department?: string
): boolean {
  const cleanName = (name || '').trim().slice(0, 20);
  const cleanDept = (department || '挑戰者').trim().slice(0, 20);
  if (!id || !cleanName) return false;

  const existing = roomState.players[id];
  if (existing) {
    existing.name = cleanName;
    existing.department = cleanDept;
    existing.connected = true;
  } else {
    const colorIndex = Object.keys(roomState.players).length % AVATAR_COLORS.length;
    roomState.players[id] = {
      id,
      name: cleanName,
      department: cleanDept,
      avatarColor: AVATAR_COLORS[colorIndex],
      connected: true,
      totalScore: 0,
      roundScores: {},
      validWordsCount: 0,
      totalSubmissionsCount: 0,
      avgReactionTimeMs: 0,
      fastestSubmissionMs: null,
      joinedAt: Date.now(),
    };
  }
  return true;
}

export async function processPlayerWordSubmission(
  roomState: RoomState,
  playerId: string,
  rawWord: string
): Promise<{
  feedback: {
    word: string;
    isValid: boolean;
    totalPoints: number;
    accuracyScore?: number;
    speedBonus?: number;
    uniquenessBonus?: number;
    reason: string;
  };
  submission?: WordSubmission;
} | null> {
  if (roomState.phase !== 'PLAYING') return null;

  const player = roomState.players[playerId];
  const cleanWord = (rawWord || '').trim().slice(0, 24);
  if (!player || !cleanWord) return null;

  const currentRound = roomState.currentRound;
  const currentCat =
    roomState.categories[currentRound - 1] || roomState.categories[0];

  // Check if this player already submitted the exact same word in this round
  const duplicateBySelf = roomState.submissions.find(
    (s) =>
      s.round === currentRound &&
      s.playerId === playerId &&
      s.word.toLowerCase() === cleanWord.toLowerCase()
  );

  if (duplicateBySelf) {
    return {
      feedback: {
        word: cleanWord,
        isValid: false,
        totalPoints: 0,
        reason: '您在本輪已經輸入過這個詞彙了！',
      },
    };
  }

  const now = Date.now();
  const elapsedMs = roomState.roundStartTime ? Math.max(0, now - roomState.roundStartTime) : 5000;

  const evalResult = await evaluateWordWithOnlineVerification(cleanWord, currentCat);

  // Re-verify phase in case round ended during online check
  if (roomState.phase !== 'PLAYING') return null;

  const durationMs = roomState.roundDurationSec * 1000;
  const speedRatio = Math.max(0, 1 - elapsedMs / durationMs);
  const speedBonus = evalResult.isValid ? Math.round(speedRatio * 50) : 0;

  const alreadyUsedInRoom = roomState.submissions.some(
    (s) =>
      s.round === currentRound &&
      s.isValid &&
      s.word.toLowerCase() === cleanWord.toLowerCase()
  );
  const uniquenessBonus = evalResult.isValid && !alreadyUsedInRoom ? 20 : 0;

  const totalPoints = evalResult.isValid
    ? evalResult.accuracyScore + speedBonus + uniquenessBonus
    : 0;

  const submission: WordSubmission = {
    id: `${currentRound}-${playerId}-${now}-${Math.random().toString(36).slice(2, 6)}`,
    playerId,
    playerName: player.name,
    department: player.department,
    word: cleanWord,
    round: currentRound,
    category: currentCat.title,
    timestampMs: elapsedMs,
    isValid: evalResult.isValid,
    accuracyScore: evalResult.accuracyScore,
    speedBonus,
    uniquenessBonus,
    totalPoints,
    reason: evalResult.reason,
  };

  roomState.submissions.push(submission);

  player.totalSubmissionsCount += 1;
  if (evalResult.isValid) {
    player.validWordsCount += 1;
    player.totalScore += totalPoints;
    player.roundScores[currentRound] = (player.roundScores[currentRound] || 0) + totalPoints;

    if (player.fastestSubmissionMs === null || elapsedMs < player.fastestSubmissionMs) {
      player.fastestSubmissionMs = elapsedMs;
    }

    const playerValidSubs = roomState.submissions.filter(
      (s) => s.playerId === playerId && s.isValid
    );
    const sumMs = playerValidSubs.reduce((acc, s) => acc + s.timestampMs, 0);
    player.avgReactionTimeMs = Math.round(sumMs / playerValidSubs.length);
  }

  return {
    feedback: {
      word: cleanWord,
      isValid: evalResult.isValid,
      totalPoints,
      accuracyScore: evalResult.accuracyScore,
      speedBonus,
      uniquenessBonus,
      reason: evalResult.reason,
    },
    submission,
  };
}

export { CATEGORY_KNOWLEDGE_BASE };
