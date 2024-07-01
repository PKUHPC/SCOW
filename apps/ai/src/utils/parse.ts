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

import { NextApiRequest } from "next";
import { NextRequest } from "next/server";

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
  }, {} as Record<string, string>);
}

/**
 * Replace {{ a }} to valueObj[a]. If valueObj[a] is undefined, replace with ""
 * @param str the original string
 * @param valueObj the object containing keys and values
 * @returns replaced string
 */
export function parsePlaceholder(str: string, valueObj: Record<string, string>) {
  return str.replace(/\{\{\ ([a-zA-Z0-9_]+)\ \}\}/g, (_, p1: string) => valueObj[p1] ?? "");
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

export const parseIp = (req: NextApiRequest | NextRequest): string | undefined => {

  let forwardedFor: string | string[] | undefined | null = undefined;

  if ("headers" in req && typeof req.headers.get === "function") {
    // NextRequest
    forwardedFor = req.headers.get("X-Forwarded-For");
  } else if ("headers" in req && "x-forwarded-for" in req.headers) {
    // NextApiRequest
    forwardedFor = req.headers["x-forwarded-for"];
  }

  if (Array.isArray(forwardedFor)) {
    forwardedFor = forwardedFor.shift();
  }

  if (typeof forwardedFor === "string") {
    forwardedFor = forwardedFor.split(",").shift();
  }

  // 处理 NextRequest 类型没有 socket 属性的情况
  if (!("socket" in req)) {
    return forwardedFor ?? undefined;
  }

  return forwardedFor ?? req.socket?.remoteAddress;
};

export const parseBooleanParam = (bool: boolean): "true" | "false" => {
  return bool ? "true" : "false";
};
