import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type { RoomState, Player, WordSubmission } from '../types/game';
import { soundFX } from '../utils/sound';

interface PlayerMobileViewProps {
  roomState: RoomState;
  playerId: string;
  onJoinGame: (name: string) => void;
  onSubmitWord: (word: string) => void;
  lastFeedback: {
    word: string;
    isValid: boolean;
    totalPoints: number;
    accuracyScore?: number;
    speedBonus?: number;
    uniquenessBonus?: number;
    reason: string;
  } | null;
}

export const PlayerMobileView: React.FC<PlayerMobileViewProps> = ({
  roomState,
  playerId,
  onJoinGame,
  onSubmitWord,
  lastFeedback,
}) => {
  const existingPlayer: Player | undefined = roomState.players[playerId];
  const [nameInput, setNameInput] = useState(
    () => localStorage.getItem('lexirush_player_name') || ''
  );
  const [wordInput, setWordInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const wordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (roomState.phase === 'PLAYING') {
      wordInputRef.current?.focus();
    }
  }, [roomState.phase, roomState.currentRound]);

  useEffect(() => {
    if (!lastFeedback) return;
    setIsSubmitting(false);
    if (lastFeedback.isValid) {
      soundFX.playSuccess();
    } else {
      soundFX.playError();
    }
  }, [lastFeedback]);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName) return;
    localStorage.setItem('lexirush_player_name', cleanName);
    onJoinGame(cleanName);
  };

  const handleWordFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = wordInput.trim();
    if (!trimmed || roomState.phase !== 'PLAYING') return;
    setIsSubmitting(true);
    onSubmitWord(trimmed);
    setWordInput('');
    wordInputRef.current?.focus();
  };

  const playersSorted: Player[] = (Object.values(roomState.players) as Player[]).sort(
    (a, b) => b.totalScore - a.totalScore
  );
  const myOverallRank = existingPlayer
    ? playersSorted.findIndex((p) => p.id === existingPlayer.id) + 1
    : null;

  const currentCategory =
    roomState.categories[roomState.currentRound - 1] || roomState.categories[0];

  const myCurrentRoundSubmissions: WordSubmission[] = roomState.submissions.filter(
    (s) => s.round === roomState.currentRound && s.playerId === playerId
  );

  // If the challenger hasn't joined yet, show simple mobile registration form (Name only)
  if (!existingPlayer) {
    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-lg">
          <div className="space-y-1.5">
            <div className="text-xs font-mono text-indigo-400">
              ROOM PIN · {roomState.pin}
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              加入「{roomState.title}」
            </h1>
            <p className="text-xs text-slate-400">
              請輸入您的挑戰者姓名或暱稱，即可與全場 100 位同仁即時連線搶答。
            </p>
          </div>

          <form onSubmit={handleJoinSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                挑戰者姓名 / 暱稱
              </label>
              <input
                type="text"
                required
                maxLength={18}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="例如：王小明 / Alex"
                className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-base text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCheck className="w-5 h-5" />
              進入競賽大廳
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Compact Player Status Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: existingPlayer.avatarColor }}
          >
            {existingPlayer.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">
              {existingPlayer.name}
            </div>
            <div className="text-xs text-slate-400 truncate">
              挑戰者連線中
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-right font-mono tabular-nums shrink-0">
          <div>
            <div className="text-[11px] text-slate-400">目前總排名</div>
            <div className="text-sm font-bold text-amber-400">
              #{myOverallRank || '-'} / {playersSorted.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">累計總積分</div>
            <div className="text-base font-extrabold text-indigo-400">
              {existingPlayer.totalScore.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* LOBBY WAITING STATE */}
      {roomState.phase === 'LOBBY' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="text-xs font-semibold text-emerald-400">
            連線成功 · 已加入競賽房間 ({Object.keys(roomState.players).length} / 100 人在線)
          </div>
          <h2 className="text-xl font-bold text-white">
            請注視前方大螢幕，等待主持人開始第一輪！
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            每輪揭曉「題目類型」後，請在手機上盡可能快速輸入多個相關詞彙。越快、越準確、越少人撞詞，得分越高！
          </p>
        </div>
      )}

      {/* COUNTDOWN STATE */}
      {roomState.phase === 'COUNTDOWN' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="text-xs font-semibold text-indigo-400">
            第 {roomState.currentRound} / {roomState.totalRounds} 輪即將開始
          </div>
          <div className="text-2xl font-extrabold text-white">
            本輪類型：「{currentCategory.title}」
          </div>
          <div className="text-6xl font-mono font-extrabold text-amber-400 tabular-nums py-4">
            {roomState.timeRemainingSec}
          </div>
          <p className="text-xs text-slate-400">{currentCategory.description}</p>
        </div>
      )}

      {/* ACTIVE PLAYING CONTROLLER */}
      {roomState.phase === 'PLAYING' && (
        <div className="space-y-4">
          {/* Category & Timer Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-400">
                第 {roomState.currentRound} / {roomState.totalRounds} 輪 · 難度 {currentCategory.difficulty}
              </span>
              <div
                className={`inline-flex items-center gap-1.5 font-mono text-xl font-extrabold tabular-nums ${
                  roomState.timeRemainingSec <= 10 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                <Clock className="w-4 h-4" />
                {roomState.timeRemainingSec}s
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-0.5">請輸入屬於此類型的詞彙：</div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                {currentCategory.title}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{currentCategory.description}</p>
            </div>
          </div>

          {/* Rapid Word Input Box */}
          <form onSubmit={handleWordFormSubmit} className="space-y-2.5">
            <div className="flex gap-2">
              <input
                ref={wordInputRef}
                type="text"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                placeholder={`輸入「${currentCategory.title}」相關詞彙...`}
                maxLength={25}
                autoComplete="off"
                className="flex-1 px-4 py-4 bg-slate-950 border-2 border-indigo-500/80 focus:border-indigo-400 rounded-xl text-lg font-semibold text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!wordInput.trim() || isSubmitting}
                className="px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Send className="w-5 h-5" />
                送出
              </button>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
              <span>提示：輸入後按 Enter 或點擊送出，可連續無限輸入多個詞彙！</span>
              <span className="font-mono tabular-nums">
                本輪得分 +{existingPlayer.roundScores[roomState.currentRound] || 0}
              </span>
            </div>
          </form>

          {/* Instant Scoring Feedback Banner */}
          {lastFeedback && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                lastFeedback.isValid
                  ? 'bg-emerald-950/40 border-emerald-700/70 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-800/70 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {lastFeedback.isValid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">
                    「{lastFeedback.word}」 — {lastFeedback.reason}
                  </div>
                  {lastFeedback.isValid && (
                    <div className="text-xs text-emerald-300/80 font-mono tabular-nums">
                      準確度 {lastFeedback.accuracyScore} + 速度 {lastFeedback.speedBonus}
                      {lastFeedback.uniquenessBonus
                        ? ` + 首發獨創 ${lastFeedback.uniquenessBonus}`
                        : ''}
                    </div>
                  )}
                </div>
              </div>

              <div className="font-mono font-extrabold text-lg tabular-nums shrink-0 ml-3">
                +{lastFeedback.totalPoints} 分
              </div>
            </div>
          )}

          {/* Player's Submitted Words in Current Round */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>您在本輪已提交的詞彙 ({myCurrentRoundSubmissions.length})</span>
              <span className="font-mono tabular-nums">
                本輪累計：+{existingPlayer.roundScores[roomState.currentRound] || 0} 分
              </span>
            </div>

            {myCurrentRoundSubmissions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                尚未輸入詞彙，快趁別人還沒想到的時候搶先輸入！
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {[...myCurrentRoundSubmissions].reverse().map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between px-3 py-2 bg-slate-950 border border-slate-800/80 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={sub.isValid ? 'text-emerald-400' : 'text-rose-400'}>
                        {sub.isValid ? '✓' : '✕'}
                      </span>
                      <span className="font-bold text-white text-sm">{sub.word}</span>
                      <span className="text-slate-400">· {sub.reason}</span>
                    </div>
                    <span className="font-mono font-bold text-indigo-400 tabular-nums">
                      +{sub.totalPoints}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ROUND LEADERBOARD STATE ON MOBILE */}
      {roomState.phase === 'ROUND_LEADERBOARD' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="text-center space-y-1">
            <div className="text-xs font-semibold text-indigo-400">
              第 {roomState.currentRound} 輪結算完成
            </div>
            <h2 className="text-xl font-bold text-white">
              您在本輪獲得 +{existingPlayer.roundScores[roomState.currentRound] || 0} 分
            </h2>
            <p className="text-xs text-slate-400">
              目前總排名第 <strong className="text-amber-400">#{myOverallRank}</strong> 名（累計{' '}
              {existingPlayer.totalScore.toLocaleString()} 分）
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-400 mb-2">
              本輪 Top 5 領先榜
            </div>
            {roomState.roundSummaries
              .find((s) => s.roundNumber === roomState.currentRound)
              ?.top5Players.map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs ${
                    p.id === playerId
                      ? 'bg-indigo-950/50 border-indigo-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-amber-400">#{idx + 1}</span>
                    <span className="font-semibold text-white">{p.name}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 tabular-nums">
                    +{p.roundScore} 分
                  </span>
                </div>
              ))}
          </div>

          <div className="text-center text-xs text-slate-400 pt-2">
            請準備迎接下一輪題目挑戰！
          </div>
        </div>
      )}

      {/* GAME OVER / REPORT STATE ON MOBILE: Show Personal Score + Final Leaderboard */}
      {(roomState.phase === 'GAME_OVER' || roomState.phase === 'REPORT') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="text-center space-y-3">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
            <div className="space-y-1">
              <div className="text-xs font-semibold text-amber-400">比賽圓滿結束 · 最終成績結算</div>
              <h2 className="text-2xl font-extrabold text-white">
                您的最終排名：第 #{myOverallRank} 名
              </h2>
              <p className="text-xs text-slate-400">
                總得分{' '}
                <strong className="text-indigo-400 font-mono">
                  {existingPlayer.totalScore.toLocaleString()}
                </strong>{' '}
                分 · 累計通過 {existingPlayer.validWordsCount} 個有效詞彙
              </p>
            </div>

            <div className="grid grid-cols-5 gap-1.5 pt-2">
              {roomState.categories.map((cat) => (
                <div
                  key={cat.roundNumber}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center"
                >
                  <div className="text-[10px] text-slate-400">R{cat.roundNumber}</div>
                  <div className="text-xs font-mono font-bold text-white tabular-nums">
                    {existingPlayer.roundScores[cat.roundNumber] || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Final Leaderboard on Participant Phone */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
              <span>全場最終排名成績榜</span>
              <span>共 {playersSorted.length} 位挑戰者</span>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {playersSorted.map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs ${
                    p.id === playerId
                      ? 'bg-indigo-950/60 border-indigo-500/80 text-white'
                      : 'bg-slate-950 border-slate-800/90 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-950'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-white truncate">{p.name}</span>
                    {p.id === playerId && (
                      <span className="text-[10px] font-bold text-indigo-400 shrink-0">(您)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                    <span className="text-slate-400 text-[11px]">{p.validWordsCount} 詞</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      {p.totalScore.toLocaleString()} 分
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
