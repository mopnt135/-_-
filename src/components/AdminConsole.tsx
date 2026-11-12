import React, { useState } from 'react';
import {
  AdminAIConfig,
  DEFAULT_ADMIN_CONFIG,
  DEFAULT_CRISIS_WORDS,
  resetAdminConfig,
  getAdminPin,
  setAdminPin
} from '../data/adminConfig';
import { ALL_BOOKS_LIST, EMOTIONS, EMOTION_NAMES } from '../data/bookData';
import {
  ChevronLeft,
  Sparkles,
  Sliders,
  ShieldAlert,
  Cpu,
  RotateCcw,
  Save,
  Plus,
  X,
  Check,
  AlertTriangle,
  Play,
  Lock,
  BookOpen,
  Search,
  ExternalLink,
  Flame,
  CheckCircle2,
  Clock,
  LogOut,
  UserCheck
} from 'lucide-react';
import type { User } from 'firebase/auth';

interface AdminConsoleProps {
  initialConfig: AdminAIConfig;
  onSave: (config: AdminAIConfig) => void;
  onBack: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

interface TestRunResult {
  emotions: string[];
  guessed: boolean;
  crisis: boolean;
  tone: '위로' | '축하';
  message: string;
  provider?: string;
  latencyMs: number;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  initialConfig,
  onSave,
  onBack,
  currentUser,
  onLogout
}) => {
  const [config, setConfig] = useState<AdminAIConfig>({ ...initialConfig });
  const [activeTab, setActiveTab] = useState<
    'prompt' | 'model' | 'crisis' | 'simulator' | 'books' | 'security'
  >('prompt');
  const [newKeyword, setNewKeyword] = useState('');
  const [bulkKeywordInput, setBulkKeywordInput] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Playground / Simulator State
  const [testText, setTestText] = useState('내일 중요한 시험인데 손이 떨리고 불안해');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);

  // Security (PIN change) State
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Books Explorer State
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [selectedBookCategory, setSelectedBookCategory] = useState<string>('all');

  const updateConfig = <K extends keyof AdminAIConfig>(
    key: K,
    val: AdminAIConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: val }));
    setHasUnsavedChanges(true);
  };

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    if (config.crisisWords.includes(trimmed)) {
      setNewKeyword('');
      return;
    }
    updateConfig('crisisWords', [...config.crisisWords, trimmed]);
    setNewKeyword('');
  };

  const handleBulkAdd = () => {
    if (!bulkKeywordInput.trim()) return;
    const tokens = bulkKeywordInput
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const merged = [...new Set([...config.crisisWords, ...tokens])];
    updateConfig('crisisWords', merged);
    setBulkKeywordInput('');
    setShowBulkAdd(false);
  };

  const handleRemoveKeyword = (word: string) => {
    updateConfig(
      'crisisWords',
      config.crisisWords.filter((w) => w !== word)
    );
  };

  const handleResetToDefault = () => {
    const reset = resetAdminConfig();
    setConfig(reset);
    setHasUnsavedChanges(true);
    setShowResetConfirm(false);
  };

  const handleSave = () => {
    onSave(config);
    setHasUnsavedChanges(false);
  };

  // Run AI Test Simulation
  const runSimulatorTest = async (phraseToTest?: string) => {
    const query = phraseToTest || testText;
    if (!query.trim()) return;
    if (phraseToTest) setTestText(phraseToTest);

    setIsTesting(true);
    const start = performance.now();
    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: query,
          adminConfig: config
        })
      });
      const data = await resp.json();
      const end = performance.now();
      setTestResult({
        emotions: data.emotions || [],
        guessed: !!data.guessed,
        crisis: !!data.crisis,
        tone: data.tone === '축하' ? '축하' : '위로',
        message: data.message || '',
        provider: data.provider || 'unknown',
        latencyMs: Math.round(end - start)
      });
    } catch (err) {
      console.error('Simulator test error:', err);
    } finally {
      setIsTesting(false);
    }
  };

  // Change Admin PIN
  const handlePinChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPin = getAdminPin();
    if (currentPinInput !== storedPin) {
      setPinChangeMsg({ type: 'err', text: '현재 관리자 비밀번호가 일치하지 않습니다.' });
      return;
    }
    if (newPinInput.length < 4) {
      setPinChangeMsg({ type: 'err', text: '새 비밀번호는 4자리 이상이어야 합니다.' });
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinChangeMsg({ type: 'err', text: '새 비밀번호 확인이 일치하지 않습니다.' });
      return;
    }

    setAdminPin(newPinInput);
    setPinChangeMsg({ type: 'ok', text: '관리자 비밀번호가 성공적으로 변경되었습니다.' });
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
  };

  // Filtered Books
  const filteredBooks = ALL_BOOKS_LIST.filter((b) => {
    const matchesCat =
      selectedBookCategory === 'all' || b.tags.includes(selectedBookCategory);
    const matchesQuery =
      !bookSearchQuery ||
      b.title.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
      b.plot.toLowerCase().includes(bookSearchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0f] text-[#eef1f6]">
      {/* Top Navigation Bar */}
      <div className="h-13 border-b border-[#262e3f] px-3 flex items-center justify-between shrink-0 bg-[#0b0b0f]">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#1b2232] text-[#eef1f6] transition-colors"
          title="책방으로 돌아가기"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#3fc1ae]" />
          <h2 className="text-base font-bold text-white">AI 관리자 콘솔</h2>
        </div>
        {currentUser && onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#1b2232] border border-[#2e3b5c] text-[11px] text-[#b4bccb] hover:text-[#e04848] transition-colors"
            title="구글 계정 로그아웃"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>로그아웃</span>
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Logged in Google User Info Banner */}
      {currentUser && (
        <div className="px-4 py-2 flex items-center justify-between text-xs border-b border-[#262e3f]/70 bg-[#141925]/60">
          <div className="flex items-center gap-2 min-w-0">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Admin"
                className="w-5 h-5 rounded-full border border-[#19a593] shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-[#19a593] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                G
              </div>
            )}
            <span className="truncate text-white font-medium text-xs">
              {currentUser.email}
            </span>
            <span className="shrink-0 text-[10px] text-[#3fc1ae] font-semibold bg-[#19a593]/20 border border-[#19a593]/40 px-1.5 py-0.5 rounded-md">
              Google 인증됨
            </span>
          </div>
        </div>
      )}

      {/* Horizontal Scrollable Tabs */}
      <div className="flex items-center border-b border-[#262e3f] bg-[#141925]/70 shrink-0 px-2 overflow-x-auto no-scrollbar gap-1">
        {[
          { id: 'prompt', label: '프롬프트 & 어조', icon: Sparkles },
          { id: 'model', label: '모델 & 추론', icon: Cpu },
          { id: 'crisis', label: '위기 안전망', icon: ShieldAlert },
          { id: 'simulator', label: '실시간 테스트', icon: Play },
          { id: 'books', label: '도서 카탈로그', icon: BookOpen },
          { id: 'security', label: '관리자 보안', icon: Lock }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'border-[#3fc1ae] text-[#3fc1ae]'
                  : 'border-transparent text-[#7c8598] hover:text-[#b4bccb]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-24 space-y-4">
        {/* ─── TAB 1: PROMPT & TONE ─── */}
        {activeTab === 'prompt' && (
          <div className="space-y-4 animate-pop">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-white">
                  시스템 지시문 (System Instruction)
                </label>
                <span className="text-[11px] text-[#7c8598]">AI 역할 및 분석 규칙</span>
              </div>
              <textarea
                value={config.systemPrompt}
                onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                rows={9}
                className="w-full bg-[#141925] border border-[#262e3f] rounded-2xl p-3 text-xs text-[#eef1f6] focus:outline-none focus:border-[#19a593] font-mono leading-relaxed"
                placeholder="시스템 지시문을 입력하세요..."
              />
              <p className="text-[11px] text-[#7c8598] mt-1">
                사용자의 글에서 8가지 감정 카테고리를 추출하는 기본 프롬프트입니다.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#141925] border border-[#262e3f] space-y-3">
              <div>
                <label className="text-xs font-bold text-[#3fc1ae] block mb-1">
                  위로(Comfort) 어조 지침
                </label>
                <textarea
                  value={config.comfortGuide}
                  onChange={(e) => updateConfig('comfortGuide', e.target.value)}
                  rows={2}
                  className="w-full bg-[#1b2232] border border-[#2e3b5c] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#19a593]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#3fc1ae] block mb-1">
                  축하(Celebration) 어조 지침
                </label>
                <textarea
                  value={config.celebrationGuide}
                  onChange={(e) => updateConfig('celebrationGuide', e.target.value)}
                  rows={2}
                  className="w-full bg-[#1b2232] border border-[#2e3b5c] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#19a593]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-white">
                    한마디 최대 글자 수
                  </label>
                  <span className="text-xs text-[#5fd6c4] font-mono font-bold">
                    {config.maxMessageLength}자
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={45}
                  value={config.maxMessageLength}
                  onChange={(e) =>
                    updateConfig('maxMessageLength', Number(e.target.value))
                  }
                  className="w-full accent-[#19a593] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#7c8598] mt-0.5">
                  <span>15자 (간결)</span>
                  <span>25자 (기본)</span>
                  <span>45자 (풍부)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: MODEL & REASONING ─── */}
        {activeTab === 'model' && (
          <div className="space-y-4 animate-pop">
            <div>
              <label className="text-xs font-bold text-white block mb-2">
                제미나이(Gemini) 모델 선택
              </label>
              <div className="space-y-2">
                {[
                  {
                    id: 'gemini-3.8-flash',
                    title: 'Gemini 3.8 Flash (권장 기본값)',
                    desc: '텍스트 분석 및 감정 추출에 최적화된 최신 초고속 모델'
                  },
                  {
                    id: 'gemini-3.1-flash-lite',
                    title: 'Gemini 3.1 Flash Lite',
                    desc: '초경량 초저지연 모델 (가장 빠른 응답 속도)'
                  },
                  {
                    id: 'gemini-4-argon',
                    title: 'Gemini 4 Argon',
                    desc: '복잡한 문맥 파악 및 심층 추론이 필요한 고급 모델'
                  }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      updateConfig(
                        'model',
                        item.id as AdminAIConfig['model']
                      )
                    }
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      config.model === item.id
                        ? 'bg-[#19a593]/15 border-[#3fc1ae] shadow-md shadow-[#19a593]/10'
                        : 'bg-[#141925] border-[#262e3f] hover:bg-[#1b2232]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">
                        {item.title}
                      </span>
                      {config.model === item.id && (
                        <Check className="w-4 h-4 text-[#3fc1ae]" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#7c8598] mt-1 leading-normal">
                      {item.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#141925] border border-[#262e3f]">
              <label className="text-xs font-bold text-white block mb-1">
                추론 강도 (Thinking Level)
              </label>
              <p className="text-[11px] text-[#7c8598] mb-2.5 leading-relaxed">
                Gemini 3 / 4 시리즈의 사고 깊이를 설정합니다.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'LOW', label: 'LOW (빠른 응답)' },
                  { id: 'MEDIUM', label: 'MEDIUM (균형 추론)' }
                ].map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() =>
                      updateConfig(
                        'thinkingLevel',
                        lvl.id as AdminAIConfig['thinkingLevel']
                      )
                    }
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                      config.thinkingLevel === lvl.id
                        ? 'bg-[#19a593] border-[#19a593] text-white shadow-md'
                        : 'bg-[#1b2232] border-[#2e3b5c] text-[#b4bccb] hover:bg-[#22366a]'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: CRISIS GUARDRAILS ─── */}
        {activeTab === 'crisis' && (
          <div className="space-y-4 animate-pop">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-white">
                  위기 감지 키워드 목록 ({config.crisisWords.length}개)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkAdd(!showBulkAdd)}
                    className="text-[11px] text-[#3fc1ae] underline hover:text-white"
                  >
                    {showBulkAdd ? '입력창 닫기' : '일괄 추가'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig('crisisWords', [...DEFAULT_CRISIS_WORDS])
                    }
                    className="text-[11px] text-[#7c8598] hover:text-[#b4bccb]"
                  >
                    기본단어 복원
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#7c8598] mb-2.5">
                사용자 입력에 아래 단어가 포함되거나 AI가 자해/위기를 감지하면 즉시 119 상담 화면으로 연결됩니다.
              </p>

              {/* Bulk Add Collapsible */}
              {showBulkAdd && (
                <div className="p-3 mb-3 rounded-2xl bg-[#141925] border border-[#3fc1ae]/50 space-y-2">
                  <label className="text-[11px] font-bold text-white block">
                    쉼표(,) 또는 줄바꿈으로 구분하여 여러 단어 입력
                  </label>
                  <textarea
                    rows={3}
                    value={bulkKeywordInput}
                    onChange={(e) => setBulkKeywordInput(e.target.value)}
                    placeholder="예: 단어1, 단어2, 단어3"
                    className="w-full bg-[#1b2232] border border-[#262e3f] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#19a593]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBulkAdd(false)}
                      className="px-2.5 py-1 text-xs text-[#7c8598]"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkAdd}
                      className="px-3 py-1 bg-[#19a593] hover:bg-[#3fc1ae] text-white rounded-lg text-xs font-bold"
                    >
                      목록에 일괄 추가
                    </button>
                  </div>
                </div>
              )}

              {/* Add Single Keyword Input */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                  placeholder="새 감지 단어 입력 후 추가..."
                  className="flex-1 bg-[#141925] border border-[#262e3f] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7c8598] focus:outline-none focus:border-[#19a593]"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="px-3.5 py-2 bg-[#19a593] hover:bg-[#3fc1ae] text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>추가</span>
                </button>
              </div>

              {/* Chips Cloud */}
              <div className="flex flex-wrap gap-1.5 max-h-[190px] overflow-y-auto p-2.5 rounded-2xl bg-[#141925] border border-[#262e3f]">
                {config.crisisWords.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e04848]/15 border border-[#e04848]/40 text-[#ff8080] text-xs font-medium"
                  >
                    <span>{word}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(word)}
                      className="hover:text-white transition-colors"
                      title="삭제"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-white block mb-1">
                위기 신호 감지 시 기본 안내 문구
              </label>
              <textarea
                value={config.crisisMessage}
                onChange={(e) => updateConfig('crisisMessage', e.target.value)}
                rows={2}
                className="w-full bg-[#141925] border border-[#262e3f] rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-[#19a593]"
              />
            </div>
          </div>
        )}

        {/* ─── TAB 4: REAL-TIME SIMULATOR PLAYGROUND ─── */}
        {activeTab === 'simulator' && (
          <div className="space-y-4 animate-pop">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-[#3fc1ae]" />
                  <span>AI 프롬프트 즉시 테스트</span>
                </label>
                <span className="text-[11px] text-[#7c8598]">현재 편집 설정 적용</span>
              </div>
              <p className="text-[11px] text-[#7c8598] mb-2">
                현재 설정된 프롬프트와 모델, 어조 지침을 즉시 문장에 적용하여 응답을 확인합니다.
              </p>

              {/* Preset Quick Buttons */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {[
                  '내일 시험인데 너무 긴장돼',
                  '오늘 승진 축하 파티했어',
                  '주말에 혼자 있으니 외로워',
                  '회사 퇴사하고 아무 의욕이 없어',
                  '모든 걸 끝내고 사라지고 싶어'
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => runSimulatorTest(sample)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-[#141925] border border-[#262e3f] text-[#b4bccb] hover:border-[#19a593] hover:text-white transition-all cursor-pointer"
                  >
                    "{sample}"
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="테스트할 마음 상태 문장을 입력하세요..."
                className="w-full bg-[#141925] border border-[#262e3f] rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-[#19a593]"
              />

              <button
                type="button"
                disabled={isTesting || !testText.trim()}
                onClick={() => runSimulatorTest()}
                className="w-full mt-2 h-11 rounded-xl bg-[#19a593] hover:bg-[#3fc1ae] disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>AI 분석 중...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>테스트 실행</span>
                  </>
                )}
              </button>
            </div>

            {/* Test Result View */}
            {testResult && (
              <div className="p-4 rounded-2xl bg-[#141925] border border-[#2e3b5c] space-y-2.5 animate-pop">
                <div className="flex items-center justify-between border-b border-[#262e3f] pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        testResult.crisis
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : testResult.tone === '축하'
                          ? 'bg-[#19a593]/20 text-[#3fc1ae] border border-[#19a593]/40'
                          : 'bg-[#5b7bc4]/20 text-[#8ba8ed] border border-[#5b7bc4]/40'
                      }`}
                    >
                      {testResult.crisis
                        ? '🚨 위기 감지'
                        : testResult.tone === '축하'
                        ? '🎉 축하 모드'
                        : '🌱 위로 모드'}
                    </span>
                    <span className="text-[11px] text-[#7c8598]">
                      엔진: {testResult.provider}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#5fd6c4] font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{testResult.latencyMs}ms</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-[#7c8598] block mb-1">
                    추출된 감정 카테고리:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {testResult.emotions.length > 0 ? (
                      testResult.emotions.map((e) => (
                        <span
                          key={e}
                          className="px-2.5 py-0.5 rounded-full bg-[#1b2232] border border-[#2e3b5c] text-xs font-semibold text-[#3fc1ae]"
                        >
                          {EMOTIONS[e]?.emoji || '🏷️'} {e}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[#7c8598]">감정 미감지</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-[#7c8598] block mb-1">
                    생성된 한마디 메시지:
                  </span>
                  <div className="p-2.5 rounded-xl bg-[#1b2232] text-xs text-white font-medium border border-[#262e3f]">
                    "{testResult.message}"
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 5: BOOKS CATALOG EXPLORER ─── */}
        {activeTab === 'books' && (
          <div className="space-y-3.5 animate-pop">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#3fc1ae]" />
                  <span>도서 추천 데이터베이스 (총 {ALL_BOOKS_LIST.length}권)</span>
                </label>
              </div>
              <p className="text-[11px] text-[#7c8598] mb-2.5">
                8가지 감정 카테고리에 매핑된 책 목록과 줄거리, 맞춤 이유를 검색하고 검토합니다.
              </p>

              {/* Search Bar */}
              <div className="relative mb-2.5">
                <Search className="w-3.5 h-3.5 text-[#7c8598] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={bookSearchQuery}
                  onChange={(e) => setBookSearchQuery(e.target.value)}
                  placeholder="도서명, 저자, 키워드 검색..."
                  className="w-full bg-[#141925] border border-[#262e3f] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-[#7c8598] focus:outline-none focus:border-[#19a593]"
                />
              </div>

              {/* Category Filter Chips */}
              <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar mb-2">
                <button
                  type="button"
                  onClick={() => setSelectedBookCategory('all')}
                  className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-all ${
                    selectedBookCategory === 'all'
                      ? 'bg-[#19a593] text-white font-bold'
                      : 'bg-[#141925] border border-[#262e3f] text-[#7c8598]'
                  }`}
                >
                  전체 ({ALL_BOOKS_LIST.length})
                </button>
                {EMOTION_NAMES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedBookCategory(cat)}
                    className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-all ${
                      selectedBookCategory === cat
                        ? 'bg-[#19a593] text-white font-bold'
                        : 'bg-[#141925] border border-[#262e3f] text-[#7c8598]'
                    }`}
                  >
                    {EMOTIONS[cat]?.emoji} {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Books List */}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {filteredBooks.map((book) => (
                <div
                  key={book.title}
                  className="p-3 rounded-2xl bg-[#141925] border border-[#262e3f] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-[13px]">
                      {book.title}
                    </span>
                    <div className="flex items-center gap-1">
                      {book.tags.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 rounded-md bg-[#1b2232] text-[10px] text-[#3fc1ae] border border-[#2e3b5c]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-[11px] text-[#7c8598]">{book.author} 저</div>
                  <p className="text-[11px] text-[#b4bccb] line-clamp-2">
                    {book.plot}
                  </p>
                  <div className="text-[11px] text-[#5fd6c4]">
                    💡 {book.reason}
                  </div>
                </div>
              ))}
              {filteredBooks.length === 0 && (
                <div className="p-6 text-center text-xs text-[#7c8598]">
                  일치하는 도서가 없습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 6: SECURITY (PIN CHANGE) ─── */}
        {activeTab === 'security' && (
          <div className="space-y-4 animate-pop">
            <div>
              <label className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
                <Lock className="w-3.5 h-3.5 text-[#3fc1ae]" />
                <span>관리자 비밀번호 (PIN) 변경</span>
              </label>
              <p className="text-[11px] text-[#7c8598] mb-3">
                관리자 콘솔 진입 시 사용할 4~8자리 비밀번호를 안전하게 변경합니다.
              </p>

              <form onSubmit={handlePinChangeSubmit} className="space-y-3">
                <div>
                  <label className="text-[11px] text-[#b4bccb] block mb-1">
                    현재 비밀번호
                  </label>
                  <input
                    type="password"
                    maxLength={10}
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value)}
                    placeholder="기본값: 1234"
                    className="w-full bg-[#141925] border border-[#262e3f] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7c8598] focus:outline-none focus:border-[#19a593]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#b4bccb] block mb-1">
                    새 비밀번호 (4자리 이상)
                  </label>
                  <input
                    type="password"
                    maxLength={10}
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    placeholder="새 암호 입력"
                    className="w-full bg-[#141925] border border-[#262e3f] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7c8598] focus:outline-none focus:border-[#19a593]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#b4bccb] block mb-1">
                    새 비밀번호 확인
                  </label>
                  <input
                    type="password"
                    maxLength={10}
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value)}
                    placeholder="새 암호 재입력"
                    className="w-full bg-[#141925] border border-[#262e3f] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7c8598] focus:outline-none focus:border-[#19a593]"
                  />
                </div>

                {pinChangeMsg && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-medium ${
                      pinChangeMsg.type === 'ok'
                        ? 'bg-[#19a593]/20 text-[#3fc1ae] border border-[#19a593]/40'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40'
                    }`}
                  >
                    {pinChangeMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full h-10 rounded-xl bg-[#19a593] hover:bg-[#3fc1ae] text-white font-bold text-xs transition-colors"
                >
                  비밀번호 변경 적용
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 max-w-[430px] w-full p-4 border-t border-[#262e3f] bg-[#0b0b0f] flex items-center gap-2.5 z-40">
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="h-12 px-4 rounded-2xl border border-[#262e3f] text-[#b4bccb] hover:text-white hover:bg-[#1b2232] font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>초기화</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          className={`flex-1 h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
            hasUnsavedChanges
              ? 'bg-[#19a593] hover:bg-[#3fc1ae] text-white shadow-[#19a593]/20'
              : 'bg-[#1a2a50] border border-[#2e3b5c] text-[#eef1f6] hover:bg-[#22366a]'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>{hasUnsavedChanges ? '변경사항 저장하기' : '설정 저장'}</span>
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-6 animate-pop">
          <div className="bg-[#141925] border border-[#262e3f] rounded-3xl p-5 text-center max-w-[320px] shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-[#e04848]/20 text-[#e04848] flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">설정 초기화</h4>
            <p className="text-xs text-[#b4bccb] mt-1.5 leading-relaxed">
              모든 프롬프트, 모델, 위기 감지 단어 목록을 서비스 기본값으로 되돌릴까요?
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="h-10 rounded-xl border border-[#262e3f] text-xs font-semibold text-[#b4bccb]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="h-10 rounded-xl bg-[#e04848] text-xs font-bold text-white hover:bg-red-600"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
