"use client";

import Link from "next/link";
import { join } from "path";
import { useDarkMode } from "src/layouts/darkMode";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

const LogoContainer = styled.h1`
  color: var(--ant-primary-color);
  margin-bottom: 0;
  line-height: 1.1;
  img {
    margin-bottom: 4px;
  }
`;

export const Logo = () => {
  const { dark } = useDarkMode();
  const query = new URLSearchParams({ type: "logo", preferDark: dark ? "true" : "false" }).toString();

  const { data } = trpc.config.publicConfig.useQuery();

  return (
    <LogoContainer>
      <Link href="/">
        {data ? <img src={join(data.BASE_PATH, "/api/logo?" + query.toString())} alt="logo" height={30} /> : undefined}
      </Link>
    </LogoContainer>
  );
};
