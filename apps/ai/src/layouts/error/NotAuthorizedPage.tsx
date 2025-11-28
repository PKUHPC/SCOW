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

import { Button, Result } from "antd";
import Link from "next/link";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";


export const NotAuthorizedPage = () => {
  const t = useI18nTranslateToString();
  const p = prefix("layout.error.notAuthorizedPage.");

  useDocumentTitle(t(p("needLogin")));

  return (
    <>
      <Result
        status="403"
        title={t(p("needLogin"))}
        subTitle={t(p("subTitle"))}
        extra={(
          <Link href={"/api/auth"}>
            <Button type="primary">
              {t(p("login"))}
            </Button>
          </Link>
        )}
      />
    </>
  );
};
