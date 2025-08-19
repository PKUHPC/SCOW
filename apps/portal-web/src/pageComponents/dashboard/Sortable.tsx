import { MinusOutlined, PlusCircleOutlined } from "@ant-design/icons";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors } from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext } from "@dnd-kit/sortable";
import { Entry } from "@scow/protos/build/portal/dashboard";
import { message } from "antd";
import { join } from "path";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "src/apis";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/utils/cluster";
import { formatEntryId, getEntryBaseName,
  getEntryExtraInfo, getEntryIcon,
  getEntryLogoPath } from "src/utils/dashboard";
import { styled } from "styled-components";

import { AddEntryModal } from "./AddEntryModal";
import { EntryCardItem } from "./CardItem";
import { AppWithCluster } from "./QuickEntry";
import { SortableItem } from "./SortableItem";

const ItemsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px 0;
`;

interface Props {
  isEditable: boolean,
  isFinished: boolean,
  quickEntryArray: Entry[],
  apps: AppWithCluster,
  currentClusters: Cluster[],
  publicConfigClusters: Cluster[],
}
const p = prefix("pageComp.dashboard.sortable.");

const ItemContainer = styled.div`
  position: relative;
  box-shadow: 0px 2px 10px 0px #1C01011A;
  border-radius: 10px;
`;

const DeleteIconContainer = styled.div`
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1000;
  :hover {
    transform: scale(1.2);
  }
`;

export const Sortable: FC<Props> = ({
  isEditable, isFinished, quickEntryArray, apps, currentClusters, publicConfigClusters }) => {

  const t = useI18nTranslateToString();
  const i18n = useI18n();

  // 实际的快捷入口项
  const [items, setItems] = useState<Entry []>(quickEntryArray);
  // 编辑时临时的快捷入口项
  // 处理id使其唯一，因为不同集群可以有相同的交互式应用
  const [temItems, setTemItems] = useState([...(items.map((x) => ({ ...x, id:formatEntryId(x) }),
  ))]);

  const [addEntryOpen, setAddEntryOpen] = useState(false);

  // 被拖拽的快捷方式的id
  const [activeId, setActiveId] = useState<string | number | null>(null);
  const activeItem = useMemo(() => {
    if (activeId) {
      return temItems.find((x) => x.id === activeId.toString());
    }
  }, [activeId]);

  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  const deleteFn = (id: string) => {
    setTemItems(temItems.filter((x) => x.id !== id));
  };

  const addItem = (item: Entry) => {
    item = { ...item, id:formatEntryId(item) };
    if (temItems.find((x) => x.id === item.id)) {
      message.error(t(p("alreadyExist")));
      return;
    }
    if (temItems.length >= 10) {
      message.error(t(p("exceedMaxSize")));
      return;
    }

    setTemItems([...temItems, item]);
  };


  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setTemItems((temItems) => {
        const oldIndex = temItems.findIndex((x) => x.id === active.id.toString());
        const newIndex = temItems.findIndex((x) => x.id === over!.id.toString());

        return arrayMove(temItems, oldIndex, newIndex);
      });
    }

    setActiveId(null);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const onItemClick = useCallback(
    (item: Entry) => {
      if (!isEditable) {
        switch (item.entry?.$case) {

          case "pageLink": {
            window.open(item.entry.pageLink.path, "_blank");
            break;
          }

          case "shell": {
            const savedShellClusterId = item.entry.shell.clusterId;
            window.open(join("/shell", savedShellClusterId, item.entry.shell.loginNode), "_blank");
            if (!currentClusters.some((x) => x.id === savedShellClusterId)) {
              return <ClusterNotAvailablePage />;
            }
            break;
          }

          case "app": {
            const savedAppClusterId = item.entry.app.clusterId;
            window.open(join("/apps", savedAppClusterId, "/create", item.entry.app.appId), "_blank");
            if (!currentClusters.some((x) => x.id === savedAppClusterId)) {
              return <ClusterNotAvailablePage />;
            }
            break;
          }

          default:
            break;
        }
      }
    },
    [isEditable],
  );

  const saveItems = useCallback(
    async (newItems) => {
      await api.saveQuickEntries({ body:{
        quickEntries:newItems,
      } })
        .httpError(200, () => { message.error(t(p("saveFailed"))); })
        .then(() => {
          message.success(t(p("saveSuccessfully")));
        });
    },
    [],
  );

  useEffect(() => {
    if (isFinished) {
      const newItems = [...(temItems.map((x) => ({ ...x, id:x.id.split("-")[0] })))];
      setItems(newItems);
      saveItems(newItems);

    }
  }, [isFinished]);

  useEffect(() => {

    // 处理id使其唯一，因为不同集群可以有相同的交互式应用
    setTemItems([...(items.map((x) => ({ ...x, id:formatEntryId(x) })))]);
  }, [isEditable, items]);

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={temItems} strategy={rectSortingStrategy}>
          <ItemsContainer>
            {temItems.map((x) => (
              <ItemContainer
                key={x.id}
              >
                {(isEditable && activeItem === undefined) ? (
                  <DeleteIconContainer>
                    <MinusOutlined
                      onClick={() => deleteFn(x.id)}
                      size={8}
                    />
                  </DeleteIconContainer>
                ) : undefined}
                <SortableItem
                  id={x.id}
                  key={x.id}
                  entryBaseName={getEntryBaseName(x, t)}
                  entryExtraInfo={getEntryExtraInfo(x, i18n.currentLanguage.id, publicConfigClusters)}
                  draggable={isEditable}
                  icon={getEntryIcon(x)}
                  /** 如果是已授权应用图标直接使用，如果不是判断是否为已保存的快捷方式，是否有保存的可以展示的图标路径 */
                  logoPath={
                    getEntryLogoPath(x, apps) || (x.entry?.$case === "app" ? x.entry.app?.appLogoPath : undefined) }
                  onClick={() => onItemClick(x)}
                />
              </ItemContainer>
            ))}
            {
              isEditable ? (
                <div
                  style={{
                    display: "flex", justifyContent: "center", alignItems: "center",
                    padding: "40px", cursor: "pointer",
                  }}
                  onClick={() => { setAddEntryOpen(true); }}
                >
                  <PlusCircleOutlined style={{ fontSize: "40px" }} />
                </div>
              ) : undefined
            }
          </ItemsContainer>
        </SortableContext>
        <DragOverlay adjustScale style={{ transformOrigin: "0 0" }}>
          {activeId && activeItem ? (
            <EntryCardItem
              isDragging
              id={activeId.toString()}
              entryBaseName={getEntryBaseName(activeItem, t)}
              entryExtraInfo={getEntryExtraInfo(activeItem, i18n.currentLanguage.id, publicConfigClusters)}
              draggable={isEditable}
              icon={getEntryIcon(activeItem)}
              logoPath={getEntryLogoPath(activeItem, apps)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      <AddEntryModal
        open={addEntryOpen}
        onClose={() => { setAddEntryOpen(false); }}
        apps={apps}
        addItem={addItem}
        clusters={currentClusters}
      ></AddEntryModal>
    </div>
  );
};

