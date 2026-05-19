import Link from "next/link";
import React, { useCallback } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { Section } from "src/components/Section";
import { Localized, useI18nTranslateToString } from "src/i18n";
import { RunningJobInfo } from "src/models/job";
import { RunningJobInfoTable } from "src/pageComponents/job/RunningJobTable";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { User } from "src/stores/UserStore";

interface Props {
  user: User;
}

export const JobsSection: React.FC<Props> = ({ user }) => {
  const { clusterSortedIdList, activatedClusters } = useStore(ClusterInfoStore);

  const promiseFn = useCallback(() => {
    return Promise.all(
      clusterSortedIdList
        .filter((clusterId) => Object.keys(activatedClusters).find((x) => x === clusterId))
        .map(async (clusterId) => {
          const { id, name } = activatedClusters[clusterId];

          return api
            .getRunningJobs({
              query: {
                cluster: id,
                userId: user.identityId,
              },
            })
            .then(({ results }) => results.map((x) => RunningJobInfo.fromGrpc(x, { id, name })))
            .catch(() => [] as RunningJobInfo[]);
        }, []),
    ).then((x) => x.flat());
  }, [user.identityId]);

  const { data, isLoading, reload } = useAsync({ promiseFn });

  const t = useI18nTranslateToString();

  return (
    <Section
      title={t("dashboard.job.title")}
      extra={
        <Link href="/user/runningJobs">
          <Localized id="dashboard.job.extra"></Localized>
        </Link>
      }
    >
      <RunningJobInfoTable
        data={data}
        reload={reload}
        isLoading={isLoading}
        showAccount={true}
        showUser={false}
        showCluster={true}
      />
    </Section>
  );
};
