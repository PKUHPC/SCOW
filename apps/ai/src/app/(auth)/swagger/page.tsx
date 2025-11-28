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

"use client";

import "swagger-ui-react/swagger-ui.css";

import dynamic from "next/dynamic";
import { join } from "path";
import { useDocumentTitle } from "src/utils/head";

import { usePublicConfig } from "../context";
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function Page() {

  const { publicConfig: { BASE_PATH } } = usePublicConfig();

  useDocumentTitle("SCOW AI API");

  return (
    <>
      <SwaggerUI url={join(BASE_PATH, "/api/openapi.json")} />
    </>
  );
}
