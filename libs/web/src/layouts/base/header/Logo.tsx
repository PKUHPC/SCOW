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
