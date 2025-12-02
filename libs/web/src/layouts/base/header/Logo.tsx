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

import Link from "next/link";
import { join } from "path";
import { useDarkMode } from "src/layouts/darkMode";
import { styled } from "styled-components";

const LogoContainer = styled.h1`
  color: var(--ant-primary-color);
  margin-bottom: 0;

  line-height: 1.1;
  img {
    margin-bottom: 4px;
  }
`;

interface Props {
  basePath: string;
}

export const Logo: React.FC<Props> = ({ basePath }) => {

  const { dark } = useDarkMode();

  const query = new URLSearchParams({ type: "logo", preferDark: dark ? "true" : "false" }).toString();

  return (
    <LogoContainer>
      <Link href="/" style={{ display: "inline-flex" }}>
        <img height="30px" alt="logo" src={join(basePath, "/api/logo?" + query.toString())} />
      </Link>
    </LogoContainer>
  );
};
