import { NextPage } from "next";
import { useStore } from "simstate";
import { Redirect } from "src/components/Redirect";
import { UserStore } from "src/stores/UserStore";

export const IndexPage: NextPage = () => {
  const userStore = useStore(UserStore);

  if (userStore.user) {
    if (
      userStore.user.platformRoles.length === 0 &&
      userStore.user.tenantRoles.length === 0 &&
      userStore.user.accountAffiliations.length === 0
    ) {
      return <Redirect url="/noAccount" />;
    } else {
      return <Redirect url="/dashboard" />;
    }
  } else {
    return <Redirect url="/api/auth" />;
  }
};

export default IndexPage;
