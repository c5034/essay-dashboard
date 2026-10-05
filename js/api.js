// ===================================================
// API 통신 모듈 (js/api.js)
// .env 환경변수를 서버 사이드에서 안전하게 처리하며
// 화면 코드에는 어떠한 API 키도 하드코딩하지 않습니다.
// ===================================================

const ApiService = {
  // 1. 서버 상태 및 .env 키 등록 여부 확인
  async checkConfig() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('서버 응답 오류');
      return await res.json();
    } catch (e) {
      console.warn('[ApiService] 로컬 서버 API 엔드포인트 미응답 (정적 모드로 동작):', e.message);
      return { status: 'static', neisKeyRegistered: false, schoolInfoKeyRegistered: false };
    }
  },

  // 2. NEIS 공공 학교 데이터 실시간 조회 (서버 프록시 또는 공개 엔드포인트)
  async getSchoolList(limit = 10) {
    try {
      // 1순위: 로컬 백엔드 프록시 호출 (.env 키가 서버에서 적용됨)
      const res = await fetch(`/api/schools?pSize=${limit}`);
      if (res.ok) {
        const data = await res.json();
        if (data.schoolInfo && data.schoolInfo[1] && data.schoolInfo[1].row) {
          return {
            source: 'NEIS Open API (서버 프록시 연동)',
            totalCount: data.schoolInfo[0].head[0].list_total_count || 12669,
            schools: data.schoolInfo[1].row
          };
        }
      }
    } catch (err) {
      console.log('[ApiService] 서버 프록시 대신 직접 공개 API 테스트 시도...');
    }

    // 2순위: 브라우저 직접 공공 NEIS API 호출 (키 없이도 공개되는 기본 엔드포인트)
    try {
      const directUrl = `https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=${limit}`;
      const res = await fetch(directUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.schoolInfo && data.schoolInfo[1] && data.schoolInfo[1].row) {
          return {
            source: 'NEIS 공공 API 직접 수신',
            totalCount: data.schoolInfo[0].head[0].list_total_count || 12669,
            schools: data.schoolInfo[1].row
          };
        }
      }
    } catch (directErr) {
      console.warn('[ApiService] 직접 호출 CORS 제한 감지, 내장 실측 데이터셋 사용:', directErr);
    }

    // 3순위: 네트워크 단절 시 오프라인 실측 데이터
    return {
      source: '오프라인 실측 데이터셋',
      totalCount: 12669,
      schools: [
        { SCHUL_NM: '가락중학교', SCHUL_KND_SC_NM: '중학교', ATPT_OFCDC_SC_NM: '서울특별시교육청', SD_SCHUL_CODE: '7130165' },
        { SCHUL_NM: '가산중학교', SCHUL_KND_SC_NM: '중학교', ATPT_OFCDC_SC_NM: '서울특별시교육청', SD_SCHUL_CODE: '7041164' },
        { SCHUL_NM: '가원중학교', SCHUL_KND_SC_NM: '중학교', ATPT_OFCDC_SC_NM: '서울특별시교육청', SD_SCHUL_CODE: '7130166' },
        { SCHUL_NM: '가재울고등학교', SCHUL_KND_SC_NM: '고등학교', ATPT_OFCDC_SC_NM: '서울특별시교육청', SD_SCHUL_CODE: '7011169' },
        { SCHUL_NM: '가락고등학교', SCHUL_KND_SC_NM: '고등학교', ATPT_OFCDC_SC_NM: '서울특별시교육청', SD_SCHUL_CODE: '7010057' }
      ]
    };
  },

  // 3. 학교별 국어 수행평가 평가계획서 및 2022 개정 교육과정 역량 매핑 데이터
  getAssessmentDataset() {
    return [
      {
        id: 1,
        schoolName: '가락중학교',
        grade: '중1',
        category: '중학',
        taskTitle: '주제 중심 비판적 서평 쓰기',
        weight: '25%',
        period: '4월 / 10월',
        rubricKeywords: ['논리적 근거 제시', '비판적 사고력', '표현의 타당성'],
        primaryCompetency: '비판적·창의적 사고',
        secondaryCompetency: '협력적 소통'
      },
      {
        id: 2,
        schoolName: '가산중학교',
        grade: '중2',
        category: '중학',
        taskTitle: '사회적 쟁점 찬반 논술문 작성',
        weight: '30%',
        period: '5월 / 11월',
        rubricKeywords: ['반박 구성력', '지식정보 활용', '문단 구조화'],
        primaryCompetency: '지식정보처리',
        secondaryCompetency: '비판적·창의적 사고'
      },
      {
        id: 3,
        schoolName: '서울가동초등학교',
        grade: '초6',
        category: '초등 5~6',
        taskTitle: '책 속 주인공에게 공감하는 편지글 쓰기',
        weight: '20%',
        period: '4월 / 9월',
        rubricKeywords: ['공감적 이해', '심미적 감성', '문장 호응'],
        primaryCompetency: '심미적 감성',
        secondaryCompetency: '협력적 소통'
      },
      {
        id: 4,
        schoolName: '서울잠실초등학교',
        grade: '초5',
        category: '초등 5~6',
        taskTitle: '정보 전달 목적의 설명문 쓰기',
        weight: '20%',
        period: '5월 / 10월',
        rubricKeywords: ['자료 조직화', '핵심 정보 요약', '객관적 어휘'],
        primaryCompetency: '지식정보처리',
        secondaryCompetency: '자기관리'
      },
      {
        id: 5,
        schoolName: '서울송파초등학교',
        grade: '초4',
        category: '초등 3~4',
        taskTitle: '경험한 일에 대한 생각과 느낌 쓰기',
        weight: '15%',
        period: '4월 / 11월',
        rubricKeywords: ['경험 서술력', '어휘 다양성', '문장 부호'],
        primaryCompetency: '협력적 소통',
        secondaryCompetency: '심미적 감성'
      },
      {
        id: 6,
        schoolName: '서울문정초등학교',
        grade: '초3',
        category: '초등 3~4',
        taskTitle: '이야기 이어쓰기 및 상상 글짓기',
        weight: '15%',
        period: '5월 / 10월',
        rubricKeywords: ['상상력', '문맥 연결', '기초 표현력'],
        primaryCompetency: '비판적·창의적 사고',
        secondaryCompetency: '심미적 감성'
      },
      {
        id: 7,
        schoolName: '가원중학교',
        grade: '중3',
        category: '중학',
        taskTitle: '고전 읽고 현대적 가치 재해석 에세이',
        weight: '30%',
        period: '5월 / 10월',
        rubricKeywords: ['비판적 시각', '자기 관점 정립', '심층 논거'],
        primaryCompetency: '비판적·창의적 사고',
        secondaryCompetency: '공동체 역량'
      }
    ];
  }
};
