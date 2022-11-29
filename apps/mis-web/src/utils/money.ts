/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { moneyToNumber } from "@scow/lib-decimal";
import type { Money } from "src/generated/common/money";

export function moneyToString(money: Money) {
  return moneyToNumber(money).toFixed(3);
}

export function nullableMoneyToString(money: Money | undefined) {
  return money ? moneyToString(money) : Number.prototype.toFixed.call(0, 3);
}
