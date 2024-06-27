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

import { joinWithUrl } from "@scow/utils";
import { AnyZodObject, z } from "zod";

export interface ExtensionRoute<
  TQuery extends Record<string, string | undefined>,
  TBody,
  TResponses extends Record<number, AnyZodObject>,
> {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  query?: z.ZodSchema<TQuery>;
  body?: z.ZodSchema<TBody>;
  responses: TResponses;
};

export function defineExtensionRoute<
  TQuery extends Record<string, string | undefined>,
  TBody,
  TResponses extends Record<number, AnyZodObject>,
>(route: ExtensionRoute<TQuery, TBody, TResponses>) {
  return route;
}

export class ExtensionRouteError extends Error {
  constructor(public response: Response) {
    super(`Unexpected response status ${response.status}`);
  }

  public get status() {
    return this.response.status;
  }
}


export const callExtensionRoute = async <
  TQuery extends Record<string, string | undefined>,
  TBody,
  TResponses extends Record<number, AnyZodObject>,
>(
  route: ExtensionRoute<TQuery, TBody, TResponses>,
  query: TQuery,
  body: TBody,
  extensionUrl: string,
): Promise<Partial<{ [code in keyof TResponses & number]: z.infer<TResponses[code]> }>> => {

  let url = joinWithUrl(extensionUrl, "api", route.path);

  const search = new URLSearchParams();

  for (const key in query) {
    const value = query[key];
    if (value !== undefined) {
      search.set(key, value);
    }
  }

  if (search.size !== 0) {
    url = url + "?" + search.toString();
  }

  const response = await fetch(url, {
    method: route.method,
    ...route.method !== "GET" ? { body: JSON.stringify(body) } : {},
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (response.status in route.responses) {
    const schema = route.responses[response.status];
    const data = await response.json();
    return { [response.status]: schema.parse(data) };
  }

  throw new ExtensionRouteError(response);
};
