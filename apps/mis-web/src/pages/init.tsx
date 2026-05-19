import { NextPage } from "next";
import { SSRProps } from "src/auth/server";
import { Redirect } from "src/components/Redirect";
type Props = SSRProps<{}>;

export const InitSystemPage: NextPage<Props> = () => {
  return <Redirect url="/init/importUsers" />;
};
export default InitSystemPage;
