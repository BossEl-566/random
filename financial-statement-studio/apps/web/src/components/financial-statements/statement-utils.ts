import type {
  MoneyValue,
} from "@/types/financial-statement";

export function toNumber(
  value: MoneyValue,
): number {
  const numericValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(
    numericValue,
  )
    ? numericValue
    : 0;
}

export function formatStatementMoney(
  value: MoneyValue,
): string {
  const numericValue =
    toNumber(value);

  const absoluteValue =
    Math.abs(numericValue);

  const formattedValue =
    new Intl.NumberFormat(
      "en-GH",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    ).format(absoluteValue);

  if (numericValue < 0) {
    return `(${formattedValue})`;
  }

  return formattedValue;
}

export function formatStatementDate(
  value: string,
): string {
  const parsedDate =
    new Date(
      `${value}T00:00:00`,
    );

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GH",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(parsedDate);
}

export function formatPeriod(
  periodStart: string,
  periodEnd: string,
): string {
  return [
    "For the period from",
    formatStatementDate(
      periodStart,
    ),
    "to",
    formatStatementDate(
      periodEnd,
    ),
  ].join(" ");
}