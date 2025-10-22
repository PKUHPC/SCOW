import { I18nStringType } from "@scow/config/build/i18n";
import { Button, Modal } from "antd";
import React, { useMemo, useState } from "react";
import { Cluster } from "src/utils/cluster";
import { getEntryBaseName, getEntryIcon } from "src/utils/dashboard";
import { getCurrentLangLibWebText } from "src/utils/libWebI18n/libI18n";
import { styled, useTheme } from "styled-components";

import { AppWithCluster, Entry } from ".";
import Bullet from "./Bullet";
import { EntryItem } from "./EntryItem";
import { SelectClusterModal } from "./SelectClusterModal";

export enum EntryCase {
  shell,
  app,
  clusterPageLink,
}
export interface IncompleteEntryInfo {
  id: string;
  name: string;
  case: EntryCase;
  path?: string;
  icon?: string;
}
export interface Props {
  open: boolean;
  onClose: () => void;
  addItem: (item: Entry) => void;
  apps: AppWithCluster;
  clusters: Cluster[];
  languageId: string;
  iconMap: Record<string, React.ReactElement>;
  entryItems: {
    defaultEntries: Entry[];
    staticEntries: Entry[];
  }
  publicPath: string,
  loginNodes?: Record<string, { name: I18nStringType, address: string }[]>;
}

const ItemsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  max-height: 650px; /* 设置最大高度 */
  overflow: auto; /* 启用滚动条 */
  padding: 14px;
`;

const ItemContainer = styled.div`
  cursor: pointer;
  height: 170px;
  flex: 1 1 200px;
  max-width: 165px;
  padding-bottom: 12px;
  box-shadow: 0px 2px 10px 0px #1C01011A;
  background-color: ${(p) => p.theme.token.colorBgBlur};
`;

export const AddEntryModal: React.FC<Props> = ({
  open,
  onClose,
  addItem,
  apps,
  clusters,
  languageId,
  iconMap,
  loginNodes,
  entryItems,
  publicPath,
}) => {
  const [selectClusterOpen, setSelectClusterOpen] = useState(false);
  const [needLoginNode, setNeedLoginNode] = useState(false);
  // 可以创建该App的集群
  const [clustersToSelectedApp, setClustersToSelectedApp] = useState<Cluster[]>([]);
  // 新建快捷方式的部分信息
  const [incompleteEntryInfo, setIncompleteEntryInfo] = useState<IncompleteEntryInfo | null>(null);

  const collectionEntry: Entry[] = [...entryItems.defaultEntries, ...entryItems.staticEntries ];

  // 所有可创建的app
  const appInfo = useMemo(() => {
    const displayApp: IncompleteEntryInfo[] = [];

    if (apps) {
      for (const key in apps) {
        const x = apps[key];
        displayApp.push({
          id:x.app.id,
          name:x.app.name,
          case:EntryCase.app,
        });
      }
    }

    return displayApp;
  }, [apps]);

  const handleClick = (item: Entry | IncompleteEntryInfo) => {
    if ((item as Entry).entry?.$case === "shell") {
      setNeedLoginNode(true);
      setClustersToSelectedApp(clusters);
      setSelectClusterOpen(true);
      setIncompleteEntryInfo({
        id:item.id,
        name:item.name,
        case:EntryCase.shell,
      },
      );
    }
    else if ((item as IncompleteEntryInfo).case === EntryCase.app) {
      setNeedLoginNode(false);
      setClustersToSelectedApp(apps[item.id].clusters);
      setSelectClusterOpen(true);
      setIncompleteEntryInfo({
        id:item.id,
        name:item.name,
        case:EntryCase.app,
      },
      );
    }
    else if ("entry" in item && item.entry?.$case === "clusterPageLink") {
      setNeedLoginNode(false);
      setClustersToSelectedApp(clusters);
      setSelectClusterOpen(true);
      setIncompleteEntryInfo({
        id:item.id,
        name:item.name,
        case:EntryCase.clusterPageLink,
        path:item?.entry.clusterPageLink.path,
        icon:item?.entry.clusterPageLink.icon,
      },
      );
    }
    else {
      addItem(item);
      onClose();
    }
  };

  const theme = useTheme();

  return (
    <>
      <Modal
        title={(
          <>
            <Bullet style={{
              width: "0.8em", /* 与字体大小相对应 */
              height:" 0.8em", /* 与字体大小相对应 */
              backgroundColor:theme.token.colorPrimary, /* 与主题颜色相对应*/
              marginRight:"1em",
            }}
            />
            <span>{getCurrentLangLibWebText(languageId, "addQuickEntry")}</span>
          </>
        )}
        open={open}
        width={1310}
        closeIcon={null}
        destroyOnClose
        footer={[
          <Button key="back" onClick={onClose}>
            {getCurrentLangLibWebText(languageId, "cancel")}
          </Button>,
        ]}
      >
        <ItemsContainer>
          {
            collectionEntry.map((item, idx) => (
              <ItemContainer key={idx} onClick={() => { handleClick(item); }}>
                <EntryItem
                  entryBaseName={getEntryBaseName(item, languageId)}
                  iconMap={iconMap}
                  icon={getEntryIcon(item)}
                  publicPath={publicPath}
                />
              </ItemContainer>
            ),
            )
          }
          {
            appInfo.map((item, idx) => (
              <ItemContainer
                key={idx}
                onClick={() => { handleClick(item); }}
              >
                <EntryItem
                  entryBaseName={item.name}
                  iconMap={iconMap}
                  logoPath={apps[item.id].app.logoPath}
                  publicPath={publicPath}
                />
              </ItemContainer>
            ),
            )
          }
        </ItemsContainer>
      </Modal>
      <SelectClusterModal
        open={selectClusterOpen}
        onClose={() => { setSelectClusterOpen(false); }}
        needLoginNode={needLoginNode}
        incompleteEntryInfo={incompleteEntryInfo}
        clusters={clustersToSelectedApp}
        addItem={addItem}
        closeAddEntryModal={onClose}
        languageId={languageId}
        loginNodes={loginNodes}
      />
    </>
  );
};


