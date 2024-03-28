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
import { join } from "path";
import { usePublicConfig } from "src/app/(auth)/context";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

const Logo = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
`;

export default function Page() {

  const { publicConfig: { BASE_PATH } } = usePublicConfig();

  return (
    <div>
      <Head title={"dashboard"} />
      {
        <Logo>
          <img
            alt="logo"
            src={join(BASE_PATH, "/api/logo?type=logo")}
            style={{
              objectFit: "contain",
              maxWidth: "50%",
            }}
          />
        </Logo>
      }
    </div>
  );
}

