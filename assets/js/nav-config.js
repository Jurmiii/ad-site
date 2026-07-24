/**
 * Money Calendar — 기능 1~16 내비게이션 (기획서 명칭·번호와 동일)
 * path는 Clean URL 기준(앞에 / 없음, .html 없음). 실제 파일은 /assets/ 아래.
 * Netlify가 /debt-list → /assets/debt-list.html 로 rewrite 한다.
 */
(function (w) {
  "use strict";

  w.MONEY_CALENDAR_NAV = [
    { id: 1, path: "debt-list", title: "부채 리스트", kicker: "1 · 정직한 직면" },
    { id: 2, path: "income-design/02_income_design", title: "계층형 수입 설계 엔진", kicker: "2 · 실제/예정/기타/희망" },
    { id: 3, path: "vision-budget/03_vision_allocation", title: "비전기반 예산 할당", kicker: "3 · 4단계 그룹" },
    { id: 4, path: "budget-lock/04_budget_lock", title: "예산안 확정 및 락(Lock)", kicker: "4 · 확정·잠금" },
    { id: 5, path: "budget-simulator/05_budget_simulator", title: "카테고리별 예산 분배 시뮬레이터", kicker: "5 · 4단계 시뮬레이션" },
    { id: 6, path: "daily-quick/06_daily_quick_input", title: "데일리 퀵 인풋", kicker: "6 · 데일리 퀵 인풋" },
    { id: 7, path: "daily-note/07_daily_note_review", title: "데일리 소비 한 줄 평", kicker: "" },
    { id: 8, path: "daily-sense/08_one_won_sense", title: "일일 소비 체감지수", kicker: "" },
    { id: 9, path: "daily-nospend/09_no_spending_calendar", title: "예산 준수 캘린더", kicker: "" },
    { id: 10, path: "weekly-report/10_weekly_practice_report", title: "주간 단위 실천 리포트", kicker: "10 · 달성률·차주 제언" },
    { id: 11, path: "monthly-review/11_monthly_budget_review", title: "월간 예산 복기 시스템", kicker: "11 · 집행률 비교" },
    { id: 12, path: "timeline/12_past_data_timeline", title: "과거 데이터 타임라인", kicker: "12 · 시계열" },
    { id: 13, path: "ai-feedback/13_ai_finance_feedback", title: "AI 재정 피드백", kicker: "13 · 규칙 기반 분석" },
    { id: 14, path: "backup-security/14_export_restore", title: "내보내기·복원", kicker: "14 · 엑셀·암호화" },
    { id: 15, path: "vision-simulator/15_vision_goal_simulator", title: "비전 달성 시뮬레이터", kicker: "15 · 미래 곡선" },
    { id: 16, path: "community/16_financial_health_diagnosis", title: "재정 건전성 정밀 진단", kicker: "16 · 정밀 진단" },
  ];
})(window);
