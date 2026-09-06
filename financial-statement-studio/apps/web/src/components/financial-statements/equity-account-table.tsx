import {
  formatStatementMoney,
} from "@/components/financial-statements/statement-utils";
import type {
  StatementOfChangesInEquity,
} from "@/types/equity-statement";

type EquityAccountTableProps = {
  statement: StatementOfChangesInEquity;
};

export function EquityAccountTable({
  statement,
}: EquityAccountTableProps) {
  const hasEquityAccounts =
    statement.equity_accounts.length >
    0;

  return (
    <section className="equity-account-breakdown">
      <header>
        <div>
          <span>
            Detailed analysis
          </span>

          <h3>
            Movement by Equity Account
          </h3>
        </div>

        <strong>
          {statement.currency}
        </strong>
      </header>

      {!hasEquityAccounts ? (
        <div className="equity-account-empty-summary">
          <div>
            <span>
              Equity-account activity
            </span>

            <strong>
              No posted equity-account
              movements were found.
            </strong>

            <p>
              There are no direct
              contributions, drawings,
              distributions or other posted
              movements against individual
              equity accounts for this
              reporting period.
            </p>
          </div>

          <div className="equity-account-empty-summary__figures">
            <div>
              <span>
                Opening recorded equity
              </span>

              <strong>
                {statement.currency}
                {" "}
                {formatStatementMoney(
                  statement
                    .opening_recorded_equity,
                )}
              </strong>
            </div>

            <div>
              <span>
                Recorded closing equity
              </span>

              <strong>
                {statement.currency}
                {" "}
                {formatStatementMoney(
                  statement
                    .recorded_closing_equity,
                )}
              </strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="equity-account-table-wrapper">
          <table className="equity-account-table">
            <colgroup>
              <col className="equity-account-table__account-column" />
              <col />
              <col />
              <col />
              <col />
              <col />
            </colgroup>

            <thead>
              <tr>
                <th scope="col">
                  Equity account
                </th>

                <th scope="col">
                  Opening
                </th>

                <th scope="col">
                  Increases
                </th>

                <th scope="col">
                  Decreases
                </th>

                <th scope="col">
                  Net movement
                </th>

                <th scope="col">
                  Recorded closing
                </th>
              </tr>
            </thead>

            <tbody>
              {statement.equity_accounts.map(
                (account) => (
                  <tr
                    key={
                      account
                        .ledger_account_id
                    }
                  >
                    <th scope="row">
                      <span>
                        {account.account_code}
                      </span>

                      <strong>
                        {account.account_name}
                      </strong>
                    </th>

                    <td>
                      {formatStatementMoney(
                        account.opening_balance,
                      )}
                    </td>

                    <td>
                      {formatStatementMoney(
                        account.direct_increases,
                      )}
                    </td>

                    <td>
                      {formatStatementMoney(
                        account.direct_decreases,
                      )}
                    </td>

                    <td>
                      {formatStatementMoney(
                        account.net_direct_movement,
                      )}
                    </td>

                    <td>
                      {formatStatementMoney(
                        account
                          .recorded_closing_balance,
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>

            <tfoot>
              <tr>
                <th scope="row">
                  Totals
                </th>

                <td>
                  {formatStatementMoney(
                    statement
                      .opening_recorded_equity,
                  )}
                </td>

                <td>
                  {formatStatementMoney(
                    statement
                      .direct_increases
                      .total,
                  )}
                </td>

                <td>
                  {formatStatementMoney(
                    statement
                      .direct_decreases
                      .total,
                  )}
                </td>

                <td>
                  {formatStatementMoney(
                    statement
                      .net_direct_equity_movement,
                  )}
                </td>

                <td>
                  {formatStatementMoney(
                    statement
                      .recorded_closing_equity,
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}