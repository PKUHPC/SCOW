import { Descriptions, Drawer } from "antd";
import { useStore } from "simstate";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AppAuthTargetType } from "src/models/app";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getClusterName } from "src/utils/cluster";

export interface TargetAppsDrawerItem {
  targetName: string;
  clusterId: string;
  availableAppsCount: number;
  availableAppNames: string[];
  targetType: AppAuthTargetType;
  accountOwner?: {
    accountOwnerId: string;
    accountOwnerName: string;
  };
}

interface Props {
  open: boolean;
  item: TargetAppsDrawerItem | undefined;
  onClose: () => void;
}

const p = prefix("pageComp.commonComponent.appAuthorization.appAuthorizationInfoDrawer.");

export const AppAuthInfoDrawer: React.FC<Props> = (props) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { publicConfigClusters } = useStore(ClusterInfoStore);

  const { item, onClose, open } = props;

  const drawerItems = [
    [item?.targetType === AppAuthTargetType.TENANT ? t(p("tenant")) : t(p("account")), "targetName"],
    [
      item?.targetType === AppAuthTargetType.ACCOUNT ? t(p("accountOwner")) : null,
      "accountOwner",
      (v) => `${v.accountOwnerName}（ID: ${v.accountOwnerId}）`,
    ],
    [t(p("cluster")), "clusterId", getClusterName],
    [t(p("authorizedAppsCount")), "availableAppsCount", (v) => v.toString()],
    [t(p("authorizedApps")), "availableAppNames", (v) => v.join(", ")],
  ] as [string, keyof Partial<TargetAppsDrawerItem>, (v: any) => string][];

  return (
    <Drawer width={500} placement="right" onClose={onClose} open={open} title={t(p("title"))}>
      {item ? (
        <Descriptions column={1} bordered size="small">
          {drawerItems
            .map(([label, key, format]) => (
              <Descriptions.Item key={item.targetName} label={label}>
                {format
                  ? key === "clusterId"
                    ? getClusterName(item[key], languageId, publicConfigClusters)
                    : format(item[key])
                  : (item[key] as string)}
              </Descriptions.Item>
            ))
            .filter((x) => x)}
        </Descriptions>
      ) : undefined}
    </Drawer>
  );
};
