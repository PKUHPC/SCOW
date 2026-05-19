import type { Money } from "@scow/protos/build/common/money";

import { moneyToNumber } from "@scow/lib-decimal";

import { publicConfig } from "./config";

export function moneyToString(money: Money) {
  return moneyToNumber(money).toFixed(publicConfig.JOB_CHARGE_DECIMAL_PRECISION);
}

export function nullableMoneyToString(money: Money | undefined) {
  return money ? moneyToString(money) : Number.prototype.toFixed.call(0, publicConfig.JOB_CHARGE_DECIMAL_PRECISION);
}

export function moneyNumberToString(number: number): string {
  return number.toFixed(publicConfig.JOB_CHARGE_DECIMAL_PRECISION);
}
