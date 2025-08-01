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

/**
 * Replace key1=value1,key2=value2 to { key1: value1, key1: value2 }.
 * Keys and values are trimmed. Empty values are preserved.
 *
 * @param input original input
 * @returns dict
 */
export function parseKeyValue(input: string): Record<string, string> {
  return input.split(",").reduce((prev, curr) => {
    const [key, value] = curr.split("=").map((x) => x.trim());
    if (key) {
      prev[key] = value ?? "";
    }
    return prev;
  }, {});
}

/**
 * Replace {{ a }} to valueObj[a]. If valueObj[a] is undefined, replace with ""
 * @param str the original string
 * @param valueObj the object containing keys and values
 * @returns replaced string
 */
export function parsePlaceholder(str: string, valueObj: object, showUndefined: boolean = false) {
  return str.replace(/\{\{ ([a-zA-Z0-9_]+) \}\}/g, (_, p1: string) => valueObj[p1] ?? (showUndefined ? "-" : ""));
}

/**
 * Extract all {{ KEY }} placeholders from a string-object's values
 * @param obj the object with string values
 * @returns a Set of unique placeholder keys
 */
export function extractPlaceholders(obj: Record<string, string>): Set<string> {
  const pattern = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const keys = new Set<string>();

  for (const value of Object.values(obj)) {
    const matches = value.matchAll(pattern);
    for (const match of matches) {
      keys.add(match[1]);
    }
  }

  return keys;
}

/**
 * Replace value1,value2 to [value1, value2]
 * @param str the original string
 * @param valueObj the array
 * @returns replaced string
 */
export function parseArray(str: string): string[] {
  if (str === "") {
    return [];
  }
  return str.split(",");
}

/**
 * Get all unique placeholder keys in a string
 * @param str the original string with placeholder
 * @returns the array of texts in placeholder
 */
export function getPlaceholderKeys(str: string): string[] {

  const matchValues = str.match(/\{\{ ([a-zA-Z0-9_]+) \}\}/g);

  if (matchValues) {
    const texts = matchValues.map(function(val) {
      return val.slice(3, -3);
    });
    return [...new Set(texts)];

  } else {
    return [];
  }
}

