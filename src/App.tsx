import React, { useEffect, useState, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import type { RoomState, RoundCategory } from './types/game';
import {
  createInitialRoomState,
  buildRoundSummary,
  generateLocalStatisticalReport,
  applyPlayerJoin,
  processPlayerWordSubmission,
} from './utils/gameEngine';
import { HostStageView } from './components/HostStageView';
import { PlayerMobileView } from './components/PlayerMobileView';

type ViewMode = 'HOST' | 'PLAYER';

export default function App() {
  // If opened via QR Code (?join=1 or ?role=player), lock strictly to participant view with zero host controls
  const [isParticipantOnly] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join') === '1' || params.get('role') === 'player';
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join') === '1' || params.get('role') === 'player' ? 'PLAYER' : 'HOST';
  });

  const [roomPin] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('pin') || '888168';
  });

  const [playerId] = useState<string>(() => {
    const saved = localStorage.getItem('lexirush_player_id');
    if (saved) return saved;
    const generated = `emp-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
    localStorage.setItem('lexirush_player_id', generated);
    return generated;
  });

  // Immediately initialize roomState so Vercel / static deployments never hang on loading!
  const [roomState, setRoomState] = useState<RoomState>(() => createInitialRoomState(roomPin));
  const roomStateRef = useRef<RoomState>(roomState);
  roomStateRef.current = roomState;

  const [lastFeedback, setLastFeedback] = useState<{
    word: string;
    isValid: boolean;
    totalPoints: number;
    accuracyScore?: number;
    speedBonus?: number;
    uniquenessBonus?: number;
    reason: string;
  } | null>(null);

  // Track whether backend Node WebSocket (/ws) is active
  const backendWsConnectedRef = useRef<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mqttRef = useRef<MqttClient | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const localTimerRef = useRef<number | null>(null);
  const viewModeRef = useRef<ViewMode>(viewMode);
  viewModeRef.current = viewMode;

  const stateTopic = `lexirush/v2/${roomPin}/state`;
  const actionTopic = `lexirush/v2/${roomPin}/action`;
  const feedbackTopicPrefix = `lexirush/v2/${roomPin}/feedback/`;

  // Broadcast updated room state to all connected mobile players (MQTT + BroadcastChannel)
  const broadcastHostState = useCallback(
    (nextState: RoomState) => {
      const cloned = JSON.parse(JSON.stringify(nextState)) as RoomState;
      roomStateRef.current = cloned;
      setRoomState(cloned);

      const payload = JSON.stringify({
        type: 'room:state',
        state: cloned,
      });

      if (bcRef.current) {
        try {
          bcRef.current.postMessage(payload);
        } catch {}
      }

      if (mqttRef.current && mqttRef.current.connected) {
        mqttRef.current.publish(stateTopic, payload, { qos: 0, retain: true });
      }
    },
    [stateTopic]
  );

  // Send feedback for a specific player's word submission
  const sendFeedbackToPlayer = useCallback(
    (targetPlayerId: string, feedback: NonNullable<typeof lastFeedback>) => {
      if (targetPlayerId === playerId) {
        setLastFeedback(feedback);
      }
      const payload = JSON.stringify({
        type: 'submission:result',
        targetPlayerId,
        result: feedback,
      });
      if (bcRef.current) {
        try {
          bcRef.current.postMessage(payload);
        } catch {}
      }
      if (mqttRef.current && mqttRef.current.connected) {
        mqttRef.current.publish(`${feedbackTopicPrefix}${targetPlayerId}`, payload, { qos: 0 });
      }
    },
    [feedbackTopicPrefix, playerId]
  );

  // Local Host Timer Management (used when deployed on Vercel / Serverless)
  const stopLocalTimer = useCallback(() => {
    if (localTimerRef.current !== null) {
      window.clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }
  }, []);

  const finishLocalRound = useCallback(() => {
    stopLocalTimer();
    const draft = JSON.parse(JSON.stringify(roomStateRef.current)) as RoomState;
    draft.timeRemainingSec = 0;

    const summary = buildRoundSummary(draft, draft.currentRound);
    const existingIdx = draft.roundSummaries.findIndex((s) => s.roundNumber === draft.currentRound);
    if (existingIdx >= 0) {
      draft.roundSummaries[existingIdx] = summary;
    } else {
      draft.roundSummaries.push(summary);
    }

    draft.phase = 'ROUND_LEADERBOARD';
    broadcastHostState(draft);
  }, [broadcastHostState, stopLocalTimer]);

  const startLocalRoundGameplay = useCallback(
    (roundNum: number) => {
      stopLocalTimer();
      const draft = JSON.parse(JSON.stringify(roomStateRef.current)) as RoomState;
      draft.currentRound = roundNum;
      draft.phase = 'COUNTDOWN';
      draft.timeRemainingSec = 3;
      broadcastHostState(draft);

      let countdown = 3;
      localTimerRef.current = window.setInterval(() => {
        countdown -= 1;
        if (countdown > 0) {
          const next = JSON.parse(JSON.stringify(roomStateRef.current)) as RoomState;
          next.timeRemainingSec = countdown;
          broadcastHostState(next);
        } else {
          stopLocalTimer();
          const playState = JSON.parse(JSON.stringify(roomStateRef.current)) as RoomState;
          playState.phase = 'PLAYING';
          playState.roundStartTime = Date.now();
          playState.timeRemainingSec = playState.roundDurationSec;
          broadcastHostState(playState);

          localTimerRef.current = window.setInterval(() => {
            const current = roomStateRef.current;
            if (!current.roundStartTime || current.phase !== 'PLAYING') return;
            const elapsedSec = Math.floor((Date.now() - current.roundStartTime) / 1000);
            const remaining = Math.max(0, current.roundDurationSec - elapsedSec);

            if (remaining <= 0) {
              finishLocalRound();
            } else {
              const tickDraft = JSON.parse(JSON.stringify(current)) as RoomState;
              tickDraft.timeRemainingSec = remaining;
              broadcastHostState(tickDraft);
            }
          }, 1000);
        }
      }, 1000);
    },
    [broadcastHostState, finishLocalRound, stopLocalTimer]
  );

  // Process incoming player/host actions on the Host instance (when backend /ws is not active)
  const handleAuthoritativeAction = useCallback(
    async (msg: Record<string, unknown>) => {
      // Only the Host view (or standalone browser) executes authoritative state transitions in serverless mode
      if (backendWsConnectedRef.current) return;

      const draft = JSON.parse(JSON.stringify(roomStateRef.current)) as RoomState;

      switch (msg.type) {
        case 'player:sync': {
          broadcastHostState(draft);
          break;
        }
        case 'player:join': {
          const id = String(msg.id || '');
          const name = String(msg.name || '');
          if (applyPlayerJoin(draft, id, name)) {
            broadcastHostState(draft);
          }
          break;
        }
        case 'player:submit_word': {
          const subPlayerId = String(msg.playerId || '');
          const word = String(msg.word || '');
          const outcome = await processPlayerWordSubmission(draft, subPlayerId, word);
          if (outcome) {
            sendFeedbackToPlayer(subPlayerId, outcome.feedback);
            if (outcome.submission) {
              broadcastHostState(draft);
            }
          }
          break;
        }
        case 'host:update_settings': {
          const roundDurationSec = msg.roundDurationSec as number | undefined;
          const categories = msg.categories as RoundCategory[] | undefined;
          const title = msg.title as string | undefined;

          if (title) draft.title = title.trim().slice(0, 40);
          if (roundDurationSec && roundDurationSec >= 15 && roundDurationSec <= 120) {
            draft.roundDurationSec = roundDurationSec;
            if (draft.phase === 'LOBBY') {
              draft.timeRemainingSec = roundDurationSec;
            }
          }
          if (Array.isArray(categories) && categories.length >= 1) {
            draft.categories = categories.map((c, idx) => ({
              ...c,
              roundNumber: idx + 1,
            }));
            draft.totalRounds = draft.categories.length;
          }
          broadcastHostState(draft);
          break;
        }
        case 'host:start_game': {
          for (const p of Object.values(draft.players)) {
            p.totalScore = 0;
            p.roundScores = {};
            p.validWordsCount = 0;
            p.totalSubmissionsCount = 0;
            p.avgReactionTimeMs = 0;
            p.fastestSubmissionMs = null;
          }
          draft.submissions = [];
          draft.roundSummaries = [];
          draft.aiReport = null;
          roomStateRef.current = draft;
          startLocalRoundGameplay(1);
          break;
        }
        case 'host:next_round': {
          if (draft.currentRound < draft.totalRounds) {
            startLocalRoundGameplay(draft.currentRound + 1);
          } else {
            stopLocalTimer();
            draft.phase = 'GAME_OVER';
            draft.aiReport = generateLocalStatisticalReport(draft);
            broadcastHostState(draft);
          }
          break;
        }
        case 'host:end_round_early': {
          if (draft.phase === 'PLAYING') {
            finishLocalRound();
          }
          break;
        }
        case 'host:show_report': {
          if (!draft.aiReport) {
            draft.aiReport = generateLocalStatisticalReport(draft);
          }
          draft.phase = 'REPORT';
          broadcastHostState(draft);
          break;
        }
        case 'host:back_to_podium': {
          draft.phase = 'GAME_OVER';
          broadcastHostState(draft);
          break;
        }
        case 'host:reset_game': {
          stopLocalTimer();
          const preservedPlayers = draft.players;
          for (const p of Object.values(preservedPlayers)) {
            p.totalScore = 0;
            p.roundScores = {};
            p.validWordsCount = 0;
            p.totalSubmissionsCount = 0;
            p.avgReactionTimeMs = 0;
            p.fastestSubmissionMs = null;
          }
          const preservedCategories = draft.categories;
          const fresh = createInitialRoomState(roomPin);
          fresh.players = preservedPlayers;
          fresh.categories = preservedCategories;
          fresh.totalRounds = preservedCategories.length;
          fresh.roundDurationSec = draft.roundDurationSec;
          fresh.timeRemainingSec = draft.roundDurationSec;
          broadcastHostState(fresh);
          break;
        }
        case 'host:regenerate_report': {
          draft.aiReport = generateLocalStatisticalReport(draft);
          broadcastHostState(draft);
          break;
        }
      }
    },
    [
      broadcastHostState,
      finishLocalRound,
      roomPin,
      sendFeedbackToPlayer,
      startLocalRoundGameplay,
      stopLocalTimer,
    ]
  );

  // Dispatch an action (works seamlessly across Node WebSocket, Vercel MQTT Relay, and BroadcastChannel)
  const dispatchAction = useCallback(
    (payload: Record<string, unknown>) => {
      if (
        backendWsConnectedRef.current &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        wsRef.current.send(JSON.stringify(payload));
        return;
      }

      // If we are on the Host view in serverless mode, process immediately
      if (viewModeRef.current === 'HOST') {
        handleAuthoritativeAction(payload);
      } else {
        // Send to Host via BroadcastChannel + MQTT Cloud Relay
        const raw = JSON.stringify(payload);
        if (bcRef.current) {
          try {
            bcRef.current.postMessage(raw);
          } catch {}
        }
        if (mqttRef.current && mqttRef.current.connected) {
          mqttRef.current.publish(actionTopic, raw, { qos: 0 });
        }
        // Also apply locally if testing solo on mobile view without a separate host tab open
        handleAuthoritativeAction(payload);
      }
    },
    [actionTopic, handleAuthoritativeAction]
  );

  useEffect(() => {
    // 1. Setup BroadcastChannel for instant multi-tab sync in same browser
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(`lexirush_channel_${roomPin}`);
      bcRef.current = bc;
      bc.onmessage = (ev) => {
        try {
          const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
          if (data.type === 'room:state' && data.state) {
            roomStateRef.current = data.state;
            setRoomState(data.state);
          } else if (
            data.type === 'submission:result' &&
            data.targetPlayerId === playerId &&
            data.result
          ) {
            setLastFeedback(data.result);
          } else if (viewModeRef.current === 'HOST' && data.type?.startsWith('player:')) {
            handleAuthoritativeAction(data);
          }
        } catch {}
      };
    }

    // 2. Setup Cloud WebSocket Relay (MQTT over WSS) for Vercel cross-device QR Code play (100 players)
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
      clientId: `lexirush_${playerId}_${Math.random().toString(16).slice(2, 6)}`,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 2000,
    });
    mqttRef.current = client;

    client.on('connect', () => {
      client.subscribe([stateTopic, actionTopic, `${feedbackTopicPrefix}${playerId}`], () => {
        const savedName = localStorage.getItem('lexirush_player_name');
        if (viewModeRef.current === 'PLAYER') {
          client.publish(actionTopic, JSON.stringify({ type: 'player:sync' }));
          if (savedName) {
            client.publish(
              actionTopic,
              JSON.stringify({
                type: 'player:join',
                id: playerId,
                name: savedName,
              })
            );
          }
        } else if (!backendWsConnectedRef.current) {
          // Host announces current state so any waiting phones receive it
          broadcastHostState(roomStateRef.current);
        }
      });
    });

    client.on('message', (topic, message) => {
      if (backendWsConnectedRef.current) return;
      try {
        const data = JSON.parse(message.toString());
        if (topic === stateTopic && data.type === 'room:state' && data.state) {
          // Players accept state updates from Host
          if (viewModeRef.current === 'PLAYER') {
            roomStateRef.current = data.state;
            setRoomState(data.state);
          }
        } else if (
          topic === `${feedbackTopicPrefix}${playerId}` &&
          data.type === 'submission:result' &&
          data.result
        ) {
          setLastFeedback(data.result);
        } else if (topic === actionTopic && viewModeRef.current === 'HOST') {
          handleAuthoritativeAction(data);
        }
      } catch {}
    });

    // 3. Try connecting to backend Node server (/api/room & /ws) when hosted on AI Studio / Cloud Run
    fetch('/api/room')
      .then((res) => {
        if (!res.ok) throw new Error('No backend server');
        return res.json();
      })
      .then((data) => {
        if (data && data.pin) {
          roomStateRef.current = data;
          setRoomState(data);
        }
      })
      .catch(() => {
        // Running on Vercel / static hosting — local + MQTT relay is already active!
      });

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        backendWsConnectedRef.current = true;
        const savedName = localStorage.getItem('lexirush_player_name');
        if (savedName && viewModeRef.current === 'PLAYER') {
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
            roomStateRef.current = data.state;
            setRoomState(data.state);
          } else if (data.type === 'timer:tick' && typeof data.timeRemainingSec === 'number') {
            setRoomState((prev) => ({
              ...prev,
              timeRemainingSec: data.timeRemainingSec,
            }));
          } else if (data.type === 'submission:result' && data.result) {
            setLastFeedback(data.result);
          }
        } catch {}
      };

      ws.onerror = () => {
        backendWsConnectedRef.current = false;
      };

      ws.onclose = () => {
        backendWsConnectedRef.current = false;
      };
    } catch {
      backendWsConnectedRef.current = false;
    }

    return () => {
      stopLocalTimer();
      wsRef.current?.close();
      bcRef.current?.close();
      mqttRef.current?.end(true);
    };
  }, [
    actionTopic,
    broadcastHostState,
    feedbackTopicPrefix,
    handleAuthoritativeAction,
    playerId,
    roomPin,
    stateTopic,
    stopLocalTimer,
  ]);

  const handleJoinGame = (name: string) => {
    dispatchAction({
      type: 'player:join',
      id: playerId,
      name,
    });
  };

  const handleSubmitWord = (word: string) => {
    dispatchAction({
      type: 'player:submit_word',
      playerId,
      word,
    });
  };

  const handleStartGame = () => {
    setLastFeedback(null);
    dispatchAction({ type: 'host:start_game' });
  };

  const handleNextRound = () => {
    setLastFeedback(null);
    dispatchAction({ type: 'host:next_round' });
  };

  const handleEndRoundEarly = () => {
    dispatchAction({ type: 'host:end_round_early' });
  };

  const handleShowReport = () => {
    dispatchAction({ type: 'host:show_report' });
  };

  const handleBackToPodium = () => {
    dispatchAction({ type: 'host:back_to_podium' });
  };

  const handleResetGame = () => {
    setLastFeedback(null);
    dispatchAction({ type: 'host:reset_game' });
  };

  const handleUpdateSettings = (payload: {
    roundDurationSec?: number;
    categories?: RoundCategory[];
    title?: string;
  }) => {
    dispatchAction({
      type: 'host:update_settings',
      ...payload,
    });
  };

  const handleRegenerateReport = async () => {
    if (backendWsConnectedRef.current) {
      try {
        await fetch('/api/report/generate', { method: 'POST' });
        return;
      } catch {}
    }
    dispatchAction({ type: 'host:regenerate_report' });
  };

  const baseUrl = window.location.origin + window.location.pathname;
  const joinUrl = `${baseUrl}?join=1&pin=${roomState.pin}`;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col">
      {isParticipantOnly ? (
        /* Clean Participant-Only Header: No Host Stage controls or view switchers */
        <header className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30">
          <div className="text-base font-extrabold tracking-tight text-white truncate">
            {roomState.title || '詞彙腦力激盪擂台'}
          </div>
          <div className="text-xs font-mono text-slate-400 shrink-0">
            PIN: <strong className="text-indigo-400">{roomState.pin}</strong>
          </div>
        </header>
      ) : (
        /* Host Top Bar: 3 Zones separated by gap-8 */
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
            詞彙腦力激盪擂台
          </a>

          {/* Zone 2: 4 clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <button
              onClick={() => {
                setViewMode('HOST');
                if (roomState.phase === 'REPORT') handleBackToPodium();
              }}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'HOST' && roomState.phase !== 'REPORT'
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
              員工手機搶答預覽
            </button>
            <button
              onClick={() => {
                setViewMode('HOST');
                handleShowReport();
              }}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'HOST' && roomState.phase === 'REPORT'
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
              題庫配置與重置
            </button>
          </nav>

          {/* Zone 3: 1 primary action for Host to preview mobile UI */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setViewMode(viewMode === 'HOST' ? 'PLAYER' : 'HOST')}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {viewMode === 'HOST' ? '預覽員工手機畫面' : '返回主舞台大螢幕'}
            </button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {!isParticipantOnly && viewMode === 'HOST' ? (
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
