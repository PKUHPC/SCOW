import { queryToArray, queryToString } from "@scow/lib-web/build/utils/querystring";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Result } from "antd";
import { GetServerSideProps, NextPage } from "next";
import { useRouter } from "next/router";
import { useStore } from "simstate";
import { api } from "src/apis";
import { USE_MOCK } from "src/apis/useMock";
import { getTokenFromCookie } from "src/auth/cookie";
import { requireAuth } from "src/auth/requireAuth";
import { AuthResultError, ssrAuthenticate } from "src/auth/server";
import { UnifiedErrorPage } from "src/components/errorPages/UnifiedErrorPage";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { FileManager } from "src/pageComponents/filemanager/FileManager";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Head } from "src/utils/head";

type Props =
  | {
      error: AuthResultError;
    }
  | {
      scowdEnabledClusters: string[];
    };

export const FileManagerPage: NextPage<Props> = requireAuth(() => true)((props: Props) => {
  if ("error" in props) {
    return <UnifiedErrorPage code={props.error} />;
  }

  const languageId = useI18n().currentLanguage.id;

  const router = useRouter();
  const pathParts = queryToArray(router.query.path);

  const cluster = queryToString(router.query.cluster);

  const t = useI18nTranslateToString();

  const { currentClusters } = useStore(ClusterInfoStore);

  const clusterObj = currentClusters.find((x) => x.id === cluster);

  const fullPath = "/" + (pathParts?.join("/") ?? "");

  if (!clusterObj) {
    return <Result status="404" title={"404"} subTitle={t("pages.files.path.title")} />;
  }

  return (
    <>
      <Head title={`${getI18nConfigCurrentText(clusterObj.name, languageId)}${t("pages.files.path.title")}`} />
      <FileManager
        initialCluster={clusterObj}
        path={fullPath}
        urlPrefix="/files"
        scowdEnabledClusters={props.scowdEnabledClusters}
      />
    </>
  );
});

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
  const auth = ssrAuthenticate(() => true);

  const info = await auth(req);
  if (typeof info === "number") {
    return { props: { error: info } };
  }

  // Cannot directly call api routes here, so mock is not available directly.
  // manually call mock
  if (USE_MOCK) {
    return {
      props: {
        scowdEnabledClusters: ["hpc01"],
      },
    };
  }

  const token = getTokenFromCookie({ req });
  const resp = await api.getClusterConfigFiles({ query: { token } });

  const scowdEnabledClusters: string[] = Object.entries(resp.clusterConfigs)
    .filter(([_, config]) => !!config.scowd?.enabled)
    .map(([cluster, _]) => cluster);

  return {
    props: {
      scowdEnabledClusters,
    },
  };
};

export default FileManagerPage;
