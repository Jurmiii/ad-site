/**
 * 2번 비전 예산 스냅샷 — 고정 지출 우선 후 잔여 가용(disposable) 계산
 * 수입 − 고정 지출 − 비전 할당 합 = disposable (전역 연동용)
 */
(function (w) {
  "use strict";

  var KEY = "moneyCalendar.visionBudget.v1";

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      var totalIncome = Math.max(0, Math.trunc(Number(o.totalIncome) || 0));
      var fixedExpense = Math.max(0, Math.trunc(Number(o.fixedExpense) || 0));
      var arr = Array.isArray(o.visions) ? o.visions : [];
      var visionSum = arr.reduce(function (s, v) {
        return s + Math.max(0, Math.trunc(Number(v && v.monthlyAllocation) || 0));
      }, 0);
      var disposable = totalIncome - fixedExpense - visionSum;
      return {
        totalIncome: totalIncome,
        fixedExpense: fixedExpense,
        visionSum: visionSum,
        disposable: disposable,
      };
    } catch (e) {
      return null;
    }
  }

  w.MoneyCalendarVisionBudget = { read: read };
})(window);
