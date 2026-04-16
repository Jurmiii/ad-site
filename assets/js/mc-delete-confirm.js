/**
 * 파괴적 삭제(로컬 기록 제거) 시 공통 확인 문구.
 * 모든 기능 페이지에서 동일한 신뢰 UX를 위해 사용합니다.
 */
(function (global) {
  var MESSAGE = "기록을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.";

  global.MoneyCalendarDelete = {
    message: MESSAGE,
    confirm: function () {
      return global.confirm(MESSAGE);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
