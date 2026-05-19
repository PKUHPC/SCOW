import { Result } from "antd";
import { GetServerSideProps, NextPage } from "next";
import { SSRProps } from "src/auth/server";
import { UnifiedErrorPage } from "src/components/errorPages/UnifiedErrorPage";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { InitAdminForm } from "src/pageComponents/init/InitAdminForm";
import { InitDrawer } from "src/pageComponents/init/InitLayout";
import { queryIfInitialized } from "src/utils/init";

type Props = SSRProps<{}>;

const p = prefix("page.init.");

export const CreateInitAdminPage: NextPage<Props> = (props) => {
  const t = useI18nTranslateToString();
  if ("error" in props) {
    return (
      <UnifiedErrorPage
        code={props.error}
        customComponents={{
          409: <Result status="error" title={t(p("systemInitialized"))} subTitle={t(p("unableReinitialize"))} />,
        }}
      />
    );
  }
  return (
    <div>
      <InitDrawer>
        <InitAdminForm />
      </InitDrawer>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const result = await queryIfInitialized();

  if (result) {
    return { props: { error: 409 } };
  }

  return { props: {} };
};

export default CreateInitAdminPage;
