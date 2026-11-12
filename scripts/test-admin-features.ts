/**
 * Comprehensive automated test suite for Mind Bookstore & Admin AI features.
 */

async function runTests() {
  console.log('========================================================');
  console.log('🧪 Starting Mind Bookstore Admin AI Feature Test Suite');
  console.log('========================================================\n');

  const BASE_URL = 'http://localhost:3000';
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalCount++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ FAIL: ${testName} - ${detail || 'Assertion failed'}`);
    }
  }

  // Test 1: Check server status endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/status`);
    const status = await res.json();
    assert(res.ok && typeof status.activeProvider === 'string', 'API Status Endpoint Check', JSON.stringify(status));
  } catch (e: any) {
    assert(false, 'API Status Endpoint Check', e.message);
  }

  // Test 2: Standard Emotion Analysis (Anxiety / Fear)
  try {
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '내일 발표가 있는데 손이 떨리고 너무 긴장돼'
      })
    });
    const data = await res.json();
    assert(
      res.ok &&
      Array.isArray(data.emotions) &&
      data.emotions.includes('불안') &&
      data.tone === '위로' &&
      data.crisis === false,
      'Standard Analysis: Anxiety Detection & Comfort Tone',
      JSON.stringify(data)
    );
  } catch (e: any) {
    assert(false, 'Standard Analysis', e.message);
  }

  // Test 3: Joy / Celebration Tone Detection
  try {
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '드디어 원하던 시험에 최종 합격해서 너무 기뻐!'
      })
    });
    const data = await res.json();
    assert(
      res.ok &&
      data.emotions.includes('기쁨') &&
      data.tone === '축하' &&
      data.crisis === false,
      'Joy / Celebration Detection',
      JSON.stringify(data)
    );
  } catch (e: any) {
    assert(false, 'Joy / Celebration Detection', e.message);
  }

  // Test 4: Custom Admin Config - Custom Crisis Word
  try {
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '이곳에 관리자가등록한비상단어 키워드가 들어있습니다.',
        adminConfig: {
          crisisWords: ['관리자가등록한비상단어'],
          crisisMessage: '관리자가 지정한 긴급 상담 안내입니다.'
        }
      })
    });
    const data = await res.json();
    assert(
      res.ok &&
      data.crisis === true &&
      data.message === '관리자가 지정한 긴급 상담 안내입니다.',
      'Admin Config: Custom Crisis Keyword Immediate Intercept',
      JSON.stringify(data)
    );
  } catch (e: any) {
    assert(false, 'Custom Crisis Keyword Intercept', e.message);
  }

  // Test 5: Custom Admin Config - Custom Model & Prompt Parameters
  try {
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '오늘 혼자 집에 있으니 조금 적적하고 쓸쓸해',
        adminConfig: {
          model: 'gemini-3.8-flash',
          thinkingLevel: 'LOW',
          maxMessageLength: 20,
          comfortGuide: '다정하게 토닥여 주는 말'
        }
      })
    });
    const data = await res.json();
    assert(
      res.ok &&
      Array.isArray(data.emotions) &&
      (data.emotions.includes('외로움') || data.emotions.includes('슬픔')) &&
      typeof data.message === 'string',
      'Admin Config: Custom Model & Comfort Guide Execution',
      JSON.stringify(data)
    );
  } catch (e: any) {
    assert(false, 'Custom Model Execution', e.message);
  }

  // Test 6: Input Validation (Empty Text)
  try {
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' })
    });
    assert(res.status === 400, 'Edge Case: Empty Text Rejection (400 Bad Request)');
  } catch (e: any) {
    assert(false, 'Empty Text Rejection', e.message);
  }

  // Test 7: Static Book Catalog Integrity
  try {
    const { ALL_BOOKS_LIST } = await import('../src/data/bookData');
    const validTags = ['슬픔', '외로움', '불안', '분노', '무기력', '기쁨', '사랑', '후회'];
    const allHaveValidTags = ALL_BOOKS_LIST.every((b) =>
      b.title && b.author && b.plot && b.reason && b.tags.every((t) => validTags.includes(t))
    );
    assert(
      ALL_BOOKS_LIST.length === 48 && allHaveValidTags,
      'Data Integrity: 48 Books Catalog with Valid Emotion Tags',
      `Found ${ALL_BOOKS_LIST.length} books`
    );
  } catch (e: any) {
    assert(false, 'Book Catalog Integrity', e.message);
  }

  console.log('\n========================================================');
  console.log(`📊 Test Summary: ${passedCount} / ${totalCount} Passed`);
  console.log('========================================================\n');

  if (passedCount === totalCount) {
    console.log('✨ All features and integrations are functioning properly!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
