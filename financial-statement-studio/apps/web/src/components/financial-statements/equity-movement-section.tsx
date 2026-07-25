import {
  formatStatementMoney,
} from "@/components/financial-statements/statement-utils";
import type {
  EquityMovementSection,
} from "@/types/equity-statement";

type EquityMovementSectionProps = {
  section: EquityMovementSection;
  currency: string;
  hideWhenEmpty?: boolean;
};

export function EquityMovementSection({
  section,
  currency,
  hideWhenEmpty = false,
}: EquityMovementSectionProps) {
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
    <section className="financial-statement-section equity-movement-section">
      <header>
        <h3>
          {section.title}
        </h3>
      </header>

      <div className="financial-statement-lines">
        {hasItems ? (
          section.items.map(
            (item) => (
              <div
                className="financial-statement-line"
                key={
                  item.ledger_account_id
                }
              >
                <div>
                  <span>
                    {item.account_code}
                  </span>

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