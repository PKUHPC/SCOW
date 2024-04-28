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

export function range(start = 1, end = 0, step = 1): number[] {
  const r = [] as number[];
  for (let i = start; i < end; i += step) {
    r.push(i);
  }
  return r;
}

type ObjectTypeWithType = {
  type: string;
  [key: string]: any;
};

export function extractTypesFromObjects(array: ObjectTypeWithType[]): string[] {
  const types = new Set<string>();
  for (const item of array) {
    if (item.type) {
      types.add(item.type);
    }
  }
  return types.size > 0 ? Array.from(types) : [];
}

