export function extractOneOfValue(
  oneOfValue: { $case: "number"; number: number } | { $case: "text"; text: string },
): string | number {
  switch (oneOfValue.$case) {
    case "text":
      return String(oneOfValue.text);
    case "number":
      return Number(oneOfValue.number);
    default:
      return "";
  }
}
