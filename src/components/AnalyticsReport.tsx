import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  Trophy,
  Clock,
  CheckCircle2,
  Users,
  BarChart3,
  Download,
  RefreshCw,
  ArrowLeft,
  Search,
  Award,
  Zap,
} from 'lucide-react';
import type { RoomState, Player, WordSubmission } from '../types/game';

interface AnalyticsReportProps {
  roomState: RoomState;
  onBackToPodium: () => void;
  onRegenerateReport: () => void;
  onResetGame: () => void;
}

export const AnalyticsReport: React.FC<AnalyticsReportProps> = ({
  roomState,
  onBackToPodium,
  onRegenerateReport,
  onResetGame,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PLAYERS' | 'WORDS'>('OVERVIEW');

  const playersList: Player[] = (Object.values(roomState.players) as Player[]).sort(
    (a, b) => b.totalScore - a.totalScore
  );

  const validSubmissions = roomState.submissions.filter((s) => s.isValid);
  const totalSubmissions = roomState.submissions.length;
  const overallAccuracy =
    totalSubmissions > 0 ? Math.round((validSubmissions.length / totalSubmissions) * 100) : 0;

  const avgReactionSec =
    validSubmissions.length > 0
      ? (
          validSubmissions.reduce((acc, s) => acc + s.timestampMs, 0) /
          validSubmissions.length /
          1000
        ).toFixed(1)
      : '0.0';

  const uniqueValidWords = new Set(validSubmissions.map((s) => s.word.toLowerCase())).size;

  const filteredPlayers = playersList.filter((p) => {
    return (
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Export CSV Handler (UTF-8 with BOM for Excel compatibility, no department column)
  const handleDownloadPlayersCSV = () => {
    const roundHeaders = roomState.categories.map((c) => `第${c.roundNumber}輪(${c.title})得分`);
    const headers = [
      '最終排名',
      '挑戰者姓名',
      '總積分',
      ...roundHeaders,
      '有效詞彙數',
      '總提交次數',
      '正確率(%)',
      '平均反應秒數',
      '最快反應秒數',
    ];

    const rows = playersList.map((p, idx) => {
      const acc =
        p.totalSubmissionsCount > 0
          ? Math.round((p.validWordsCount / p.totalSubmissionsCount) * 100)
          : 0;
      const roundScoresCols = roomState.categories.map(
        (c) => p.roundScores[c.roundNumber] || 0
      );
      return [
        idx + 1,
        `"${p.name.replace(/"/g, '""')}"`,
        p.totalScore,
        ...roundScoresCols,
        p.validWordsCount,
        p.totalSubmissionsCount,
        acc,
        p.avgReactionTimeMs > 0 ? (p.avgReactionTimeMs / 1000).toFixed(2) : '0.00',
        p.fastestSubmissionMs !== null ? (p.fastestSubmissionMs / 1000).toFixed(2) : '-',
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `LexiRush_挑戰者成績報表_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSubmissionsCSV = () => {
    const headers = [
      '輪次',
      '題目類型',
      '挑戰者姓名',
      '輸入詞彙',
      '判定結果',
      '語意準確度',
      '反應速度加成',
      '首發獨創加成',
      '單詞總得分',
      '開局反應秒數',
      '審核評語',
    ];

    const rows = roomState.submissions.map((s: WordSubmission) =>
      [
        s.round,
        `"${s.category.replace(/"/g, '""')}"`,
        `"${s.playerName.replace(/"/g, '""')}"`,
        `"${s.word.replace(/"/g, '""')}"`,
        s.isValid ? '有效' : '無效',
        s.accuracyScore,
        s.speedBonus,
        s.uniquenessBonus,
        s.totalPoints,
        (s.timestampMs / 1000).toFixed(2),
        `"${s.reason.replace(/"/g, '""')}"`,
      ].join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `LexiRush_全場詞彙明細_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="text-xs text-slate-400 mb-1">
            賽事代碼 {roomState.pin} · 共 {roomState.totalRounds} 輪完整結算數據
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {roomState.title} — 管理者數據分析報表
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBackToPodium}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            返回頒獎台
          </button>
          <button
            onClick={handleDownloadSubmissionsCSV}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            匯出詞彙明細 CSV
          </button>
          <button
            onClick={handleDownloadPlayersCSV}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            下載挑戰者成績報表 CSV
          </button>
          <button
            onClick={onResetGame}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-300 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800/60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            開啟新賽事
          </button>
        </div>
      </div>

      {/* Top KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>參賽挑戰者總數</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-white tabular-nums">
            {playersList.length} <span className="text-sm font-normal text-slate-400">/ 100 人</span>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            支援百人即時同步連線競速
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>有效詞彙 / 總提交數</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-white tabular-nums">
            {validSubmissions.length}{' '}
            <span className="text-base font-normal text-slate-400">/ {totalSubmissions}</span>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            全場語意準確率 <span className="text-emerald-400 font-medium tabular-nums">{overallAccuracy}%</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>不重複獨創詞彙數</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-white tabular-nums">
            {uniqueValidWords} <span className="text-sm font-normal text-slate-400">詞</span>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            平均每輪產出 {Math.round(uniqueValidWords / Math.max(1, roomState.totalRounds))} 個相異詞彙
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>全場平均反應速度</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-bold text-white tabular-nums">
            {avgReactionSec} <span className="text-sm font-normal text-slate-400">秒</span>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            自題目揭曉至成功送出之平均耗時
          </div>
        </div>
      </div>

      {/* Segmented View Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            賽事統計洞察與各輪表現
          </button>
          <button
            onClick={() => setActiveTab('PLAYERS')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'PLAYERS'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            挑戰者個人成績總表 ({playersList.length})
          </button>
          <button
            onClick={() => setActiveTab('WORDS')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'WORDS'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            全場作答詞彙紀錄 ({roomState.submissions.length})
          </button>
        </div>
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="space-y-8">
          {/* Statistical Executive Insights Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">
                  團隊腦力激盪數據診斷與管理建議（內建統計引擎）
                </h2>
              </div>
              <button
                onClick={onRegenerateReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重新計算統計洞察
              </button>
            </div>

            {roomState.aiReport ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-5">
                  <div>
                    <div className="text-xs font-semibold text-indigo-400 mb-1.5">
                      01. 總體賽事表現摘要
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {roomState.aiReport.executiveSummary}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-800/80">
                    <div>
                      <div className="text-xs font-semibold text-emerald-400 mb-1.5">
                        02. 詞彙廣度與創意思維
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {roomState.aiReport.teamCreativityAnalysis}
                      </p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-amber-400 mb-1.5">
                        03. 反應速度與準確度平衡
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {roomState.aiReport.speedAndAccuracyBalance}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80">
                    <div className="text-xs font-semibold text-sky-400 mb-2">
                      04. 給管理者的組織活力建議
                    </div>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {roomState.aiReport.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-mono text-xs text-slate-500 mt-0.5">
                            0{i + 1}.
                          </span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Highlighted Creative Words */}
                <div className="bg-slate-950/60 border border-slate-800/90 rounded-lg p-5 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-semibold text-amber-400 mb-3">
                      全場最佳高分詞彙選粹
                    </div>
                    <div className="space-y-3">
                      {roomState.aiReport.topCreativeWords.map((item, idx) => (
                        <div
                          key={idx}
                          className="pb-3 border-b border-slate-800/70 last:border-b-0 last:pb-0"
                        >
                          <div className="flex items-center justify-between text-sm font-semibold text-white">
                            <span>「{item.word}」</span>
                            <span className="text-xs font-normal text-slate-400">
                              {item.playerName} · {item.category}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">{item.comment}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80">
                    <div className="text-xs font-semibold text-slate-400 mb-2">
                      全場競技亮點數據
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-300">
                      {roomState.aiReport.departmentHighlights.map((hl, i) => (
                        <div key={i}>· {hl}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">尚無分析資料，請點擊右上方按鈕生成。</div>
            )}
          </div>

          {/* Round-by-Round Breakdown & Top Challengers Speed Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Round Breakdown */}
            <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  各輪題目作答表現明細
                </h3>
                <span className="text-xs text-slate-400">依輪次順序排列</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400">
                      <th className="py-2.5 pr-3 font-medium">輪次與題目類型</th>
                      <th className="py-2.5 px-3 font-medium text-right">有效 / 總數</th>
                      <th className="py-2.5 px-3 font-medium text-right">不重複詞</th>
                      <th className="py-2.5 pl-3 font-medium">該輪單輪冠軍</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {roomState.categories.map((cat) => {
                      const summary = roomState.roundSummaries.find(
                        (s) => s.roundNumber === cat.roundNumber
                      );
                      const topPlayer = summary?.top5Players?.[0];
                      return (
                        <tr key={cat.roundNumber} className="hover:bg-slate-800/30">
                          <td className="py-3 pr-3">
                            <div className="font-semibold text-white">
                              第 {cat.roundNumber} 輪：{cat.title}
                            </div>
                            <div className="text-xs text-slate-400">
                              難度：{cat.difficulty}
                              {summary?.fastestWord
                                ? ` · 最快作答：「${summary.fastestWord.word}」(${(
                                    summary.fastestWord.timeMs / 1000
                                  ).toFixed(1)}s)`
                                : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                            {summary ? `${summary.validSubmissions} / ${summary.totalSubmissions}` : '0 / 0'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400">
                            {summary ? summary.uniqueWordsCount : 0}
                          </td>
                          <td className="py-3 pl-3">
                            {topPlayer && topPlayer.roundScore > 0 ? (
                              <div>
                                <span className="font-medium text-white">{topPlayer.name}</span>
                                <span className="text-xs text-slate-400 ml-1.5 font-mono tabular-nums">
                                  +{topPlayer.roundScore} 分
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">無紀錄</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Challengers Efficiency Comparison */}
            <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  前五強挑戰者總分與戰力比對
                </h3>
                <span className="text-xs text-slate-400">依總積分排序</span>
              </div>

              {playersList.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">尚無挑戰者參賽數據</div>
              ) : (
                <div className="space-y-4">
                  {playersList.slice(0, 5).map((p, index) => {
                    const maxScore = Math.max(1, playersList[0]?.totalScore || 1);
                    const widthPct = Math.max(8, Math.round((p.totalScore / maxScore) * 100));
                    return (
                      <div key={p.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-400 w-5">
                              #{index + 1}
                            </span>
                            <span className="font-semibold text-white">{p.name}</span>
                            <span className="text-xs text-slate-400">
                              · {p.validWordsCount} 有效詞
                            </span>
                          </div>
                          <div className="font-mono tabular-nums font-bold text-indigo-300">
                            {p.totalScore.toLocaleString()} 分
                          </div>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'PLAYERS' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋挑戰者姓名..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="py-3 px-3 font-medium">排名</th>
                  <th className="py-3 px-3 font-medium">挑戰者姓名</th>
                  {roomState.categories.map((c) => (
                    <th key={c.roundNumber} className="py-3 px-3 font-medium text-right">
                      R{c.roundNumber} ({c.title})
                    </th>
                  ))}
                  <th className="py-3 px-3 font-medium text-right">有效詞 / 準確率</th>
                  <th className="py-3 px-3 font-medium text-right">平均反應</th>
                  <th className="py-3 px-3 font-medium text-right">總積分</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredPlayers.map((p) => {
                  const overallRank = playersList.findIndex((item) => item.id === p.id) + 1;
                  const acc =
                    p.totalSubmissionsCount > 0
                      ? Math.round((p.validWordsCount / p.totalSubmissionsCount) * 100)
                      : 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono tabular-nums font-semibold text-slate-300">
                        {overallRank <= 3 ? (
                          <span className="inline-flex items-center gap-1 text-amber-400">
                            <Trophy className="w-3.5 h-3.5" />#{overallRank}
                          </span>
                        ) : (
                          `#${overallRank}`
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">{p.name}</div>
                      </td>
                      {roomState.categories.map((c) => (
                        <td
                          key={c.roundNumber}
                          className="py-3 px-3 text-right font-mono tabular-nums text-slate-300"
                        >
                          {p.roundScores[c.roundNumber] || 0}
                        </td>
                      ))}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300">
                        {p.validWordsCount} 詞 · {acc}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300">
                        {p.avgReactionTimeMs > 0
                          ? `${(p.avgReactionTimeMs / 1000).toFixed(1)}s`
                          : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-indigo-400 text-base">
                        {p.totalScore.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'WORDS' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="py-3 px-3 font-medium">輪次 / 題目</th>
                  <th className="py-3 px-3 font-medium">輸入詞彙</th>
                  <th className="py-3 px-3 font-medium">挑戰者姓名</th>
                  <th className="py-3 px-3 font-medium">審核評語</th>
                  <th className="py-3 px-3 font-medium text-right">反應時間</th>
                  <th className="py-3 px-3 font-medium text-right">準確度 + 速度 + 獨創</th>
                  <th className="py-3 px-3 font-medium text-right">總得分</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {[...roomState.submissions].reverse().map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 text-xs text-slate-400">
                      R{s.round} · {s.category}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">{s.word}</td>
                    <td className="py-2.5 px-3 text-slate-300">{s.playerName}</td>
                    <td className="py-2.5 px-3 text-xs">
                      <span className={s.isValid ? 'text-emerald-400' : 'text-rose-400'}>
                        {s.isValid ? '✓ ' : '✕ '}
                        {s.reason}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                      {(s.timestampMs / 1000).toFixed(1)}s
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-400">
                      {s.isValid ? (
                        <span>
                          {s.accuracyScore} + {s.speedBonus}
                          {s.uniquenessBonus > 0 ? ` + ${s.uniquenessBonus}(首發)` : ''}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-indigo-400">
                      +{s.totalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
