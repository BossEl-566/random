import {
  CASH_FLOW_CATEGORY_OPTIONS,
  REPORT_CATEGORY_OPTIONS,
  type LedgerAccount,
} from "@/types/ledger-account";

type LedgerAccountRowProps = {
  account: LedgerAccount;
  parentName: string | null;
  isDeactivating: boolean;
  onEdit: (
    account: LedgerAccount,
  ) => void;
  onDeactivate: (
    account: LedgerAccount,
  ) => void;
};

function getOptionLabel(
  options: ReadonlyArray<{
    value: string;
    label: string;
  }>,
  value: string | null,
): string {
  if (!value) {
    return "Not assigned";
  }

  return (
    options.find(
      (option) =>
        option.value === value,
    )?.label ?? value
  );
}

export function LedgerAccountRow({
  account,
  parentName,
  isDeactivating,
  onEdit,
  onDeactivate,
}: LedgerAccountRowProps) {
  return (
    <tr
      className={
        account.is_active
          ? undefined
          : "ledger-row--inactive"
      }
    >
      <td>
        <span className="ledger-code">
          {account.account_code}
        </span>
      </td>

      <td>
        <div className="ledger-account-name">
          <strong>
            {account.account_name}
          </strong>

          <div>
            <span
              className={
                account.is_system_account
                  ? "ledger-origin ledger-origin--system"
                  : "ledger-origin ledger-origin--custom"
              }
            >
              {account.is_system_account
                ? "System"
                : "Custom"}
            </span>

            {!account.is_active ? (
              <span className="ledger-inactive-badge">
                Inactive
              </span>
            ) : null}
          </div>

          {account.description ? (
            <small>
              {account.description}
            </small>
          ) : null}
        </div>
      </td>

      <td>
        {getOptionLabel(
          REPORT_CATEGORY_OPTIONS,
          account.report_category,
        )}
      </td>

      <td>
        <span className="ledger-normal-balance">
          {account.normal_balance}
        </span>
      </td>

      <td>
        {getOptionLabel(
          CASH_FLOW_CATEGORY_OPTIONS,
          account.cash_flow_category,
        )}
      </td>

      <td>
        {parentName ??
          "No parent account"}
      </td>

      <td>
        <div className="ledger-row-actions">
          <button
            type="button"
            onClick={() =>
              onEdit(account)
            }
          >
            Edit
          </button>

          {account.is_active ? (
            <button
              className="ledger-row-actions__danger"
              type="button"
              disabled={isDeactivating}
              onClick={() =>
                onDeactivate(account)
              }
            >
              {isDeactivating
                ? "Deactivating..."
                : "Deactivate"}
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}