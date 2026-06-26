import { NextPage } from "next";
import { useStore } from "simstate";
import { Redirect } from "src/components/Redirect";
import { UserStore } from "src/stores/UserStore";

export const IndexPage: NextPage = () => {
  const userStore = useStore(UserStore);

  if (userStore.user) {
    return <Redirect url="/dashboard" />;
  } else {
    return <Redirect url="/api/auth" />;
  }
};

export default IndexPage;
