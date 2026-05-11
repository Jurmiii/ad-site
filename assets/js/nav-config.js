/**
 * Money Calendar — 기능 1~16 내비게이션 (기획서 명칭·번호와 동일)
 * 경로는 assets/ 기준 상대 경로.
 *
 * 폴더명은 기능 슬러그(예: daily-nospend = 8번 무지출)이며, id·title·path는 아래 배열이 단일 소스다.
 * 각 기능은 폴더 내 개별 파일명(예: 08_no_spending_calendar.html)을 사용한다.
 */
(function (w) {
  "use strict";

  w.MONEY_CALENDAR_NAV = [
    { id: 1, path: "debt-list.html", title: "부채 리스트", kicker: "1 · 정직한 직면" },
    { id: 2, path: "income-design/01_income_design.html", title: "계층형 수입 설계 엔진", kicker: "2 · 실제/예정/기타/희망" },
    { id: 3, path: "vision-budget/02_vision_allocation.html", title: "비전기반 예산 할당", kicker: "3 · 4단계 그룹" },
    { id: 4, path: "budget-lock/03_budget_lock.html", title: "예산안 확정 및 락(Lock)", kicker: "4 · 확정·잠금" },
    { id: 5, path: "budget-simulator/04_budget_simulator.html", title: "카테고리별 예산 분배 시뮬레이터", kicker: "5 · 4단계 시뮬레이션" },
    { id: 6, path: "daily-quick/05_daily_quick_input.html", title: "데일리 퀵 인풋", kicker: "6 · 데일리 퀵 인풋" },
    { id: 7, path: "daily-note/06_daily_note_review.html", title: "데일리 소비 한 줄 평", kicker: "" },
    { id: 8, path: "daily-sense/07_one_won_sense.html", title: "일일 소비 체감지수", kicker: "" },
    { id: 9, path: "daily-nospend/08_no_spending_calendar.html", title: "예산 준수 캘린더", kicker: "" },
    { id: 10, path: "weekly-report/09_weekly_practice_report.html", title: "주간 단위 실천 리포트", kicker: "10 · 달성률·차주 제언" },
    { id: 11, path: "monthly-review/10_monthly_budget_review.html", title: "월간 예산 복기 시스템", kicker: "11 · 집행률 비교" },
    { id: 12, path: "timeline/11_past_data_timeline.html", title: "과거 데이터 타임라인", kicker: "12 · 시계열" },
    { id: 13, path: "ai-feedback/12_ai_finance_feedback.html", title: "AI 재정 피드백", kicker: "13 · 규칙 기반 분석" },
    { id: 14, path: "backup-security/13_export_restore.html", title: "내보내기·복원", kicker: "14 · 엑셀·암호화" },
    { id: 15, path: "vision-simulator/14_vision_goal_simulator.html", title: "비전 달성 시뮬레이터", kicker: "15 · 미래 곡선" },
    { id: 16, path: "community/15_financial_health_diagnosis.html", title: "재정 건전성 정밀 진단", kicker: "16 · 정밀 진단" },
  ];
})(window);
