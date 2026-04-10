export type IncomeType = "actual" | "scheduled" | "other" | "aspirational";

export type BudgetCategoryType = "living" | "activity" | "essential" | "custom";

export type IncomePriority = 1 | 2 | 3 | 4 | 5;

export interface IncomeModel {
  id: string;
  title: string;
  type: IncomeType;
  priority: IncomePriority;
  amount: number;
  expectedDate?: string;
  receivedDate?: string;
  memo?: string;
}

export interface BudgetCategoryModel {
  id: string;
  type: BudgetCategoryType;
  name: string;
  monthlyBudget: number;
}

export interface ExpenseModel {
  id: string;
  date: string;
  item: string;
  amount: number;
  budgetCategoryId: string;
  remainingBudgetBefore: number;
  remainingBudgetAfter: number;
  remainingBudgetDelta: number;
  dailyComment: string;
}

export interface FinanceState {
  incomes: IncomeModel[];
  budgets: BudgetCategoryModel[];
  expenses: ExpenseModel[];
}

export interface BudgetBalance {
  categoryId: string;
  categoryName: string;
  monthlyBudget: number;
  spent: number;
  remaining: number;
}

export interface FinanceSummary {
  totalIncomeActual: number;
  totalIncomeScheduled: number;
  totalIncomeOther: number;
  totalIncomeAspirational: number;
  totalBudget: number;
  totalSpent: number;
  totalRemainingBudget: number;
  budgetBalances: BudgetBalance[];
}
