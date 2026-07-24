import {
  formatStatementMoney,
} from "@/components/financial-statements/statement-utils";
import type {
  CashFlowStatementSection,
} from "@/types/cash-flow";

type CashFlowSectionProps = {
  section: CashFlowStatementSection;
  currency: string;
  hideWhenEmpty?: boolean;
};

export function CashFlowSection({
  section,
  currency,
  hideWhenEmpty = false,
}: CashFlowSectionProps) {
  const hasItems =
    section.items.length > 0;

  if (
    hideWhenEmpty &&
    !hasItems &&
    Number(section.total) === 0
  ) {
    return null;
  }

  return (
    <section className="financial-statement-section cash-flow-section">
      <header>
        <h3>
          {section.title}
        </h3>
      </header>

      <div className="financial-statement-lines">
        {hasItems ? (
          section.items.map(
            (item, index) => (
              <div
                className="financial-statement-line"
                key={
                  item.ledger_account_id ??
                  `${section.key}-${index}`
                }
              >
                <div>
                  {item.account_code ? (
                    <span>
                      {item.account_code}
                    </span>
                  ) : null}

                  <strong>
                    {item.account_name}
                  </strong>
                </div>

                <span className="financial-statement-line__amount">
                  {formatStatementMoney(
                    item.amount,
                  )}
                </span>
              </div>
            ),
          )
        ) : (
          <div className="financial-statement-line financial-statement-line--empty">
            <div>
              <strong>
                No movements recorded
              </strong>
            </div>

            <span>—</span>
          </div>
        )}
      </div>

      <footer>
        <strong>
          Total {section.title}
        </strong>

        <strong>
          <span className="financial-statement-currency">
            {currency}
          </span>

          {formatStatementMoney(
            section.total,
          )}
        </strong>
      </footer>
    </section>
  );
}