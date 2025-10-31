import { MinusOutlined, PlusCircleOutlined } from "@ant-design/icons";
import {
  closestCenter, DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  MouseSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext } from "@dnd-kit/sortable";
import { I18nStringType } from "@scow/config/build/i18n";
import { message } from "antd";
import { join } from "path";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { Cluster } from "src/utils/cluster";
import { formatEntryId, getEntryBaseName,
  getEntryExtraInfo, getEntryIcon,
  getEntryLogoPath } from "src/utils/dashboard";
import { getCurrentLangLibWebText } from "src/utils/libWebI18n/libI18n";
import { styled } from "styled-components";

import { AppWithCluster, Entry } from ".";
import { AddEntryModal } from "./AddEntryModal";
import { EntryCardItem } from "./CardItem";
import { ClusterNotAvailablePage } from "./ClusterNotAvailablePage";
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
  quickEntryType?: "ai" | "portal";
  languageId: string,
  iconMap: Record<string, React.ReactElement>;
  entryItems: {
    defaultEntries: Entry[];
    staticEntries: Entry[];
  }
  publicPath: string,
  loginNodes?: Record<string, { name: I18nStringType, address: string }[]>;
  onSaveQuickEntries: (newItems: Entry[]) => void
}

type itemEntry = Entry & {
  originalId?: string;
};

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
  isEditable, isFinished, quickEntryArray, apps, currentClusters, publicConfigClusters, quickEntryType,
  languageId, publicPath, iconMap, loginNodes, entryItems, onSaveQuickEntries }) => {
  // 实际的快捷入口项
  const [items, setItems] = useState<itemEntry []>(quickEntryArray);
  // 编辑时临时的快捷入口项
  // 处理id使其唯一，因为不同集群可以有相同的应用
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
    if (temItems.length === 1) {
      message.error(getCurrentLangLibWebText(languageId, "cannotBeEmpty"));
      return;
    }
    setTemItems(temItems.filter((x) => x.id !== id));
  };

  const addItem = (item: itemEntry) => {
    item = { ...item, originalId: item.id, id:formatEntryId(item) };
    if (temItems.find((x) => x.id === item.id)) {
      message.error(getCurrentLangLibWebText(languageId, "alreadyExist"));
      return;
    }

    if (temItems.length >= 10) {
      message.error(getCurrentLangLibWebText(languageId, "exceedMaxSize"));
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
            if (quickEntryType === "ai") {
              window.open(join("jobs", savedAppClusterId, "/createApps", item.entry.app.appId), "_blank");
            } else {
              window.open(join("/apps", savedAppClusterId, "/create", item.entry.app.appId), "_blank");
            }
            if (!currentClusters.some((x) => x.id === savedAppClusterId)) {
              return <ClusterNotAvailablePage />;
            }
            break;
          }

          case "clusterPageLink": {
            const savedAppClusterId = item.entry.clusterPageLink.clusterId;
            const path = item.entry.clusterPageLink.path;
            window.open(path.replace(/\/clusterId\//, `/${savedAppClusterId}/`), "_blank");
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

  useEffect(() => {
    if (isFinished) {
      const newItems = [...(temItems.map((x) => ({ ...x, id: x.originalId || "" })))];
      setItems(newItems);
      onSaveQuickEntries(newItems);
    }
  }, [isFinished]);

  useEffect(() => {
    // 处理id使其唯一，因为不同集群可以有相同的交互式应用
    setTemItems([...(items.map((x) => ({ ...x, originalId: x.id, id:formatEntryId(x) })))]);
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
                  entryBaseName={getEntryBaseName(x, languageId)}
                  entryExtraInfo={getEntryExtraInfo(x, languageId, publicConfigClusters)}
                  publicPath={publicPath}
                  draggable={isEditable}
                  iconMap={iconMap}
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
              entryBaseName={getEntryBaseName(activeItem, languageId)}
              entryExtraInfo={getEntryExtraInfo(activeItem, languageId, publicConfigClusters)}
              publicPath={publicPath}
              draggable={isEditable}
              iconMap={iconMap}
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
        languageId={languageId}
        publicPath={publicPath}
        loginNodes={loginNodes}
        iconMap={iconMap}
        entryItems={entryItems}
      ></AddEntryModal>
    </div>
  );
};

