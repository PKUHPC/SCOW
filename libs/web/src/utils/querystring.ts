import { useRouter } from "next/router";

type QueryValue = string | string[] | null | undefined;

export function queryToString(input: QueryValue): string {
  return Array.isArray(input) ? input[input.length - 1] : (input ?? "");
}

export function queryToIntOrDefault(input: QueryValue, defaultValue: number): number;
export function queryToIntOrDefault(input: QueryValue, defaultValue?: undefined): number | undefined;
export function queryToIntOrDefault(input: QueryValue, defaultValue: number | undefined) {
  const i = queryToString(input);
  const n = Number.parseInt(i);
  return !Number.isNaN(n) && n > 0 ? n : defaultValue;
}

export function queryToArray(input: QueryValue): string[] {
  return Array.isArray(input) ? input : input === null || input === undefined ? [] : [input];
}

export function useQuerystring() {
  const router = useRouter();
  return router.query;
}
