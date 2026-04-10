import type { FinanceState } from "@/types/finance";

export const sampleFinanceState: FinanceState = {
  incomes: [
    {
      id: "income-actual-1",
      title: "급여",
      type: "actual",
      priority: 1,
      amount: 3200000,
      receivedDate: "2026-04-01",
    },
    {
      id: "income-scheduled-1",
      title: "프로젝트 정산",
      type: "scheduled",
      priority: 2,
      amount: 600000,
      expectedDate: "2026-04-20",
    },
    {
      id: "income-other-1",
      title: "중고거래 수입",
      type: "other",
      priority: 4,
      amount: 120000,
    },
    {
      id: "income-aspirational-1",
      title: "N잡 콘텐츠 수익 목표",
      type: "aspirational",
      priority: 3,
      amount: 400000,
    },
  ],
  budgets: [
    { id: "budget-living", type: "living", name: "생활비", monthlyBudget: 850000 },
    { id: "budget-activity", type: "activity", name: "활동비", monthlyBudget: 300000 },
    { id: "budget-essential", type: "essential", name: "필수비용", monthlyBudget: 700000 },
  ],
  expenses: [],
};
