export type CashFlowMoneyValue =
  | string
  | number;

export type CashFlowReadinessAccount = {
  id: string;
  account_code: string;
  account_name: string;
  report_category: string;
  cash_flow_category: string | null;
  is_cash_equivalent: boolean;
  is_active: boolean;
};

export type CashFlowReadinessWarning = {
  code: string;
  message: string;
  ledger_account_id: string | null;
};

export type CashFlowReadiness = {
  financial_report_id: string;
  company_id: string;

  is_ready: boolean;

  active_cash_account_count: number;

  active_cash_accounts:
    CashFlowReadinessAccount[];

  warnings:
    CashFlowReadinessWarning[];

  generated_at: string;
};

export type CashFlowStatementLine = {
  ledger_account_id: string | null;
  account_code: string | null;
  account_name: string;
  amount: CashFlowMoneyValue;
};

export type CashFlowStatementSection = {
  key: string;
  title: string;

  items: CashFlowStatementLine[];

  total: CashFlowMoneyValue;
};

export type StatementOfCashFlows = {
  financial_report_id: string;
  company_id: string;
  currency: string;

  period_start: string;
  period_end: string;

  profit_after_tax:
    CashFlowMoneyValue;

  non_cash_adjustments:
    CashFlowStatementSection;

  working_capital_adjustments:
    CashFlowStatementSection;

  net_cash_from_operating_activities:
    CashFlowMoneyValue;

  investing_activities:
    CashFlowStatementSection;

  net_cash_from_investing_activities:
    CashFlowMoneyValue;

  financing_activities:
    CashFlowStatementSection;

  net_cash_from_financing_activities:
    CashFlowMoneyValue;

  net_increase_decrease_in_cash:
    CashFlowMoneyValue;

  opening_cash_balance:
    CashFlowMoneyValue;

  calculated_closing_cash:
    CashFlowMoneyValue;

  closing_cash_balance:
    CashFlowMoneyValue;

  cash_accounts:
    CashFlowStatementLine[];

  cash_reconciliation_difference:
    CashFlowMoneyValue;

  is_reconciled: boolean;

  generated_at: string;
};