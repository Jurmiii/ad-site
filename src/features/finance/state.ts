import type {
  BudgetBalance,
  BudgetCategoryModel,
  ExpenseModel,
  FinanceState,
  FinanceSummary,
  IncomeModel,
} from "@/types/finance";

export type ExpenseDraft = {
  id: string;
  date: string;
  item: string;
  amount: number;
  budgetCategoryId: string;
  dailyComment: string;
};

export type FinanceAction =
  | { type: "SET_INCOMES"; payload: IncomeModel[] }
  | { type: "UPSERT_INCOME"; payload: IncomeModel }
  | { type: "SET_BUDGETS"; payload: BudgetCategoryModel[] }
  | { type: "UPSERT_BUDGET"; payload: BudgetCategoryModel }
  | { type: "ADD_EXPENSE"; payload: ExpenseDraft }
  | { type: "SET_DAILY_COMMENT"; payload: { expenseId: string; comment: string } };

export const initialFinanceState: FinanceState = {
  incomes: [],
  budgets: [],
  expenses: [],
};

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) {
    return [...list, item];
  }

  return list.map((entry) => (entry.id === item.id ? item : entry));
}

function getCategorySpentAmount(expenses: ExpenseModel[], budgetCategoryId: string): number {
  return expenses
    .filter((expense) => expense.budgetCategoryId === budgetCategoryId)
    .reduce((total, expense) => total + expense.amount, 0);
}

function createExpenseModel(state: FinanceState, draft: ExpenseDraft): ExpenseModel {
  const targetBudget = state.budgets.find((budget) => budget.id === draft.budgetCategoryId);

  if (!targetBudget) {
    throw new Error(`Budget category not found: ${draft.budgetCategoryId}`);
  }

  const spentBefore = getCategorySpentAmount(state.expenses, draft.budgetCategoryId);
  const remainingBudgetBefore = targetBudget.monthlyBudget - spentBefore;
  const remainingBudgetAfter = remainingBudgetBefore - draft.amount;
  const remainingBudgetDelta = remainingBudgetAfter - remainingBudgetBefore;

  return {
    id: draft.id,
    date: draft.date,
    item: draft.item,
    amount: draft.amount,
    budgetCategoryId: draft.budgetCategoryId,
    remainingBudgetBefore,
    remainingBudgetAfter,
    remainingBudgetDelta,
    dailyComment: draft.dailyComment,
  };
}

export function financeReducer(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case "SET_INCOMES":
      return { ...state, incomes: action.payload };
    case "UPSERT_INCOME":
      return { ...state, incomes: upsertById(state.incomes, action.payload) };
    case "SET_BUDGETS":
      return { ...state, budgets: action.payload };
    case "UPSERT_BUDGET":
      return { ...state, budgets: upsertById(state.budgets, action.payload) };
    case "ADD_EXPENSE": {
      const expenseModel = createExpenseModel(state, action.payload);
      return { ...state, expenses: [...state.expenses, expenseModel] };
    }
    case "SET_DAILY_COMMENT":
      return {
        ...state,
        expenses: state.expenses.map((expense) =>
          expense.id === action.payload.expenseId
            ? { ...expense, dailyComment: action.payload.comment }
            : expense,
        ),
      };
    default:
      return state;
  }
}

export function selectBudgetBalances(state: FinanceState): BudgetBalance[] {
  return state.budgets.map((budget) => {
    const spent = getCategorySpentAmount(state.expenses, budget.id);
    return {
      categoryId: budget.id,
      categoryName: budget.name,
      monthlyBudget: budget.monthlyBudget,
      spent,
      remaining: budget.monthlyBudget - spent,
    };
  });
}

export function selectFinanceSummary(state: FinanceState): FinanceSummary {
  const totalIncomeActual = state.incomes
    .filter((income) => income.type === "actual")
    .reduce((total, income) => total + income.amount, 0);
  const totalIncomeScheduled = state.incomes
    .filter((income) => income.type === "scheduled")
    .reduce((total, income) => total + income.amount, 0);
  const totalIncomeOther = state.incomes
    .filter((income) => income.type === "other")
    .reduce((total, income) => total + income.amount, 0);
  const totalIncomeAspirational = state.incomes
    .filter((income) => income.type === "aspirational")
    .reduce((total, income) => total + income.amount, 0);

  const totalBudget = state.budgets.reduce((total, budget) => total + budget.monthlyBudget, 0);
  const totalSpent = state.expenses.reduce((total, expense) => total + expense.amount, 0);
  const totalRemainingBudget = totalBudget - totalSpent;

  return {
    totalIncomeActual,
    totalIncomeScheduled,
    totalIncomeOther,
    totalIncomeAspirational,
    totalBudget,
    totalSpent,
    totalRemainingBudget,
    budgetBalances: selectBudgetBalances(state),
  };
}
