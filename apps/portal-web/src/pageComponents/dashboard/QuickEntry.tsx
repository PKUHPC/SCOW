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

import { Button, Spin, Typography } from "antd";
import { useCallback, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { EntryType, QuickEntry as QuickEntryinterface } from "src/models/User";
import Sortable from "src/pageComponents/dashboard/Sortable";
import { styled } from "styled-components";

const ContentContainer = styled.div`
  background-color: #fff;
  padding: 20px;
  padding-right: 0;
`;

const TitleContainer = styled.div`
  display: flex;
  justify-content: space-between;
`;

const CardsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
`;

interface Props {

}

export const QuickEntry: React.FC<Props> = () => {
  const staticEntry: QuickEntryinterface[] = [
    {
      id:"submitJob",
      name:"提交作业",
      icon:"PlusCircleOutlined",
      path: "/jobs/submit",
      entryType:EntryType.STATIC,
    },
    {
      id:"runningJob",
      name:"未结束的作业",
      icon:"BookOutlined",
      path: "/jobs/runningJobs",
      entryType:EntryType.STATIC,
    },
    {
      id:"allJobs",
      name:"所有作业",
      icon:"BookOutlined",
      path: "/jobs/allJobs",
      entryType:EntryType.STATIC,
    },
    {
      id:"savedJobs",
      name:"作业模板",
      icon:"SaveOutlined",
      path: "/jobs/savedJobs",
      entryType:EntryType.STATIC,
    },
  ];

  const { data, isLoading } = useAsync({ promiseFn: useCallback(async () => {
    return await api.getQuickEntry({});
  }, []) });

  const { Title } = Typography;

  const [isEditable, setIsEditable] = useState(false);
  const [isFinish, setIsFinish] = useState(false);

  return (
    <ContentContainer>
      <TitleContainer>
        <Title level={5} style={{ marginBottom:0, lineHeight:"32px" }}>快捷入口</Title>
        {isEditable ? (
          <div>
            <Button type="link" onClick={() => { setIsEditable(false); setIsFinish(true); }}>完成</Button>
            <Button type="link" onClick={() => { setIsEditable(false); }}>取消</Button>
          </div>
        ) :
          <Button type="link" onClick={() => { setIsEditable(true); setIsFinish(false); }}>编辑</Button>}
      </TitleContainer>
      <CardsContainer>
        {isLoading ?
          <Spin /> : (
            <Sortable
              isEditable={isEditable}
              isFinish={isFinish}
              quickEntryArray={data?.quickEntry.length ? data?.quickEntry : staticEntry }
            ></Sortable>
          )}
      </CardsContainer>
    </ContentContainer>
  );
};
