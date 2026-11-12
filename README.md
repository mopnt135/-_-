# 마음 책방 (Mind Bookstore) 📖✨

> 오늘의 감정을 AI로 분석하고 따뜻한 위로와 맞춤 책을 추천해 주는 모바일 심리 서점 웹 애플리케이션입니다.

---

## 🌟 주요 기능

1. **AI 실시간 감정 분석**
   - 사용자 일기/고민 텍스트를 분석하여 핵심 감정(우울, 불안, 지침, 기쁨 등)을 다각도로 도출
   - Google Gemini 3.8 Flash 모델 기반의 공감과 위로의 맞춤형 메시지 생성
   - API 연결 전/대체 상황을 위한 지능형 한국어 감정 키워드 폴백 엔진 내장

2. **맞춤형 도서 추천**
   - 분석된 감정 상태에 맞는 큐레이션 도서 카드 제공
   - 책 표지, 핵심 구절, 추천 이유 및 위로 한마디 포함

3. **심리적 위기 감지 및 긴급 도움 연결**
   - 극단적 표현이나 자해/위기 키워드 감지 시 즉각 위기 모드로 전환
   - 24시간 자살예방 상담전화(109), 정신건강 위기상담전화(1577-0199) 등 긴급 연락처 즉시 안내

4. **관리자 콘솔 (Admin Console)**
   - **Google 계정 로그인 (Firebase Authentication)** 지원
   - 시스템 프롬프트, AI 모델 선택, 응답 톤, 감온도(Temperature) 세부 조절
   - 위기 감지 키워드 실시간 추가/삭제 및 관리
   - 감정 분석 감도 조절 및 기본값 초기화 기능

5. **클라우드 데이터베이스 동기화**
   - Firebase Firestore 기반의 관리자 설정 클라우드 영구 저장
   - 오프라인/로컬 스토리지 자동 백업 지원

---

## 🛠 기술 스택

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React, Motion
- **Backend / Server**: Node.js, Express, tsx
- **AI / LLM**: Google Gemini API (`@google/genai`, Gemini 3.8 Flash)
- **Auth & Database**: Firebase Authentication (Google Sign-In), Cloud Firestore
- **Build & Dev**: Vite

---

## 🚀 시작하기

### 1. 저장소 클론 및 패키지 설치

```bash
git clone https://github.com/<your-username>/mind-bookstore.git
cd mind-bookstore
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 필요한 키를 입력합니다:

```bash
cp .env.example .env
```

`.env` 설정 항목:
```env
# Gemini API 키 (https://aistudio.google.com/ 에서 발급)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# 앱 호스팅 URL (로컬 실행 시 기본값)
APP_URL="http://localhost:3000"
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

### 4. 프로덕션 빌드

```bash
npm run build
npm start
```

---

## 📂 프로젝트 구조

```
├── public/                 # 정적 리소스
├── src/
│   ├── components/         # 리액트 컴포넌트 (AdminConsole, EmotionVisualizer 등)
│   ├── lib/                # Firebase 및 헬퍼 유틸리티
│   ├── App.tsx             # 메인 앱 컴포넌트
│   ├── main.tsx            # 진입점
│   └── index.css           # 글로벌 스타일 (Tailwind CSS)
├── scripts/                # 테스트 및 자동화 스크립트
├── server.ts               # Express API 서버 및 Gemini 연동
├── firestore.rules         # Firebase 보안 규칙
├── firebase-blueprint.json # Firestore 데이터 스키마 정의
├── package.json
└── vite.config.ts
```

---

## 🔒 보안 및 라이선스

- 관리자 설정 및 주요 API 호출은 서버 사이드 프록시(`server.ts`)를 통해 처리되어 API 키가 클라이언트에 직접 노출되지 않습니다.
- Firebase Firestore Security Rules가 적용되어 비인가 사용자의 무단 데이터 수정을 방지합니다.
