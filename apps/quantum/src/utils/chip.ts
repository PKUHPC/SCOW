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

export const mapDeviceStateToDisplayState = (
  deviceState: DeviceStateString | undefined,
): DisplayedDeviceState | undefined => {
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
export const swapQubitData = <T extends { Q: number | number[] }>(data: T[], swapList: [number, number][]): T[] => {
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

  let minX = Infinity,
    minY = Infinity;
  for (const [q, x, y] of layout.qxy as [number, number, number][]) {
    map[q] = { x, y };
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  // 归一化坐标到零基
  Object.values(map).forEach((p) => {
    p.x -= minX;
    p.y -= minY;
  });

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

export type NewLayoutMap = Record<string, { x: number; y: number }>;

/**
 * 将坐标图围绕其几何中心顺时针旋转指定角度（45度倍数），
 * 如果角度是 45度的奇数倍 (如 45, 135, 225, 315)，则将相对坐标乘以 sqrt(2)。
 * 最终，整个布局将被平移，确保最小的 x 和 y 坐标为 0 (归一化)。
 *
 * @param coords 原始坐标图 (LayoutMap)
 * @param degrees 逆时针旋转的角度 (45, 90, 135...)
 * @returns 旋转、可能缩放、并归一化后的新坐标图 (LayoutMap)，坐标为精确浮点数
 */
export const rotateLayoutAndScaleIfOdd45 = (coords: NewLayoutMap, degrees: number): NewLayoutMap => {
  const points = Object.values(coords);
  if (points.length === 0) return {};

  // 1. 计算几何中心 (Centroid)
  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  const centerX = sumX / points.length;
  const centerY = sumY / points.length;

  // 2. 检查是否为 45度的奇数倍，确定缩放因子
  const normalizedDegrees = degrees % 360;
  const factor = normalizedDegrees / 45;
  const isOddMultipleOf45 = Math.round(factor) % 2 !== 0 && Math.round(factor) !== 0;
  const scaleFactor = isOddMultipleOf45 ? Math.sqrt(2) : 1;

  // 3. 计算旋转所需的角度 (弧度)
  const angleRadians = normalizedDegrees * (Math.PI / 180);
  const cosTheta = Math.cos(angleRadians);
  const sinTheta = Math.sin(angleRadians);

  const rotatedCoords: NewLayoutMap = {}; // 用于存储旋转和缩放后的临时坐标
  let minX = Infinity;
  let minY = Infinity;

  // 4. 遍历、旋转和缩放每个点
  for (const [key, point] of Object.entries(coords)) {
    // 4.1. 平移到中心 (Tx, Ty)
    const translatedX = point.x - centerX;
    const translatedY = point.y - centerY;

    // 4.2. 旋转
    const rotatedX = translatedX * cosTheta + translatedY * sinTheta;
    const rotatedY = translatedX * -sinTheta + translatedY * cosTheta;

    // 4.3. 平移回中心
    let newX = rotatedX + centerX;
    let newY = rotatedY + centerY;

    // 5. 应用缩放因子 (相对于中心点)
    if (scaleFactor !== 1) {
      const xToScale = newX - centerX;
      const yToScale = newY - centerY;

      newX = xToScale * scaleFactor + centerX;
      newY = yToScale * scaleFactor + centerY;
    }

    // 6. 记录旋转后的临时坐标，并查找新的最小 x 和 y
    rotatedCoords[key] = { x: newX, y: newY };

    if (newX < minX) minX = newX;
    if (newY < minY) minY = newY;
  }

  // 7. 【新的归一化步骤】平移整个布局，使最小的 x 和 y 坐标为 0
  const offsetX = minX; // 需要减去的量
  const offsetY = minY;

  const finalCoords: NewLayoutMap = {};

  for (const [key, point] of Object.entries(rotatedCoords)) {
    finalCoords[key] = {
      x: Math.round(point.x - offsetX),
      y: Math.round(point.y - offsetY),
    };
  }

  return finalCoords;
};
