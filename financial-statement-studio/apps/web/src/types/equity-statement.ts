export type EquityMoneyValue =
  | string
  | number;

export type EquityMovementLine = {
  ledger_account_id: string;
  account_code: string;
  account_name: string;

  opening_balance: EquityMoneyValue;
  direct_increases: EquityMoneyValue;
  direct_decreases: EquityMoneyValue;
  net_direct_movement: EquityMoneyValue;
  recorded_closing_balance:
    EquityMoneyValue;
};

export type EquityMovementSectionLine = {
  ledger_account_id: string;
  account_code: string;
  account_name: string;
  amount: EquityMoneyValue;
};

export type EquityMovementSection = {
  key: string;
  title: string;

  items: EquityMovementSectionLine[];

  total: EquityMoneyValue;
};

export type StatementOfChangesInEquity = {
  financial_report_id: string;
  company_id: string;
  currency: string;

  period_start: string;
  period_end: string;

  opening_recorded_equity:
    EquityMoneyValue;

  direct_increases:
    EquityMovementSection;

  direct_decreases:
    EquityMovementSection;

  net_direct_equity_movement:
    EquityMoneyValue;

  profit_after_tax:
    EquityMoneyValue;

  recorded_closing_equity:
    EquityMoneyValue;

  total_closing_equity:
    EquityMoneyValue;

  equity_accounts:
    EquityMovementLine[];

  calculated_recorded_closing_equity:
    EquityMoneyValue;

  equity_reconciliation_difference:
    EquityMoneyValue;

  is_reconciled: boolean;

  generated_at: string;
};