/**
 * Money Calendar — 기능 1~15 내비게이션 (기획서 명칭·번호와 동일)
 * 경로는 assets/ 기준 상대 경로
 */
(function (w) {
  "use strict";

  w.MONEY_CALENDAR_NAV = [
    { id: 1, path: "income-design/index.html", title: "계층형 수입 설계 엔진", kicker: "1 · 실제/예정/기타/희망" },
    { id: 2, path: "vision-budget/index.html", title: "비전 기반 예산 할당", kicker: "2 · 단기·장기 목표" },
    { id: 3, path: "budget-lock/index.html", title: "예산안 확정 및 락(Lock)", kicker: "3 · 이력·수정 제한" },
    { id: 4, path: "budget-simulator/index.html", title: "카테고리별 예산 분배 시뮬레이터", kicker: "4 · 비율·적정성" },
    { id: 5, path: "daily-quick/index.html", title: "데일리 퀵 인풋", kicker: "5 · 데일리 퀵 인풋" },
    { id: 6, path: "daily-note/index.html", title: "데일리 소비 한 줄 평", kicker: "" },
    { id: 7, path: "daily-sense/index.html", title: "1원 단위 체감 지수", kicker: "" },
    { id: 8, path: "daily-nospend/index.html", title: "예산 준수 캘린더 (무지출 스티커)", kicker: "" },
    { id: 9, path: "weekly-report/index.html", title: "주간 단위 실천 리포트", kicker: "9 · 달성률·차주 제언" },
    { id: 10, path: "monthly-review/index.html", title: "월간 예산 복기 시스템", kicker: "10 · 집행률 비교" },
    { id: 11, path: "timeline/index.html", title: "과거 데이터 타임라인", kicker: "11 · 시계열" },
    { id: 12, path: "ai-feedback/index.html", title: "AI 재정 피드백", kicker: "12 · 규칙 기반 분석" },
    { id: 13, path: "backup-security/index.html", title: "내보내기 · 복원", kicker: "13 · 엑셀·암호화" },
    { id: 14, path: "vision-simulator/index.html", title: "비전 달성 시뮬레이터", kicker: "14 · 미래 곡선" },
    { id: 15, path: "community/index.html", title: "재정 건전성 정밀 진단", kicker: "15 · 정밀 진단" },
  ];
})(window);
