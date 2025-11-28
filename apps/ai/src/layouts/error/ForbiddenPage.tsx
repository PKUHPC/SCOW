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

import { Result } from "antd";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

interface Props {
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
}

export const ForbiddenPage: React.FC<Props> = ({
  title ,subTitle,
}) => {
  const t = useI18nTranslateToString();
  const p = prefix("layout.error.forbiddenPage.");

  useDocumentTitle(t(p("forbidden")));
  return (
    <>
      <Result
        status="403"
        title={title ?? t(p("title"))}
        subTitle={subTitle ?? t(p("subTitle"))}
      />
    </>
  );
};
