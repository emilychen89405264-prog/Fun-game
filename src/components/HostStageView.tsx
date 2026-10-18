import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Users,
  Play,
  Shuffle,
  Clock,
  Trophy,
  ArrowRight,
  BarChart3,
  RotateCcw,
  Copy,
  Check,
  Volume2,
  VolumeX,
  FastForward,
  Zap,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { RoomState, Player, RoundCategory, WordSubmission } from '../types/game';
import { CATEGORY_KNOWLEDGE_BASE, getCategoriesByIds } from '../data/categoryLexicon';
import { AnalyticsReport } from './AnalyticsReport';
import { soundFX } from '../utils/sound';

interface HostStageViewProps {
  roomState: RoomState;
  joinUrl: string;
  onStartGame: () => void;
  onNextRound: () => void;
  onEndRoundEarly: () => void;
  onShowReport: () => void;
  onBackToPodium: () => void;
  onResetGame: () => void;
  onUpdateSettings: (payload: {
    roundDurationSec?: number;
    categories?: RoundCategory[];
    title?: string;
  }) => void;
  onRegenerateReport: () => void;
}

export const HostStageView: React.FC<HostStageViewProps> = ({
  roomState,
  joinUrl,
  onStartGame,
  onNextRound,
  onEndRoundEarly,
  onShowReport,
  onBackToPodium,
  onResetGame,
  onUpdateSettings,
  onRegenerateReport,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Derive currently checked category IDs in order from roomState.categories
  const selectedIds: string[] = roomState.categories
    .map((cat) => CATEGORY_KNOWLEDGE_BASE.find((kb) => kb.title === cat.title)?.id)
    .filter((id): id is string => Boolean(id));

  useEffect(() => {
    if (roomState.phase === 'GAME_OVER') {
      soundFX.playRoundEnd();
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
      });
    } else if (roomState.phase === 'ROUND_LEADERBOARD') {
      soundFX.playRoundEnd();
    } else if (
      roomState.phase === 'PLAYING' &&
      roomState.timeRemainingSec <= 5 &&
      roomState.timeRemainingSec > 0
    ) {
      soundFX.playTick(true);
    }
  }, [roomState.phase, roomState.timeRemainingSec]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFX.enabled = next;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  };

  const handleToggleCategory = (id: string) => {
    let nextIds: string[];
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 1) return; // Keep at least 1 category selected
      nextIds = selectedIds.filter((item) => item !== id);
    } else {
      nextIds = [...selectedIds, id];
    }
    const updatedCategories = getCategoriesByIds(nextIds);
    onUpdateSettings({ categories: updatedCategories });
  };

  const handleRandomPick5 = () => {
    const shuffled = [...CATEGORY_KNOWLEDGE_BASE].sort(() => Math.random() - 0.5);
    const nextIds = shuffled.slice(0, 5).map((item) => item.id);
    const updatedCategories = getCategoriesByIds(nextIds);
    onUpdateSettings({ categories: updatedCategories });
  };

  const playersList: Player[] = (Object.values(roomState.players) as Player[]).sort(
    (a, b) => b.totalScore - a.totalScore
  );
  const connectedCount = playersList.filter((p) => p.connected).length;

  const currentCategory =
    roomState.categories[roomState.currentRound - 1] || roomState.categories[0];

  const currentRoundSubmissions: WordSubmission[] = roomState.submissions.filter(
    (s) => s.round === roomState.currentRound
  );
  const currentRoundValidSubmissions = currentRoundSubmissions.filter((s) => s.isValid);

  const liveRoundTop5 = [...playersList]
    .sort((a, b) => {
      const rDiff =
        (b.roundScores[roomState.currentRound] || 0) -
        (a.roundScores[roomState.currentRound] || 0);
      if (rDiff !== 0) return rDiff;
      return b.totalScore - a.totalScore;
    })
    .slice(0, 5);

  if (roomState.phase === 'REPORT') {
    return (
      <AnalyticsReport
        roomState={roomState}
        onBackToPodium={onBackToPodium}
        onRegenerateReport={onRegenerateReport}
        onResetGame={onResetGame}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Sub-toolbar for Stage Status & Audio */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span className="font-semibold text-white">{roomState.title}</span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            房間 PIN 碼：<strong className="font-mono text-indigo-400">{roomState.pin}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            目前連線員工：
            <strong className="font-mono text-emerald-400 tabular-nums">{connectedCount}</strong> /
            100 人
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="text-xs text-slate-400">內建離線高速詞庫引擎（免外部 API）</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleSound}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
            {soundEnabled ? '舞台音效開啟' : '舞台音效靜音'}
          </button>

          {roomState.phase !== 'LOBBY' && (
            <button
              onClick={onResetGame}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置回到大廳
            </button>
          )}
        </div>
      </div>

      {/* PHASE 1: LOBBY (QR Code + Direct Checkbox Category Picker + Employee Roster) */}
      {roomState.phase === 'LOBBY' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Column: Big QR Code Card for 60 Employees to Scan */}
            <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-8 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-indigo-400 mb-2">
                  步驟 1 · 手機掃描 QR Code 立即參賽
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                  請員工拿出手機掃描加入
                </h2>
                <p className="text-sm text-slate-400 mb-6">
                  無需安裝 App 或申請任何 API 金鑰，掃描後輸入挑戰者姓名即可進入即時競賽大廳（支援 100 人同時連線）。
                </p>

                {/* QR Code Frame */}
                <div className="bg-white p-6 rounded-xl mx-auto w-fit shadow-sm mb-6">
                  <QRCodeSVG value={joinUrl} size={220} level="M" includeMargin={false} />
                </div>

                {/* Room PIN & Copy Link */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-xs text-slate-400">入場 PIN 碼</span>
                    <span className="text-2xl font-mono font-bold tracking-widest text-indigo-400 tabular-nums">
                      {roomState.pin}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={joinUrl}
                      className="flex-1 px-3 py-2 text-xs font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded-lg focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          已複製連結
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          複製參賽連結
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <button
                  onClick={onStartGame}
                  className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-5 h-5 fill-current" />
                  開始競賽（共 {roomState.categories.length} 輪 · {playersList.length} 人已就緒）
                </button>
              </div>
            </div>

            {/* Right Column: All Categories Checkbox Grid + Connected Employees */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              {/* All Single-Topic Categories Checkbox Selector */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-emerald-400 mb-1">
                      步驟 2 · 請直接勾選本場比賽要玩的題庫（已勾選 {selectedIds.length} 個題庫）
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      全部題庫列表（依勾選順序進行各輪比賽）
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRandomPick5}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                      隨機勾選 5 題
                    </button>

                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      <Clock className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
                      {[30, 45, 60].map((sec) => (
                        <button
                          key={sec}
                          onClick={() => onUpdateSettings({ roundDurationSec: sec })}
                          className={`px-2 py-1 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer ${
                            roomState.roundDurationSec === sec
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Checkbox Grid of All 10 Single-Topic Categories */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CATEGORY_KNOWLEDGE_BASE.map((entry) => {
                    const checkedIdx = selectedIds.indexOf(entry.id);
                    const isChecked = checkedIdx !== -1;

                    return (
                      <button
                        type="button"
                        key={entry.id}
                        onClick={() => handleToggleCategory(entry.id)}
                        className={`text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                          isChecked
                            ? 'bg-indigo-950/40 border-indigo-500/80 text-white'
                            : 'bg-slate-950/60 border-slate-800/90 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 shrink-0">
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-indigo-400" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base text-white">
                                {entry.title}
                              </span>
                              <span className="text-xs text-slate-500 font-mono">
                                · 內建 {entry.keywords.length} 詞
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1 truncate">
                              範例：{entry.examples.slice(0, 4).join('、')}
                            </div>
                          </div>
                        </div>

                        {isChecked && (
                          <span className="font-mono text-xs font-bold text-indigo-300 shrink-0 mt-0.5">
                            第 {checkedIdx + 1} 輪
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Order Summary Line */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <div>
                    出題順序：
                    <span className="text-slate-200 font-medium ml-1">
                      {roomState.categories
                        .map((c, idx) => `第${idx + 1}輪「${c.title}」`)
                        .join(' → ')}
                    </span>
                  </div>
                  <span>點擊任一題庫即可勾選或取消</span>
                </div>
              </div>

              {/* Connected Employees Grid (Supports 100 compact display) */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex-1 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-bold text-white">
                      已入場挑戰者名單 ({playersList.length} / 100 人)
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    支援 100 位員工即時同場競技
                  </span>
                </div>

                {playersList.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl">
                    <p className="text-sm text-slate-400 mb-1">
                      等待挑戰者掃描左側 QR Code 加入房間...
                    </p>
                    <p className="text-xs text-slate-500">
                      您也可以點擊右上角切換至「員工手機視角」親自測試輸入詞彙
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1">
                    {playersList.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-800/90 rounded-lg"
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: player.avatarColor }}
                        >
                          {player.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white truncate">
                            {player.name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: 3-SECOND COUNTDOWN */}
      {roomState.phase === 'COUNTDOWN' && (
        <div className="py-20 text-center bg-slate-900/90 border border-slate-800 rounded-2xl space-y-6">
          <div className="text-sm font-semibold text-indigo-400">
            第 {roomState.currentRound} / {roomState.totalRounds} 輪即將開始
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            本輪類型：「{currentCategory.title}」
          </h2>
          <p className="text-base text-slate-300 max-w-xl mx-auto">
            {currentCategory.description}
          </p>
          <div className="text-8xl font-mono font-extrabold text-amber-400 tabular-nums py-6">
            {roomState.timeRemainingSec}
          </div>
          <div className="text-xs text-slate-400">
            請所有員工準備在手機上輸入相關詞彙，越快越準確分數越高！
          </div>
        </div>
      )}

      {/* PHASE 3: ACTIVE PLAYING */}
      {roomState.phase === 'PLAYING' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
                <span>
                  ROUND {roomState.currentRound} OF {roomState.totalRounds}
                </span>
                <span aria-hidden="true">·</span>
                <span>難度：{currentCategory.difficulty}</span>
                <span aria-hidden="true">·</span>
                <span>首發不撞詞可獲 +20 獨創獎勵</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                類型：{currentCategory.title}
              </h1>
              <p className="text-sm md:text-base text-slate-300">
                {currentCategory.description}（參考範例：{currentCategory.examples.join('、')}）
              </p>
            </div>

            <div className="flex items-center gap-6 shrink-0">
              <div className="text-right">
                <div className="text-xs text-slate-400 mb-1">本輪剩餘作答時間</div>
                <div
                  className={`text-5xl md:text-6xl font-mono font-extrabold tabular-nums ${
                    roomState.timeRemainingSec <= 10 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {roomState.timeRemainingSec}s
                </div>
              </div>

              <button
                onClick={onEndRoundEarly}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FastForward className="w-4 h-4" />
                提前結算本輪
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <h3 className="text-base font-bold text-white">全場即時詞庫計分動態牆</h3>
                  </div>
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    本輪已通過 {currentRoundValidSubmissions.length} 詞 / 總提交{' '}
                    {currentRoundSubmissions.length} 次
                  </div>
                </div>

                {currentRoundSubmissions.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 text-sm">
                    等待員工送出本輪第一個「{currentCategory.title}」相關詞彙...
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {[...currentRoundSubmissions]
                      .reverse()
                      .slice(0, 18)
                      .map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border border-slate-800/90 rounded-xl text-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`text-xs font-bold ${
                                sub.isValid ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {sub.isValid ? '✓ 通過' : '✕ 無效'}
                            </span>
                            <span className="font-bold text-white text-base truncate">
                              「{sub.word}」
                            </span>
                            <span className="text-xs text-slate-400 truncate">
                              {sub.playerName}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                            <span className="text-xs text-slate-400 hidden sm:inline">
                              {(sub.timestampMs / 1000).toFixed(1)}s · {sub.reason}
                            </span>
                            {sub.isValid ? (
                              <span className="text-sm font-bold text-indigo-400">
                                +{sub.totalPoints} 分
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">+0 分</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>
                  計分公式：詞庫準確度 (80~100) + 反應速度加成 (0~50) + 全場首發獨創 (+20)
                </span>
                <span className="font-mono">PIN: {roomState.pin}</span>
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <h3 className="text-base font-bold text-white">
                      第 {roomState.currentRound} 輪即時領先榜
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">即時跳動更新</span>
                </div>

                <div className="space-y-3">
                  {liveRoundTop5.map((p, idx) => {
                    const roundPts = p.roundScores[roomState.currentRound] || 0;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                              idx === 0
                                ? 'bg-amber-500 text-slate-950'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-950'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-white text-sm truncate">{p.name}</div>
                            <div className="text-xs text-slate-400 truncate">
                              累計總分 {p.totalScore.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-mono tabular-nums shrink-0">
                          <div className="text-base font-bold text-emerald-400">
                            +{roundPts} 分
                          </div>
                          <div className="text-[11px] text-slate-500">本輪得分</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between">
                <div className="text-xs text-slate-300">
                  中途加入的員工仍可掃碼參賽，輸入 PIN{' '}
                  <strong className="font-mono text-indigo-400">{roomState.pin}</strong>
                </div>
                <QRCodeSVG value={joinUrl} size={44} level="L" className="bg-white p-1 rounded" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 4: ROUND LEADERBOARD */}
      {roomState.phase === 'ROUND_LEADERBOARD' && (
        <div className="space-y-8">
          {(() => {
            const summary =
              roomState.roundSummaries.find((s) => s.roundNumber === roomState.currentRound) ||
              null;

            return (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-indigo-400 mb-1">
                      第 {roomState.currentRound} / {roomState.totalRounds} 輪時間到 · 單輪戰況結算
                    </div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">
                      第 {roomState.currentRound} 輪「{currentCategory.title}」Top 5 英雄榜
                    </h2>
                  </div>

                  <button
                    onClick={onNextRound}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {roomState.currentRound < roomState.totalRounds ? (
                      <>
                        進入第 {roomState.currentRound + 1} 輪競賽
                        <ArrowRight className="w-5 h-5" />
                      </>
                    ) : (
                      <>
                        揭曉最終總冠軍與結算頒獎台
                        <Trophy className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-400 mb-1">
                      本輪全場有效詞彙 / 不重複詞彙
                    </div>
                    <div className="text-2xl font-bold text-white font-mono tabular-nums">
                      {summary?.validSubmissions || 0} 詞{' '}
                      <span className="text-sm font-normal text-emerald-400">
                        （{summary?.uniqueWordsCount || 0} 個獨創詞）
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-400 mb-1">本輪全場最快反應王</div>
                    {summary?.fastestWord ? (
                      <div>
                        <span className="text-lg font-bold text-amber-400">
                          「{summary.fastestWord.word}」
                        </span>
                        <span className="text-xs text-slate-300 ml-2">
                          {summary.fastestWord.playerName} · 開局{' '}
                          <strong className="font-mono tabular-nums">
                            {(summary.fastestWord.timeMs / 1000).toFixed(2)}s
                          </strong>
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">本輪無有效作答</div>
                    )}
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-400 mb-1">本輪最高精準度詞彙王</div>
                    {summary?.mostCreativeWord ? (
                      <div>
                        <span className="text-lg font-bold text-indigo-400">
                          「{summary.mostCreativeWord.word}」
                        </span>
                        <span className="text-xs text-slate-300 ml-2">
                          {summary.mostCreativeWord.playerName} · 準確度{' '}
                          <strong className="font-mono tabular-nums">
                            {summary.mostCreativeWord.accuracyScore}%
                          </strong>
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">本輪無有效作答</div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {summary && summary.top5Players.length > 0 ? (
                    summary.top5Players.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-6 py-4 bg-slate-950 border border-slate-800 rounded-xl"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono text-base font-extrabold ${
                              idx === 0
                                ? 'bg-amber-400 text-slate-950'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-950'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="text-lg font-bold text-white">{item.name}</div>
                            <div className="text-xs text-slate-400">
                              本輪成功通過 {item.validCount} 個詞彙
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-8 font-mono tabular-nums">
                          <div className="text-right">
                            <div className="text-xs text-slate-400">本輪進帳</div>
                            <div className="text-xl font-extrabold text-emerald-400">
                              +{item.roundScore.toLocaleString()} 分
                            </div>
                          </div>
                          <div className="text-right hidden sm:block">
                            <div className="text-xs text-slate-400">累計總積分</div>
                            <div className="text-lg font-bold text-slate-200">
                              {item.totalScore.toLocaleString()} 分
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-slate-400">本輪尚無選手得分紀錄</div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* PHASE 5: GAME OVER */}
      {roomState.phase === 'GAME_OVER' && (
        <div className="space-y-8">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center space-y-8">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-amber-400">
                全數完賽 · 年度腦力激盪總決賽結果揭曉
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                最終總冠軍榮耀頒獎台
              </h1>
              <p className="text-sm text-slate-400 max-w-xl mx-auto">
                感謝全場 {playersList.length} 位員工熱情參與，共創下 {roomState.submissions.length}{' '}
                次詞彙激盪紀錄！
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto items-end pt-4">
              {playersList[1] && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 order-2 md:order-1 space-y-3">
                  <div className="text-xs font-mono font-bold text-slate-300">
                    亞軍 · SECOND PLACE
                  </div>
                  <div
                    className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-xl font-bold text-white"
                    style={{ backgroundColor: playersList[1].avatarColor }}
                  >
                    {playersList[1].name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white">{playersList[1].name}</div>
                  </div>
                  <div className="text-2xl font-mono font-extrabold text-slate-200 tabular-nums">
                    {playersList[1].totalScore.toLocaleString()} 分
                  </div>
                  <div className="text-xs text-slate-400">
                    有效詞彙 {playersList[1].validWordsCount} 個
                  </div>
                </div>
              )}

              {playersList[0] ? (
                <div className="bg-slate-950 border-2 border-amber-400/80 rounded-2xl p-8 order-1 md:order-2 space-y-4 shadow-lg">
                  <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400">
                    <Trophy className="w-4 h-4" />
                    總冠軍 · GRAND CHAMPION
                  </div>
                  <div
                    className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl font-extrabold text-white ring-4 ring-amber-400/30"
                    style={{ backgroundColor: playersList[0].avatarColor }}
                  >
                    {playersList[0].name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-white">
                      {playersList[0].name}
                    </div>
                  </div>
                  <div className="text-4xl font-mono font-extrabold text-amber-400 tabular-nums">
                    {playersList[0].totalScore.toLocaleString()} 分
                  </div>
                  <div className="text-xs text-slate-300">
                    累計 {playersList[0].validWordsCount} 個有效詞彙 · 平均反應{' '}
                    {playersList[0].avgReactionTimeMs > 0
                      ? `${(playersList[0].avgReactionTimeMs / 1000).toFixed(1)}s`
                      : '-'}
                  </div>
                </div>
              ) : (
                <div className="col-span-3 py-12 text-slate-400">本場比賽尚無計分資料</div>
              )}

              {playersList[2] && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 order-3 space-y-3">
                  <div className="text-xs font-mono font-bold text-amber-600">
                    季軍 · THIRD PLACE
                  </div>
                  <div
                    className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-xl font-bold text-white"
                    style={{ backgroundColor: playersList[2].avatarColor }}
                  >
                    {playersList[2].name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white">{playersList[2].name}</div>
                  </div>
                  <div className="text-2xl font-mono font-extrabold text-amber-500 tabular-nums">
                    {playersList[2].totalScore.toLocaleString()} 分
                  </div>
                  <div className="text-xs text-slate-400">
                    有效詞彙 {playersList[2].validWordsCount} 個
                  </div>
                </div>
              )}
            </div>

            {playersList.length > 3 && (
              <div className="max-w-4xl mx-auto pt-4 text-left">
                <div className="text-xs font-semibold text-slate-400 mb-3">前十名傑出表現榜</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {playersList.slice(3, 10).map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-slate-400 w-6">#{idx + 4}</span>
                        <div>
                          <div className="text-sm font-bold text-white">{p.name}</div>
                          <div className="text-xs text-slate-400">有效詞彙 {p.validWordsCount} 個</div>
                        </div>
                      </div>
                      <div className="font-mono tabular-nums text-sm font-bold text-indigo-400">
                        {p.totalScore.toLocaleString()} 分
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-4 pt-6 border-t border-slate-800">
              <button
                onClick={onShowReport}
                className="inline-flex items-center gap-2.5 px-7 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                <BarChart3 className="w-5 h-5" />
                查看完整管理數據分析報表 & 匯出 CSV
              </button>

              <button
                onClick={onResetGame}
                className="inline-flex items-center gap-2 px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-base border border-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                舉辦下一場比賽
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
