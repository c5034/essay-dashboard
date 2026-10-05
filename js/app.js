// ===================================================
// 논술 수업 기획 대시보드 - 프론트엔드 비즈니스 로직
// (js/app.js)
// ===================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 상태 관리
  const state = {
    currentCategory: 'all',
    apiStatus: null,
    schoolResult: null,
    assessments: ApiService.getAssessmentDataset()
  };

  // 1. 초기 데이터 로드 및 API 연동
  async function init() {
    renderApiLoading();

    // 1-1. .env 환경 및 서버 상태 조회
    state.apiStatus = await ApiService.checkConfig();
    updateApiStatusBar(state.apiStatus);

    // 1-2. 실제 NEIS 공공 학교 데이터 수신
    state.schoolResult = await ApiService.getSchoolList(10);
    renderDashboard();

    // 1-3. 이벤트 리스너 등록
    setupEventListeners();
  }

  function renderApiLoading() {
    const statusText = document.getElementById('api-status-text');
    if (statusText) statusText.textContent = '공공데이터 API 연결 확인 중...';
  }

  function updateApiStatusBar(config) {
    const statusDot = document.getElementById('api-status-dot');
    const statusText = document.getElementById('api-status-text');
    const keyBadge = document.getElementById('api-key-badge');

    if (config.status === 'ok') {
      statusDot.classList.add('connected');
      statusText.textContent = `로컬 서버 가동 중 (포트 ${config.port})`;
      
      if (config.neisKeyRegistered) {
        keyBadge.textContent = '.env NEIS 키 적용됨';
        keyBadge.style.color = '#34d399';
      } else {
        keyBadge.textContent = '.env 기본 공개 모드 (정상 연동)';
        keyBadge.style.color = '#a5b4fc';
      }
    } else {
      statusDot.classList.remove('connected');
      statusText.textContent = '정적 실행 모드 (브라우저 직접 통신)';
      keyBadge.textContent = '정적 환경';
    }
  }

  // 2. 대시보드 렌더링 (필터 적용)
  function renderDashboard() {
    const filteredData = state.currentCategory === 'all'
      ? state.assessments
      : state.assessments.filter(item => item.category === state.currentCategory);

    renderKPIs(filteredData);
    renderCompetencyRanking(filteredData);
    renderCompetencyMatrix(filteredData);
    renderAssessmentTable(filteredData);
    renderInsightBox(filteredData);
  }

  // 2-1. 상단 KPI 카드 계산 및 표시
  function renderKPIs(data) {
    const kpiSchools = document.getElementById('kpi-schools');
    const kpiItems = document.getElementById('kpi-items');
    const kpiTopCompetency = document.getElementById('kpi-top-competency');
    const kpiWeight = document.getElementById('kpi-weight');

    // 실제 NEIS 학교 수
    const totalCount = state.schoolResult?.totalCount || 12669;
    kpiSchools.textContent = `${totalCount.toLocaleString()}개교`;

    // 분석 평가항목 수
    kpiItems.textContent = `${data.length}개`;

    // 1순위 역량 집계
    const counts = {};
    data.forEach(d => {
      counts[d.primaryCompetency] = (counts[d.primaryCompetency] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topComp = sorted.length > 0 ? sorted[0][0] : '비판적 사고';
    kpiTopCompetency.textContent = topComp;

    // 평균 반영비율 계산
    let sumWeight = 0;
    data.forEach(d => {
      const num = parseInt(d.weight.replace('%', ''), 10) || 20;
      sumWeight += num;
    });
    const avgWeight = data.length > 0 ? Math.round(sumWeight / data.length) : 20;
    kpiWeight.textContent = `${avgWeight}%`;
  }

  // 2-2. 핵심 역량 출현 빈도수 랭킹 TOP 5
  function renderCompetencyRanking(data) {
    const rankingContainer = document.getElementById('ranking-list');
    rankingContainer.innerHTML = '';

    const counts = {};
    data.forEach(d => {
      counts[d.primaryCompetency] = (counts[d.primaryCompetency] || 0) + 2; // 주요 역량 가중치 2
      counts[d.secondaryCompetency] = (counts[d.secondaryCompetency] || 0) + 1; // 2차 역량 가중치 1
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const maxScore = sorted.length > 0 ? sorted[0][1] : 1;

    sorted.slice(0, 5).forEach(([name, score], index) => {
      const rank = index + 1;
      const percent = Math.round((score / maxScore) * 100);

      const item = document.createElement('div');
      item.className = `ranking-item rank-${rank}`;
      item.innerHTML = `
        <div class="ranking-item-header">
          <div class="competency-info">
            <span class="rank-badge">${rank}</span>
            <span class="competency-name">${name}</span>
          </div>
          <span class="competency-stat">${score}회 언급 (${percent}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar" style="width: ${percent}%;"></div>
        </div>
      `;
      rankingContainer.appendChild(item);
    });
  }

  // 2-3. 6대 핵심 역량 매트릭스
  function renderCompetencyMatrix(data) {
    const matrixContainer = document.getElementById('competency-matrix');
    matrixContainer.innerHTML = '';

    const coreCompetencies = [
      { name: '비판적·창의적 사고', tag: '사고력' },
      { name: '지식정보처리', tag: '자료분석' },
      { name: '협력적 소통', tag: '표현/공감' },
      { name: '심미적 감성', tag: '정서/창의' },
      { name: '자기관리', tag: '학습태도' },
      { name: '공동체 역량', tag: '사회성' }
    ];

    const counts = {};
    data.forEach(d => {
      counts[d.primaryCompetency] = (counts[d.primaryCompetency] || 0) + 1;
      counts[d.secondaryCompetency] = (counts[d.secondaryCompetency] || 0) + 1;
    });

    coreCompetencies.forEach(comp => {
      const count = counts[comp.name] || 0;
      const card = document.createElement('div');
      card.className = 'matrix-card';
      card.innerHTML = `
        <span class="matrix-tag">${comp.tag}</span>
        <span class="matrix-name">${comp.name}</span>
        <span class="matrix-val">${count}회</span>
      `;
      matrixContainer.appendChild(card);
    });
  }

  // 2-4. 학교별 국어 수행평가 계획 테이블
  function renderAssessmentTable(data) {
    const tbody = document.getElementById('assessment-tbody');
    tbody.innerHTML = '';

    data.forEach(item => {
      const tr = document.createElement('tr');
      const keywordsPills = item.rubricKeywords.map(k => `<span class="badge-tag">${k}</span>`).join(' ');

      tr.innerHTML = `
        <td><span class="badge-school">${item.schoolName}</span></td>
        <td><strong>${item.grade}</strong></td>
        <td>${item.taskTitle}</td>
        <td><strong>${item.weight}</strong></td>
        <td>${item.period}</td>
        <td>${keywordsPills}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 2-5. 이달의 수업 설계 인사이트 박스
  function renderInsightBox(data) {
    const insightBody = document.getElementById('insight-body');
    const insightTips = document.getElementById('insight-tips');

    const gradeLabel = state.currentCategory === 'all'
      ? '초·중등 전 학년'
      : state.currentCategory;

    insightBody.textContent = `${gradeLabel} 학교 평가계획 분석 결과, 단순 암기나 줄거리 요약형 글쓰기 대신 '자료에서 핵심 논거를 추출하여 내 생각을 논리적으로 서술하는 역량'의 비중이 가장 높게 집계되었습니다.`;

    insightTips.innerHTML = `
      <span class="tip-pill">💡 이번 주 추천: 사실과 의견 구분 훈련</span>
      <span class="tip-pill">💡 평가 기준 반영: 3단 문단 구조(서론-본론-결론) 완성하기</span>
      <span class="tip-pill">💡 수행평가 시즌: 4~5월 논술형 과제 대비 모의 작성</span>
    `;
  }

  // 3. 필터 탭 이벤트 설정
  function setupEventListeners() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.currentCategory = e.currentTarget.dataset.category;
        renderDashboard();
      });
    });

    const refreshBtn = document.getElementById('refresh-data-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.textContent = '새로고침 중...';
        state.schoolResult = await ApiService.getSchoolList(10);
        renderDashboard();
        refreshBtn.textContent = '데이터 새로고침';
      });
    }
  }

  // 실행 시작
  init();
});
