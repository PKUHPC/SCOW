import { EMPTY_STRING } from "src/models/common";
import { BaseDeviceErr, DeviceStateString, DisplayedDeviceState } from "src/models/device";
import { DeviceDetailInfo } from "src/models/device";
import { LayoutMap } from "src/models/device";

export function getGateFidelities(Err: BaseDeviceErr) {
  const sqFidelity = Err.SQ ? `${((1 - Err.SQ) * 100).toFixed(2)}%` : "-";
  const czFidelity = Err.CZ ? `${((1 - Err.CZ) * 100).toFixed(2)}%` : "-";

  return [sqFidelity, czFidelity];
}

export function getReadoutFidelity(Err: BaseDeviceErr) {
  if (!Err.Readout) return undefined;

  const { F0, F1 } = Err.Readout;

  const F0String = `${((1 - F0) * 100).toFixed(2)}%`;
  const F1String = `${((1 - F1) * 100).toFixed(2)}%`;

  return [F0String, F1String];
}

export const mapDeviceStateToDisplayState = (deviceState: DeviceStateString | undefined):
  DisplayedDeviceState | undefined => {
  switch (deviceState) {
    case "on":
      return DisplayedDeviceState.DISPLAYED_ONLINE;
    case "off":
      return DisplayedDeviceState.DISPLAYED_OFFLINE;
    case "maintenance":
      return DisplayedDeviceState.DISPLAYED_MAINTENANCE;
    default:
      return undefined;
  }
};

export const calculateAverage = (arr: number[], precision?: number) => {
  if (!arr || arr.length === 0) {
    return EMPTY_STRING;
  }
  const sum = arr.reduce((acc, current) => acc + current, 0);

  return precision ? (sum / arr.length).toFixed(precision) : sum / arr.length;
};

// 交换布局图中量子比特坐标的工具函数
const swapLayoutMap = (map: LayoutMap, swapList: [number, number][]): void => {
  for (const [q1, q2] of swapList) {
    const pos1 = map[q1];
    const pos2 = map[q2];

    // 确保两个量子比特都在 map 中，否则不进行交换
    if (pos1 && pos2) {
      map[q1] = pos2;
      map[q2] = pos1;
    }
  }
};

// 根据 swap 规则交换量子比特编号
export const swapQubitData = <T extends { Q: number | number[] }>(
  data: T[],
  swapList: [number, number][],
): T[] => {
  if (!swapList || swapList.length === 0) {
    return data;
  }

  const swapMap = new Map<number, number>();
  for (const [q1, q2] of swapList) {
    swapMap.set(q1, q2);
    swapMap.set(q2, q1);
  }

  return data.map((item) => {
    const newItem = { ...item };
    if (Array.isArray(newItem.Q)) {
      newItem.Q = newItem.Q.map((q) => swapMap.get(q) ?? q);
    } else {
      newItem.Q = swapMap.get(newItem.Q) ?? newItem.Q;
    }
    return newItem;
  });
};

// 从 device.layout.qxy 生成 { qubit -> 坐标 }，并把坐标平移到从 0 开始
export const getLayoutMap = (layout?: DeviceDetailInfo["layout"]): LayoutMap => {
  const map: LayoutMap = {};
  if (!layout?.qxy) return map;

  let minX = Infinity, minY = Infinity;
  for (const [q, x, y] of layout.qxy as [number, number, number][]) {
    map[q] = { x, y };
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  // 归一化坐标到零基
  Object.values(map).forEach((p) => { p.x -= minX; p.y -= minY; });

  if (layout.swap && layout.swap.length > 0) {
    swapLayoutMap(map, layout.swap as [number, number][]);
  }

  return map;
};

export const contrastText = (hex: string): string => {
  if (!hex.startsWith("#")) return "#111827";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (299 * r + 587 * g + 114 * b) / 1000;
  return yiq >= 128 ? "#111827" : "#FFFFFF";
};
