import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { RoomState, RoundCategory } from './types/game';
import { HostStageView } from './components/HostStageView';
import { PlayerMobileView } from './components/PlayerMobileView';

type ViewMode = 'HOST' | 'PLAYER';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join') === '1' || params.get('role') === 'player' ? 'PLAYER' : 'HOST';
  });

  const [playerId] = useState<string>(() => {
    const saved = localStorage.getItem('lexirush_player_id');
    if (saved) return saved;
    const generated = `emp-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
    localStorage.setItem('lexirush_player_id', generated);
    return generated;
  });

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{
    word: string;
    isValid: boolean;
    totalPoints: number;
    accuracyScore?: number;
    speedBonus?: number;
    uniquenessBonus?: number;
    reason: string;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Re-announce player if previously joined in this browser
      const savedName = localStorage.getItem('lexirush_player_name');
      if (savedName && viewMode === 'PLAYER') {
        ws.send(
          JSON.stringify({
            type: 'player:join',
            id: playerId,
            name: savedName,
          })
        );
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'room:state' && data.state) {
          setRoomState(data.state);
        } else if (data.type === 'timer:tick' && typeof data.timeRemainingSec === 'number') {
          setRoomState((prev) =>
            prev ? { ...prev, timeRemainingSec: data.timeRemainingSec } : prev
          );
        } else if (data.type === 'submission:result' && data.result) {
          setLastFeedback(data.result);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      reconnectTimerRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, 1500);
    };
  }, [playerId, viewMode]);

  useEffect(() => {
    // Initial HTTP fetch for immediate zero-latency state while WS connects
    fetch('/api/room')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.pin) setRoomState(data);
      })
      .catch(() => {});

    connectWebSocket();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  const sendWsMessage = (payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const handleJoinGame = (name: string) => {
    sendWsMessage({
      type: 'player:join',
      id: playerId,
      name,
    });
  };

  const handleSubmitWord = (word: string) => {
    sendWsMessage({
      type: 'player:submit_word',
      playerId,
      word,
    });
  };

  const handleStartGame = () => {
    setLastFeedback(null);
    sendWsMessage({ type: 'host:start_game' });
  };

  const handleNextRound = () => {
    setLastFeedback(null);
    sendWsMessage({ type: 'host:next_round' });
  };

  const handleEndRoundEarly = () => {
    sendWsMessage({ type: 'host:end_round_early' });
  };

  const handleShowReport = () => {
    sendWsMessage({ type: 'host:show_report' });
  };

  const handleBackToPodium = () => {
    sendWsMessage({ type: 'host:back_to_podium' });
  };

  const handleResetGame = () => {
    setLastFeedback(null);
    sendWsMessage({ type: 'host:reset_game' });
  };

  const handleUpdateSettings = (payload: {
    roundDurationSec?: number;
    categories?: RoundCategory[];
    title?: string;
  }) => {
    sendWsMessage({
      type: 'host:update_settings',
      ...payload,
    });
  };

  const handleSelectCategoryPack = async (packId: string, durationSec: number) => {
    try {
      await fetch('/api/categories/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId, roundDurationSec: durationSec }),
      });
    } catch (e) {
      console.error('Failed to switch category pack:', e);
    }
  };

  const handleRegenerateReport = async () => {
    try {
      await fetch('/api/report/generate', {
        method: 'POST',
      });
    } catch (e) {
      console.error('Failed to regenerate report:', e);
    }
  };

  const baseUrl = window.location.origin + window.location.pathname;
  const joinUrl = `${baseUrl}?join=1`;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/90 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setViewMode('HOST');
          }}
          className="text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
        >
          LexiRush
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={() => {
              setViewMode('HOST');
              if (roomState?.phase === 'REPORT') handleBackToPodium();
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'HOST' && roomState?.phase !== 'REPORT'
                ? 'text-white underline underline-offset-8 decoration-indigo-500 decoration-2'
                : ''
            }`}
          >
            主舞台大螢幕
          </button>
          <button
            onClick={() => setViewMode('PLAYER')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'PLAYER'
                ? 'text-white underline underline-offset-8 decoration-indigo-500 decoration-2'
                : ''
            }`}
          >
            員工手機搶答端
          </button>
          <button
            onClick={() => {
              setViewMode('HOST');
              handleShowReport();
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'HOST' && roomState?.phase === 'REPORT'
                ? 'text-white underline underline-offset-8 decoration-indigo-500 decoration-2'
                : ''
            }`}
          >
            管理數據分析報表
          </button>
          <button
            onClick={() => {
              setViewMode('HOST');
              handleResetGame();
            }}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            五輪題庫配置
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setViewMode(viewMode === 'HOST' ? 'PLAYER' : 'HOST')}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {viewMode === 'HOST' ? '切換至員工手機視角' : '返回主持人投影大螢幕'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {!roomState ? (
          <div className="max-w-7xl mx-auto px-6 py-24 text-center">
            <div className="text-sm text-slate-400">正在連線至即時競賽伺服器...</div>
          </div>
        ) : viewMode === 'HOST' ? (
          <HostStageView
            roomState={roomState}
            joinUrl={joinUrl}
            onStartGame={handleStartGame}
            onNextRound={handleNextRound}
            onEndRoundEarly={handleEndRoundEarly}
            onShowReport={handleShowReport}
            onBackToPodium={handleBackToPodium}
            onResetGame={handleResetGame}
            onUpdateSettings={handleUpdateSettings}
            onRegenerateReport={handleRegenerateReport}
          />
        ) : (
          <PlayerMobileView
            roomState={roomState}
            playerId={playerId}
            onJoinGame={handleJoinGame}
            onSubmitWord={handleSubmitWord}
            lastFeedback={lastFeedback}
          />
        )}
      </main>
    </div>
  );
}
