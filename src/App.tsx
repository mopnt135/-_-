/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  EMOTIONS,
  EMOTION_NAMES,
  PRESET_CHEERS,
  PATH_COLORS,
} from './data/bookData';
import {
  pickCandidates,
  makeRungs,
  tracePath,
  CandidateBook,
  LANES,
  SVG_W,
  SVG_H,
  getX,
  getY,
} from './utils/ladder';
import {
  BookOpen,
  ChevronLeft,
  Phone,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
  ExternalLink,
  Mic,
  Volume2,
  Grid,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { AdminConsole } from './components/AdminConsole';
import {
  AdminAIConfig,
  loadAdminConfig,
  saveAdminConfig,
  verifyAdminPin,
} from './data/adminConfig';
import {
  loginWithGoogle,
  logout,
  subscribeAuth,
  saveAdminConfigToFirestore,
  loadAdminConfigFromFirestore,
} from './lib/firebase';
import type { User } from 'firebase/auth';

interface AnalysisResult {
  emotions: string[];
  guessed: boolean;
  crisis: boolean;
  tone: '위로' | '축하';
  message: string;
  provider?: string;
  note?: string;
}

interface ServerStatus {
  activeProvider: string;
  hasGeminiKey: boolean;
  hasClaudeKey: boolean;
  model: string;
}

export default function App() {
  // Screens: 'home' | 'loading' | 'result' | 'help' | 'admin'
  const [screen, setScreen] = useState<'home' | 'loading' | 'result' | 'help' | 'admin'>('home');
  const [inputText, setInputText] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Admin AI Config & Auth State
  const [adminConfig, setAdminConfig] = useState<AdminAIConfig>(() => loadAdminConfig());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [usePinFallback, setUsePinFallback] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Result state
  const [activeEmotions, setActiveEmotions] = useState<string[]>([]);
  const [cheer, setCheer] = useState<{ tone: '위로' | '축하'; message: string }>({
    tone: '위로',
    message: '',
  });
  const [analysisNote, setAnalysisNote] = useState<string>('');

  // Ladder game state
  const [candidates, setCandidates] = useState<CandidateBook[]>([]);
  const [rungs, setRungs] = useState<boolean[][]>([]);
  const [completedLanes, setCompletedLanes] = useState<number[]>([]);
  const [revealedBooks, setRevealedBooks] = useState<
    { candidate: CandidateBook; color: string; order: number }[]
  >([]);
  const [svgPaths, setSvgPaths] = useState<
    { d: string; color: string; len: number }[]
  >([]);
  const [isLadderRunning, setIsLadderRunning] = useState(false);

  // Crisis flow state
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // AI & API status modal
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [customClaudeKey, setCustomClaudeKey] = useState<string>(() => {
    return localStorage.getItem('CUSTOM_CLAUDE_KEY') || '';
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch server status & subscribe to Firebase Auth on mount
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data: ServerStatus) => setServerStatus(data))
      .catch((err) => console.log('Status fetch error:', err));

    const unsubscribe = subscribeAuth((user) => {
      setCurrentUser(user);
      if (user) {
        loadAdminConfigFromFirestore().then((remoteConfig) => {
          if (remoteConfig) {
            setAdminConfig((prev) => ({ ...prev, ...remoteConfig }));
          }
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Call timer simulation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (inCall) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [inCall]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const toggleEmotion = (name: string) => {
    if (selectedEmotions.includes(name)) {
      setSelectedEmotions(selectedEmotions.filter((e) => e !== name));
    } else {
      if (selectedEmotions.length >= 3) {
        showToast('표정은 최대 3개까지 고를 수 있어요.');
        return;
      }
      setSelectedEmotions([...selectedEmotions, name]);
    }
  };

  const resetHome = () => {
    setInputText('');
    setSelectedEmotions([]);
    setCompletedLanes([]);
    setRevealedBooks([]);
    setSvgPaths([]);
    setIsLadderRunning(false);
    setShowCrisisModal(false);
    setInCall(false);
    setCallDuration(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const startLadderForEmotions = (
    emotions: string[],
    cheerInfo: { tone: '위로' | '축하'; message: string },
    note: string
  ) => {
    const cands = pickCandidates(emotions);
    const newRungs = makeRungs();
    setCandidates(cands);
    setRungs(newRungs);
    setActiveEmotions(emotions);
    setCheer(cheerInfo);
    setAnalysisNote(note);
    setCompletedLanes([]);
    setRevealedBooks([]);
    setSvgPaths([]);
    setIsLadderRunning(false);
    setScreen('result');
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  // Run ladder ride animation
  const rideLadder = async (laneIndex: number) => {
    if (
      isLadderRunning ||
      completedLanes.includes(laneIndex) ||
      completedLanes.length >= 3
    ) {
      return;
    }

    setIsLadderRunning(true);
    const pickOrder = completedLanes.length;
    const color = PATH_COLORS[pickOrder];

    const { pts, end } = tracePath(laneIndex, rungs);
    const dStr = 'M' + pts.map((q) => q.join(',')).join(' L');

    // Create a temporary path element to compute total length for smooth stroke animation
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempSvg.setAttribute('d', dStr);
    const len = tempSvg.getTotalLength ? tempSvg.getTotalLength() : 800;

    setSvgPaths((prev) => [...prev, { d: dStr, color, len }]);
    setCompletedLanes((prev) => [...prev, laneIndex]);

    // Wait for the path animation to complete
    await new Promise((r) => setTimeout(r, 1350));

    const selectedCand = candidates[end];
    setRevealedBooks((prev) => [
      ...prev,
      { candidate: selectedCand, color, order: pickOrder + 1 },
    ]);

    setIsLadderRunning(false);
  };

  const rideAuto = async () => {
    if (isLadderRunning || completedLanes.length >= 3) return;
    const availableLanes = [0, 1, 2, 3, 4, 5].filter(
      (l) => !completedLanes.includes(l)
    );
    // Shuffle
    const shuffled = [...availableLanes].sort(() => Math.random() - 0.5);
    const needed = 3 - completedLanes.length;
    for (const lane of shuffled.slice(0, needed)) {
      await rideLadder(lane);
    }
  };

  // Submit flow
  const handleSubmit = async () => {
    const text = inputText.trim();
    const manualTags = [...selectedEmotions];

    if (!text && manualTags.length === 0) {
      showToast('마음을 적거나 표정을 하나 이상 골라 주세요.');
      return;
    }

    // Fast-path client safety check (using dynamic crisis words from adminConfig)
    const crisisKeywords =
      adminConfig.crisisWords && adminConfig.crisisWords.length > 0
        ? adminConfig.crisisWords
        : ['죽고싶', '죽고 싶', '자살', '죽어버리', '사라지고싶', '살기싫', '끝내고싶'];

    const flat = text.replace(/\s/g, '');
    if (crisisKeywords.some((w) => flat.includes(w.replace(/\s/g, '')))) {
      setShowCrisisModal(true);
      return;
    }

    // If only manual emotion emojis chosen without text
    if (!text) {
      const primary = manualTags[0];
      const isJoy = ['기쁨', '사랑'].includes(primary);
      const randomCheer =
        PRESET_CHEERS[primary]?.[0] || '당신의 오늘 하루를 응원해요.';
      startLadderForEmotions(
        manualTags,
        { tone: isJoy ? '축하' : '위로', message: randomCheer },
        '고른 표정으로 추천해요.'
      );
      return;
    }

    // Call server AI endpoint
    setScreen('loading');
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          customClaudeKey: customClaudeKey.trim() || undefined,
          adminConfig,
        }),
      });

      if (!response.ok) {
        throw new Error('API response not ok');
      }

      const data: AnalysisResult = await response.json();

      if (data.crisis) {
        setScreen('home');
        setShowCrisisModal(true);
        return;
      }

      const mergedEmotions = [
        ...new Set([...(data.emotions || []), ...manualTags]),
      ].slice(0, 3);

      if (mergedEmotions.length === 0) {
        setScreen('home');
        showToast('마음을 조금 더 적어 주시거나 표정을 골라 주세요.');
        return;
      }

      const note = data.guessed
        ? '감정 단어는 없지만 이런 마음일 것 같아 골랐어요. 다르다면 표정으로 알려 주세요.'
        : data.note || '';

      startLadderForEmotions(
        mergedEmotions,
        {
          tone: data.tone || '위로',
          message: data.message || PRESET_CHEERS[mergedEmotions[0]]?.[0] || '힘내세요!',
        },
        note
      );
    } catch (err) {
      console.error(err);
      setScreen('home');
      showToast('표정을 골라 추천을 시작해 보세요.');
    }
  };

  const getShopLinks = (title: string) => {
    const q = encodeURIComponent(title);
    return [
      { name: '교보문고', url: `https://search.kyobobook.co.kr/search?keyword=${q}` },
      { name: 'YES24', url: `https://www.yes24.com/Product/Search?domain=ALL&query=${q}` },
      { name: '알라딘', url: `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=All&SearchWord=${q}` },
    ];
  };

  return (
    <div className="relative w-full max-w-[430px] h-[100dvh] mx-auto overflow-hidden bg-[#0b0b0f] text-[#eef1f6] flex flex-col font-sans select-none border-x border-[#1b2232] shadow-2xl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-16 left-5 right-5 bg-[#e9eef7] text-[#0b0b0f] rounded-2xl px-4 py-3 text-sm z-50 shadow-2xl animate-pop text-center font-medium border border-white/20">
          {toastMessage}
        </div>
      )}

      {/* ────────────────── HOME SCREEN ────────────────── */}
      {screen === 'home' && (
        <div className="flex-1 flex flex-col h-full">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 pb-6">
            {/* Header Brand */}
            <div className="flex items-center justify-between pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#19a593] flex items-center justify-center shadow-lg shadow-[#19a593]/20">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-black tracking-tight text-white">마음 책방</span>
              </div>

              {/* Action Buttons: Admin Console & AI Status */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (currentUser) {
                      setScreen('admin');
                    } else {
                      setAdminPasscode('');
                      setPasscodeError('');
                      setUsePinFallback(false);
                      setShowAdminAuthModal(true);
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#141925] border border-[#262e3f] hover:border-[#19a593]/60 transition-colors text-xs text-[#b4bccb] cursor-pointer"
                  title="AI 관리자 콘솔"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#3fc1ae]" />
                  <span>관리자{currentUser ? ' (로그인됨)' : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#141925] border border-[#262e3f] hover:border-[#19a593]/60 transition-colors text-xs text-[#b4bccb] cursor-pointer"
                  title="AI 연결 상태 설정"
                >
                  <span className="w-2 h-2 rounded-full bg-[#3fc1ae] animate-pulse" />
                  <span>
                    {serverStatus?.activeProvider === 'gemini'
                      ? 'Gemini 3.8'
                      : serverStatus?.activeProvider === 'claude'
                      ? 'Claude'
                      : 'AI 연결됨'}
                  </span>
                  <Sliders className="w-3 h-3 text-[#7c8598] ml-0.5" />
                </button>
              </div>
            </div>

            {/* Hero Card */}
            <div className="bg-[#1a2a50] text-white rounded-3xl p-5 border border-[#2e3b5c] shadow-lg relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#3fc1ae]/10 rounded-full blur-2xl pointer-events-none" />
              <h2 className="text-2xl font-black leading-snug tracking-tight">
                오늘 마음은
                <br />
                어떠세요?
              </h2>
              <p className="text-xs text-[#5fd6c4] mt-1.5 mb-3.5 font-medium">
                있었던 일이나 지금 기분을 편하게 적어 주세요.
              </p>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value.slice(0, 300))}
                maxLength={300}
                placeholder="예: 내일 중요한 발표인데 손이 떨리고 긴장돼"
                className="w-full min-h-[96px] bg-[#1b2232] text-[#eef1f6] placeholder-[#7c8598] rounded-2xl p-3.5 text-[15px] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#19a593] border border-[#2e3b5c]/70 transition-all"
              />
              <div className="text-right text-[11px] text-[#5fd6c4] mt-1.5 font-mono">
                <span>{inputText.length}</span>/300
              </div>
            </div>

            {/* Emotion Face Selection */}
            <div className="flex justify-between items-baseline mt-6 mb-2.5">
              <h3 className="text-[15px] font-bold text-white flex items-center gap-1.5">
                <span>표정으로 고르기</span>
              </h3>
              <span className="text-xs text-[#7c8598]">
                {selectedEmotions.length > 0
                  ? `${selectedEmotions.length}/3 선택됨`
                  : '최대 3개'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {EMOTION_NAMES.map((name) => {
                const meta = EMOTIONS[name];
                const isSelected = selectedEmotions.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleEmotion(name)}
                    className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#19a593] bg-[#19a593]/20 shadow-md shadow-[#19a593]/10 scale-[1.02]'
                        : 'border-[#262e3f] bg-[#141925] hover:bg-[#1b2232] opacity-90'
                    }`}
                  >
                    <span className="text-2xl leading-none mb-1">{meta.emoji}</span>
                    <span
                      className={`text-xs ${
                        isSelected ? 'text-[#3fc1ae] font-bold' : 'text-[#b4bccb]'
                      }`}
                    >
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Helper Tips */}
            <div className="mt-6 p-3.5 rounded-2xl bg-[#141925]/60 border border-[#262e3f]/60 text-xs text-[#7c8598] flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#3fc1ae] shrink-0 mt-0.5" />
              <span>
                글을 적으면 AI가 감정과 상황을 분석하고, 어울리는 책 6권을 찾아 사다리 게임에 올려 둡니다.
              </span>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="p-4 px-5 pb-6 border-t border-[#262e3f] bg-[#0b0b0f] shrink-0">
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full h-[52px] rounded-2xl bg-[#1a2a50] hover:bg-[#22366a] active:bg-[#18213a] border border-[#2e3b5c] text-white text-base font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
            >
              <span>책 추천받기</span>
            </button>
            <p className="text-[11px] text-[#7c8598] text-center mt-2 font-normal">
              입력한 문장은 저장하지 않아요. 감정 분석을 위해 AI로 전송돼요.
            </p>
          </div>
        </div>
      )}

      {/* ────────────────── LOADING SCREEN ────────────────── */}
      {screen === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-5">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-4 border-[#19a593]/20 border-t-[#3fc1ae] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#3fc1ae] animate-pulse" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-1.5">AI가 마음을 읽고 있어요</h3>
            <p className="text-xs text-[#7c8598]">
              상황과 감정에 꼭 맞는 책들을 찾고 있어요...
            </p>
          </div>
        </div>
      )}

      {/* ────────────────── RESULT SCREEN ────────────────── */}
      {screen === 'result' && (
        <div className="flex-1 flex flex-col h-full">
          {/* Top AppBar */}
          <div className="h-13 border-b border-[#262e3f] px-3 flex items-center justify-between shrink-0 bg-[#0b0b0f]">
            <button
              type="button"
              onClick={() => {
                resetHome();
                setScreen('home');
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#1b2232] text-[#eef1f6] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-white">추천 결과</h2>
            <div className="w-10" />
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 pb-8 space-y-4">
            {/* Cheer Banner */}
            <div
              className={`relative overflow-hidden rounded-3xl p-5 text-center shadow-lg border ${
                cheer.tone === '축하'
                  ? 'bg-[#141925] border-[#19a593]'
                  : 'bg-[#1a2a50] border-[#2e3b5c]'
              }`}
            >
              {/* Confetti if celebratory */}
              {cheer.tone === '축하' && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(12)].map((_, i) => (
                    <span
                      key={i}
                      className="absolute top-0 w-2 h-3 rounded-xs opacity-0 animate-fall"
                      style={{
                        left: `${6 + i * 8}%`,
                        backgroundColor:
                          ['#ffffff', '#5fd6c4', '#19a593', '#5b7bc4'][i % 4],
                        animationDelay: `${(i % 5) * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              )}
              <div className="text-xs font-bold tracking-wider text-[#5fd6c4]">
                {cheer.tone === '축하' ? '축하해요' : '위로의 한마디'}
              </div>
              <div
                className={`mt-1.5 leading-snug text-white ${
                  cheer.tone === '축하'
                    ? 'font-jua text-[25px]'
                    : 'font-pen text-[32px] tracking-wide'
                }`}
              >
                {cheer.message}
              </div>
            </div>

            {/* Emotion Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeEmotions.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#19a593]/15 border border-[#1f6f66] text-[#3fc1ae] text-xs font-medium"
                >
                  <span>{EMOTIONS[name]?.emoji || '🌱'}</span>
                  <span>{name}</span>
                </span>
              ))}
            </div>

            {/* Note if inferred */}
            {analysisNote && (
              <div className="text-xs text-[#b4bccb] bg-[#19a593]/15 border border-[#1f6f66]/40 rounded-2xl p-3 leading-relaxed">
                {analysisNote}
              </div>
            )}

            {/* ─── Ladder Game Card ─── */}
            <div className="rounded-3xl border border-[#262e3f] bg-[#141925] p-4.5 shadow-xl">
              <div className="flex items-center justify-between">
                <h4 className="text-[15px] font-bold text-white">사다리를 타 보세요</h4>
                <span className="text-xs font-medium text-[#3fc1ae]">
                  {completedLanes.length < 3
                    ? `남은 기회 ${3 - completedLanes.length}번`
                    : '3권 선정 완료!'}
                </span>
              </div>
              <p className="text-xs text-[#7c8598] mt-1 mb-3.5">
                번호 3개를 고르면 연결된 추천 책이 하나씩 열려요.
              </p>

              {/* Top Departure Buttons (1 ~ 6) */}
              <div className="grid grid-cols-6 gap-1 text-center">
                {[0, 1, 2, 3, 4, 5].map((laneIndex) => {
                  const isDone = completedLanes.includes(laneIndex);
                  const order = completedLanes.indexOf(laneIndex);
                  const color = order >= 0 ? PATH_COLORS[order] : undefined;
                  return (
                    <div key={laneIndex} className="flex justify-center">
                      <button
                        type="button"
                        disabled={
                          isLadderRunning || isDone || completedLanes.length >= 3
                        }
                        onClick={() => rideLadder(laneIndex)}
                        style={
                          isDone && color
                            ? {
                                backgroundColor: color,
                                borderColor: color,
                                color: color === '#e9eef7' ? '#0b0b0f' : '#ffffff',
                              }
                            : {}
                        }
                        className={`w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center border transition-all cursor-pointer ${
                          isDone
                            ? 'shadow-md scale-105'
                            : 'border-[#5b7bc4] bg-[#141925] text-white hover:bg-[#1b2232] disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        {laneIndex + 1}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Ladder SVG Graphic */}
              <div className="relative my-2.5">
                <svg
                  className="w-full h-[170px] block"
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  preserveAspectRatio="none"
                >
                  {/* Vertical Lines */}
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <line
                      key={`v-${i}`}
                      x1={getX(i)}
                      y1={0}
                      x2={getX(i)}
                      y2={SVG_H}
                      stroke="#3a4458"
                      strokeWidth={3}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}

                  {/* Horizontal Rungs */}
                  {rungs.map((row, lv) =>
                    row.map((on, lane) =>
                      on ? (
                        <line
                          key={`r-${lv}-${lane}`}
                          x1={getX(lane)}
                          y1={getY(lv)}
                          x2={getX(lane + 1)}
                          y2={getY(lv)}
                          stroke="#3a4458"
                          strokeWidth={3}
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null
                    )
                  )}

                  {/* Animated Drawn Paths */}
                  {svgPaths.map((p, idx) => (
                    <path
                      key={`path-${idx}`}
                      d={p.d}
                      fill="none"
                      stroke={p.color}
                      strokeWidth={5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      style={{
                        strokeDasharray: p.len,
                        animation: 'dash 1.3s ease-in-out forwards',
                      }}
                    />
                  ))}
                </svg>
              </div>

              {/* Bottom Slots (Reveals Book) */}
              <div className="grid grid-cols-6 gap-1 text-center">
                {candidates.map((cand, slotIndex) => {
                  const revealed = revealedBooks.find(
                    (r) => r.candidate.book.title === cand.book.title
                  );
                  return (
                    <div
                      key={slotIndex}
                      style={
                        revealed
                          ? {
                              backgroundColor: revealed.color,
                              color:
                                revealed.color === '#e9eef7'
                                  ? '#0b0b0f'
                                  : '#ffffff',
                            }
                          : {}
                      }
                      className={`text-[10px] leading-tight min-h-[46px] p-1 rounded-xl flex flex-col items-center justify-center transition-all ${
                        revealed
                          ? 'font-bold shadow-md'
                          : 'bg-[#1b2232] text-[#7c8598]'
                      }`}
                    >
                      <span className="text-base">{EMOTIONS[cand.emotion]?.emoji}</span>
                      <span className="truncate w-full text-center px-0.5">
                        {revealed ? cand.book.title : '?'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Auto Run Button */}
              <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-[#262e3f]">
                <span className="text-xs text-[#b4bccb]">
                  {completedLanes.length < 3
                    ? `${3 - completedLanes.length}번 더 사다리를 타 보세요.`
                    : '추천 책 3권이 모두 도착했어요!'}
                </span>
                <button
                  type="button"
                  disabled={isLadderRunning || completedLanes.length >= 3}
                  onClick={rideAuto}
                  className="px-3.5 py-1.5 rounded-xl bg-[#19a593] hover:bg-[#3fc1ae] text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  자동으로 타기
                </button>
              </div>
            </div>

            {/* ─── Revealed Book Cards ─── */}
            {revealedBooks.length > 0 && (
              <div className="pt-2">
                <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <span>추천 책 ({revealedBooks.length}/3)</span>
                </h3>

                <div className="space-y-3.5">
                  {revealedBooks.map(({ candidate, color, order }) => {
                    const { book, emotion, matched } = candidate;
                    const meta = EMOTIONS[emotion];
                    return (
                      <article
                        key={book.title}
                        className="bg-[#141925] border border-[#262e3f] rounded-3xl p-4 shadow-lg grid grid-cols-[76px_1fr] gap-3.5 animate-pop"
                      >
                        {/* Book Spine & Cover */}
                        <div
                          className="w-[76px] aspect-[2/3] rounded-r-lg rounded-l-xs text-white p-2.5 relative flex flex-col justify-between shadow-2xl border border-white/10 overflow-hidden"
                          style={{ backgroundColor: meta?.coverColor || '#1f3260' }}
                        >
                          <div className="absolute left-1 top-0 bottom-0 w-[1px] bg-white/30" />
                          <div className="font-bold text-[11px] leading-tight line-clamp-3">
                            {book.title}
                          </div>
                          <div className="text-[9px] opacity-80 truncate">
                            {book.author}
                          </div>
                        </div>

                        {/* Book Content */}
                        <div className="min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start gap-1.5 font-bold text-[15px] leading-snug text-white">
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                                style={{
                                  backgroundColor: color,
                                  color: color === '#e9eef7' ? '#0b0b0f' : '#ffffff',
                                }}
                              >
                                {order}
                              </span>
                              <span className="truncate">{book.title}</span>
                            </div>
                            <div className="text-xs text-[#7c8598] mt-0.5">
                              {book.author} · {matched.map((m) => `${EMOTIONS[m]?.emoji} ${m}`).join(' ')}
                            </div>

                            {matched.length >= 2 && (
                              <span className="inline-block mt-1 text-[10px] font-bold text-[#3fc1ae] bg-[#19a593]/15 border border-[#1f6f66]/40 rounded-md px-1.5 py-0.5">
                                겹친 감정 {matched.length}개에 맞는 책
                              </span>
                            )}

                            <div className="mt-2.5">
                              <span className="text-[11px] font-bold text-[#3fc1ae] block">
                                줄거리
                              </span>
                              <p className="text-xs text-[#eef1f6] mt-0.5 leading-relaxed">
                                {book.plot}
                              </p>
                            </div>

                            <div className="mt-2">
                              <span className="text-[11px] font-bold text-[#3fc1ae] block">
                                이럴 때 읽어요
                              </span>
                              <p className="text-xs text-[#b4bccb] mt-0.5 leading-relaxed">
                                {book.reason}
                              </p>
                            </div>
                          </div>

                          {/* Purchase/Search Links */}
                          <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-[#262e3f]">
                            {getShopLinks(book.title).map((shop) => (
                              <a
                                key={shop.name}
                                href={shop.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-center text-[11px] text-[#3fc1ae] border border-[#1f6f66] rounded-xl py-1.5 font-medium hover:bg-[#19a593]/15 transition-colors flex items-center justify-center gap-0.5"
                              >
                                <span>{shop.name}</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                              </a>
                            ))}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {/* End Actions */}
            {completedLanes.length >= 3 && (
              <div className="pt-3 space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    startLadderForEmotions(
                      activeEmotions,
                      cheer,
                      '같은 감정으로 새 사다리를 만들었어요.'
                    )
                  }
                  className="w-full h-12 rounded-2xl bg-[#1a2a50] border border-[#2e3b5c] text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-[#22366a] transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-[#3fc1ae]" />
                  <span>같은 마음으로 다시 타기</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetHome();
                    setScreen('home');
                  }}
                  className="w-full h-12 rounded-2xl border border-[#1f6f66] text-[#3fc1ae] font-bold text-sm hover:bg-[#19a593]/10 transition-all cursor-pointer"
                >
                  처음으로
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────── HELP SCREEN ────────────────── */}
      {screen === 'help' && (
        <div className="flex-1 flex flex-col h-full">
          <div className="h-13 border-b border-[#262e3f] px-3 flex items-center justify-between shrink-0 bg-[#0b0b0f]">
            <button
              type="button"
              onClick={() => {
                resetHome();
                setScreen('home');
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#1b2232] text-[#eef1f6] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-white">도움받을 수 있는 곳</h2>
            <div className="w-10" />
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 pb-8 space-y-3">
            <div className="bg-[#1a2a50] text-white rounded-3xl p-5 border border-[#2e3b5c]">
              <div className="font-pen text-[30px] leading-tight">
                혼자 견디지 않아도 괜찮아요.
              </div>
              <p className="mt-2 text-xs text-[#5fd6c4] leading-relaxed">
                아래 번호는 24시간 연결돼요. 지금 즉시 위험하다면 119나 112에 먼저 전화해 주세요.
              </p>
            </div>

            {[
              { title: '긴급 구조', sub: '지금 위험할 때', tel: '119' },
              { title: '경찰', sub: '지금 위험할 때', tel: '112' },
              { title: '자살예방 상담전화', sub: '24시간, 누구나', tel: '109' },
              { title: '정신건강 위기상담', sub: '24시간', tel: '1577-0199' },
              { title: '청소년 상담전화', sub: '청소년', tel: '1388' },
            ].map((item) => (
              <div
                key={item.tel}
                className="flex items-center justify-between bg-[#141925] border border-[#262e3f] rounded-2xl p-4"
              >
                <div>
                  <div className="text-sm font-bold text-white">{item.title}</div>
                  <div className="text-xs text-[#7c8598]">{item.sub}</div>
                </div>
                <a
                  href={`tel:${item.tel.replace(/-/g, '')}`}
                  className="text-xl font-bold text-[#3fc1ae] font-mono hover:underline"
                >
                  {item.tel}
                </a>
              </div>
            ))}

            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  resetHome();
                  setScreen('home');
                }}
                className="w-full h-12 rounded-2xl border border-[#1f6f66] text-[#3fc1ae] font-bold text-sm hover:bg-[#19a593]/10 transition-all cursor-pointer"
              >
                처음으로
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── CRISIS MODAL ────────────────── */}
      {showCrisisModal && (
        <div className="absolute inset-0 bg-black/75 z-50 flex items-center justify-center p-6 animate-pop">
          <div className="bg-[#141925] border border-[#262e3f] rounded-3xl w-full p-6 text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-[#19a593] mx-auto mb-4 flex items-center justify-center shadow-lg shadow-[#19a593]/30">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-black text-white">119에 연결할까요?</h3>
            <p className="text-sm text-[#b4bccb] mt-2.5 leading-relaxed">
              지금 많이 힘드신 것 같아요.
              <br />
              무엇보다 당신의 안전이 가장 중요해요.
            </p>
            <div className="text-xs text-[#7c8598] bg-[#1b2232] rounded-xl p-3 mt-3.5">
              당장 위험하지 않다면 자살예방 상담전화 109로 이야기할 수도 있어요.
            </div>
            <div className="grid grid-cols-[1fr_1.4fr] gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => {
                  setShowCrisisModal(false);
                  resetHome();
                  setScreen('help');
                }}
                className="h-13 rounded-2xl border border-[#262e3f] text-[#b4bccb] font-bold text-sm hover:bg-[#1b2232] transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCrisisModal(false);
                  setInCall(true);
                  setCallDuration(0);
                }}
                className="h-13 rounded-2xl bg-[#19a593] hover:bg-[#3fc1ae] text-white font-bold text-base shadow-lg transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── SIMULATED CALL SCREEN ────────────────── */}
      {inCall && (
        <div className="absolute inset-0 z-50 bg-gradient-to-b from-[#13203f] to-black text-white flex flex-col items-center justify-between py-12 px-7 text-center">
          <div className="text-xs text-[#c7cde0] bg-white/10 rounded-xl px-3 py-1.5">
            프로토타입 화면이에요. 실제로 전화가 걸리지 않아요.
          </div>

          <div className="flex flex-col items-center">
            <div className="w-28 h-28 rounded-full border-2 border-[#5fd6c4] bg-[#3fc1ae]/10 flex items-center justify-center animate-ring">
              <Phone className="w-10 h-10 text-white" />
            </div>
            <div className="text-6xl font-black mt-6 tracking-wide">119</div>
            <div className="text-sm text-[#5fd6c4] mt-2">긴급 구조</div>
            <div className="text-sm text-[#eef1f6] mt-3 font-mono">
              {callDuration > 2
                ? `통화 중 ${String(Math.floor((callDuration - 2) / 60)).padStart(2, '0')}:${String((callDuration - 2) % 60).padStart(2, '0')}`
                : '연결하는 중…'}
            </div>
          </div>

          {/* Call Controls */}
          <div className="w-full">
            <div className="grid grid-cols-3 gap-6 mb-8 text-[#c7cde0] text-xs">
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <span>음소거</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                  <Grid className="w-5 h-5 text-white" />
                </div>
                <span>키패드</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                  <Volume2 className="w-5 h-5 text-white" />
                </div>
                <span>스피커</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setInCall(false);
                resetHome();
                setScreen('help');
              }}
              className="w-18 h-18 rounded-full bg-[#e04848] flex items-center justify-center mx-auto hover:bg-red-600 active:scale-95 transition-all shadow-xl shadow-red-900/40"
            >
              <Phone className="w-7 h-7 text-white rotate-[135deg]" />
            </button>
          </div>
        </div>
      )}

      {/* ────────────────── AI & API SETTINGS MODAL ────────────────── */}
      {showSettingsModal && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-5 animate-pop">
          <div className="bg-[#141925] border border-[#262e3f] rounded-3xl w-full max-w-[380px] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#262e3f]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#3fc1ae]" />
                <h3 className="text-base font-bold text-white">AI 엔진 및 API 설정</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-xs text-[#7c8598] hover:text-white px-2 py-1"
              >
                닫기
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              {/* Gemini Status */}
              <div className="p-3.5 rounded-2xl bg-[#1b2232] border border-[#2e3b5c]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-white text-[13px]">
                    <CheckCircle2 className="w-4 h-4 text-[#3fc1ae]" />
                    <span>Google Gemini 3.8 Flash (기본)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#19a593]/20 text-[#3fc1ae] text-[10px] font-bold">
                    서버 연동 완료
                  </span>
                </div>
                <p className="mt-1.5 text-[#b4bccb] leading-relaxed">
                  AI Studio의 <span className="text-white font-semibold">Settings &gt; Secrets</span>에 등록된{' '}
                  <code className="text-[#5fd6c4] font-mono">GEMINI_API_KEY</code>를 통해 서버에서 안전하게 호출됩니다.
                </p>
              </div>

              {/* Claude Option (Optional Fallback) */}
              <div className="p-3.5 rounded-2xl bg-[#1b2232] border border-[#262e3f]">
                <div className="font-bold text-white text-[13px] mb-1">
                  Claude API 키 연동 (선택 사항)
                </div>
                <p className="text-[#b4bccb] mb-2 leading-relaxed">
                  원하실 경우 Anthropic Claude API 키를 입력하여 감정 분석 엔진으로 직접 테스트할 수 있습니다.
                </p>
                <input
                  type="password"
                  placeholder="sk-ant-api03-..."
                  value={customClaudeKey}
                  onChange={(e) => {
                    setCustomClaudeKey(e.target.value);
                    localStorage.setItem('CUSTOM_CLAUDE_KEY', e.target.value);
                  }}
                  className="w-full bg-[#141925] border border-[#262e3f] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7c8598] focus:outline-none focus:border-[#19a593]"
                />
                {customClaudeKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomClaudeKey('');
                      localStorage.removeItem('CUSTOM_CLAUDE_KEY');
                    }}
                    className="text-[11px] text-[#e04848] mt-1.5 underline"
                  >
                    Claude 키 삭제
                  </button>
                )}
              </div>

              {/* Offline/Smart Fallback info */}
              <div className="text-[11px] text-[#7c8598] bg-[#0b0b0f] p-3 rounded-xl border border-[#262e3f]/60">
                💡 API 키가 없거나 할당량 제한 시에도 한국어 감정 키워드 분석 엔진이 자동으로 보조하므로 언제든 원활하게 작동합니다.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="w-full mt-4 h-11 rounded-xl bg-[#19a593] text-white font-bold text-sm hover:bg-[#3fc1ae] transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* ────────────────── ADMIN CONSOLE SCREEN ────────────────── */}
      {screen === 'admin' && (
        <AdminConsole
          initialConfig={adminConfig}
          currentUser={currentUser}
          onLogout={async () => {
            await logout();
            setCurrentUser(null);
            showToast('관리자 계정에서 로그아웃되었습니다.');
            setScreen('home');
          }}
          onSave={async (newCfg) => {
            saveAdminConfig(newCfg);
            setAdminConfig(newCfg);
            await saveAdminConfigToFirestore(newCfg, currentUser?.email || undefined);
            showToast('AI 관리자 설정이 안전하게 저장되었습니다.');
            setScreen('home');
          }}
          onBack={() => setScreen('home')}
        />
      )}

      {/* ────────────────── ADMIN GOOGLE AUTH MODAL ────────────────── */}
      {showAdminAuthModal && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-5 animate-pop">
          <div className="bg-[#141925] border border-[#262e3f] rounded-3xl w-full max-w-[350px] p-6 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-[#19a593]/20 flex items-center justify-center mx-auto mb-3.5 text-[#3fc1ae] shadow-lg shadow-[#19a593]/20">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white text-center">관리자 인증</h3>
            <p className="text-xs text-[#b4bccb] text-center mt-1 leading-relaxed">
              AI 모델 및 프롬프트 제어를 위해<br />Google 관리자 계정으로 로그인해 주세요.
            </p>

            <div className="mt-5 space-y-3">
              {/* Primary: Google Sign-In Button */}
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={async () => {
                  try {
                    setIsLoggingIn(true);
                    setPasscodeError('');
                    const user = await loginWithGoogle();
                    setShowAdminAuthModal(false);
                    showToast(`${user.displayName || user.email}님 환영합니다.`);
                    setScreen('admin');
                  } catch (err: any) {
                    console.error('Google login error:', err);
                    if (err?.code !== 'auth/popup-closed-by-user') {
                      setPasscodeError(err?.message || '구글 로그인 중 문제가 발생했습니다.');
                    }
                  } finally {
                    setIsLoggingIn(false);
                  }
                }}
                className="w-full h-12 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-slate-900 animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>{isLoggingIn ? '구글 연결 중...' : 'Google 계정으로 관리자 로그인'}</span>
              </button>

              {passcodeError && (
                <p className="text-xs text-[#e04848] text-center font-medium bg-red-500/10 p-2 rounded-xl border border-red-500/30">
                  {passcodeError}
                </p>
              )}

              {/* Secondary PIN Fallback Toggle */}
              {!usePinFallback ? (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUsePinFallback(true);
                      setPasscodeError('');
                    }}
                    className="text-[11px] text-[#7c8598] hover:text-[#3fc1ae] underline transition-colors"
                  >
                    또는 관리자 비밀번호(PIN)로 로그인
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (verifyAdminPin(adminPasscode)) {
                      setShowAdminAuthModal(false);
                      setPasscodeError('');
                      setScreen('admin');
                    } else {
                      setPasscodeError('비밀번호가 올바르지 않습니다.');
                    }
                  }}
                  className="space-y-2 pt-2 border-t border-[#262e3f]"
                >
                  <input
                    type="password"
                    maxLength={10}
                    autoFocus
                    value={adminPasscode}
                    onChange={(e) => {
                      setAdminPasscode(e.target.value);
                      setPasscodeError('');
                    }}
                    placeholder="암호 입력 (기본: 1234)"
                    className="w-full bg-[#1b2232] border border-[#2e3b5c] rounded-xl px-3.5 py-2.5 text-center text-xs font-mono text-white placeholder-[#7c8598] tracking-widest focus:outline-none focus:border-[#19a593]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setUsePinFallback(false)}
                      className="flex-1 h-9 rounded-xl border border-[#262e3f] text-xs text-[#b4bccb]"
                    >
                      Google 로그인으로
                    </button>
                    <button
                      type="submit"
                      className="flex-1 h-9 rounded-xl bg-[#1a2a50] border border-[#2e3b5c] text-xs font-bold text-white hover:bg-[#22366a]"
                    >
                      PIN 확인
                    </button>
                  </div>
                </form>
              )}

              <button
                type="button"
                onClick={() => setShowAdminAuthModal(false)}
                className="w-full mt-2 h-10 rounded-xl border border-[#262e3f] text-xs font-semibold text-[#b4bccb] hover:bg-[#1b2232] transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
