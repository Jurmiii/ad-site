import { AmountDelta } from "@/components/ui/amount-delta";
import { financeReducer, sampleFinanceState, selectFinanceSummary } from "@/features/finance";
import { formatKrw } from "@/lib/format/currency";

const stateWithTodayExpense = financeReducer(sampleFinanceState, {
  type: "ADD_EXPENSE",
  payload: {
    id: "expense-1",
    date: "2026-04-10",
    item: "점심 식사",
    amount: 12700,
    budgetCategoryId: "budget-living",
    dailyComment: "외식 대신 가성비 있는 한 끼로 만족.",
  },
});

const summary = selectFinanceSummary(stateWithTodayExpense);
const todayExpense = stateWithTodayExpense.expenses[stateWithTodayExpense.expenses.length - 1];

export default function HomePage() {
  return (
    <section className="grid gap-6">
      <div className="rounded-2xl border border-border bg-surface p-8">
        <p className="text-sm text-slate-500">Money Calendar</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          예산 중심 재정 루틴을 만드는 공개형 머니 캘린더
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
          단순한 지출 기록을 넘어, 월간 예산과 1원 단위 변동을 기반으로 소비의 흐름을
          직관적으로 이해하도록 돕습니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500">월 예산</p>
          <p className="mt-3 text-2xl font-semibold">{formatKrw(summary.totalBudget)}</p>
        </article>
        <article className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500">월 지출</p>
          <p className="mt-3 text-2xl font-semibold">{formatKrw(summary.totalSpent)}</p>
        </article>
        <article className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500">오늘 변동</p>
          <div className="mt-3">
            <AmountDelta value={todayExpense.remainingBudgetDelta} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{todayExpense.dailyComment}</p>
        </article>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-xs uppercase tracking-wide text-slate-500">카테고리 잔여 예산 스냅샷</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {summary.budgetBalances.map((balance) => (
            <article key={balance.categoryId} className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium text-slate-900">{balance.categoryName}</p>
              <p className="mt-1 text-xs text-slate-500">잔여 {formatKrw(balance.remaining)}</p>
              <div className="mt-2">
                <AmountDelta value={-balance.spent} />
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-xs uppercase tracking-wide text-slate-500">수입 우선순위 관리</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {stateWithTodayExpense.incomes
            .slice()
            .sort((a, b) => a.priority - b.priority)
            .map((income) => (
              <article key={income.id} className="rounded-xl border border-border p-4">
                <p className="text-sm font-medium text-slate-900">{income.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {income.type} | 우선순위 {income.priority}
                </p>
                <p className="mt-2 text-base font-semibold">{formatKrw(income.amount)}</p>
              </article>
            ))}
          </div>
      </div>
    </section>
  );
}
