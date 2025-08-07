/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { Entry } from "@scow/protos/build/portal/dashboard";
import { Button, Modal } from "antd";
import React, { useMemo, useState } from "react";
import { Localized, prefix, useI18nTranslateToString } from "src/i18n";
import { SelectClusterModal } from "src/pageComponents/dashboard/SelectClusterModal";
import { Cluster } from "src/utils/cluster";
import { getEntryBaseName, getEntryIcon } from "src/utils/dashboard";
import { styled, useTheme } from "styled-components";

import Bullet from "./Bullet";
import { EntryItem } from "./EntryItem";
import { AppWithCluster, defaultEntry } from "./QuickEntry";

export enum EntryCase {
  shell,
  app,
}
export interface IncompleteEntryInfo {
  id: string;
  name: string;
  case: EntryCase;
}
export interface Props {
  open: boolean;
  onClose: () => void;
  addItem: (item: Entry) => void;
  apps: AppWithCluster;
  clusters: Cluster[];
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

const p = prefix("pageComp.dashboard.addEntryModal.");

export const AddEntryModal: React.FC<Props> = ({
  open,
  onClose,
  addItem,
  apps,
  clusters,
}) => {
  const t = useI18nTranslateToString();

  const staticEntries: Entry[] = defaultEntry.concat([
    {
      id:"desktop",
      name:"desktop",
      entry:{
        $case:"pageLink",
        pageLink:{
          path: "/desktop",
          icon:"DesktopOutlined",
        },
      },
    },
    {
      id:"shell",
      name:"shell",
      entry:{
        $case:"shell",
        shell:{
          clusterId:"",
          loginNode:"",
          icon:"MacCommandOutlined",
        },
      },
    },
  ]);

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

  const [selectClusterOpen, setSelectClusterOpen] = useState(false);
  const [needLoginNode, setNeedLoginNode] = useState(false);
  // 可以创建该App的集群
  const [clustersToSelectedApp, setClustersToSelectedApp] = useState<Cluster[]>([]);
  // 新建快捷方式的部分信息
  const [incompleteEntryInfo, setIncompleteEntryInfo] = useState<IncompleteEntryInfo | null>(null);

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
            <Localized id={p("addQuickEntry")} />
          </>
        )}
        open={open}
        width={1310}
        closeIcon={null}
        destroyOnClose
        footer={[
          <Button key="back" onClick={onClose}>
            {t(p("cancel"))}
          </Button>,
        ]}
      >
        <ItemsContainer>
          {
            staticEntries.map((item, idx) => (
              <ItemContainer key={idx} onClick={() => { handleClick(item); }}>
                <EntryItem
                  entryBaseName={getEntryBaseName(item, t)}
                  icon={getEntryIcon(item)}
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
                  logoPath={apps[item.id].app.logoPath}
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
      />
    </>
  );
};


