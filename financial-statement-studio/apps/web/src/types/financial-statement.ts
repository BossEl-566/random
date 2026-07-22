export type MoneyValue =
  | string
  | number;

export type FinancialStatementLine = {
  ledger_account_id: string | null;
  account_code: string | null;
  account_name: string;
  report_category: string;
  amount: MoneyValue;
  is_calculated: boolean;
};

export type FinancialStatementSection = {
  key: string;
  title: string;
  items: FinancialStatementLine[];
  total: MoneyValue;
};

export type ProfitOrLossStatement = {
  financial_report_id: string;
  company_id: string;
  currency: string;

  period_start: string;
  period_end: string;

  sections: FinancialStatementSection[];

  revenue: MoneyValue;
  direct_costs: MoneyValue;
  gross_profit: MoneyValue;

  other_income: MoneyValue;

  administrative_expenses: MoneyValue;
  selling_distribution_expenses: MoneyValue;

  operating_profit: MoneyValue;

  finance_costs: MoneyValue;
  profit_before_tax: MoneyValue;

  taxation: MoneyValue;
  profit_after_tax: MoneyValue;

  generated_at: string;
};

export type StatementOfFinancialPosition = {
  financial_report_id: string;
  company_id: string;
  currency: string;

  as_of: string;

  sections: FinancialStatementSection[];

  current_assets: MoneyValue;
  non_current_assets: MoneyValue;
  total_assets: MoneyValue;

  current_liabilities: MoneyValue;
  non_current_liabilities: MoneyValue;
  total_liabilities: MoneyValue;

  recorded_equity: MoneyValue;
  current_year_profit: MoneyValue;
  total_equity: MoneyValue;

  total_liabilities_and_equity: MoneyValue;

  accounting_equation_difference: MoneyValue;
  is_balanced: boolean;

  generated_at: string;
};