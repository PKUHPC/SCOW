import { styled } from "styled-components";

export const PercentAndSpeedContainer = styled.div({
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  marginTop: "6px",
  fontSize: "12px",
});

// 格式化速度显示
export const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond <= 0) {
    return "0 B/s";
  }

  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  const k = 1024;

  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  const value = bytesPerSecond / Math.pow(k, i);

  // 根据大小调整小数位数
  const decimals = i === 0 ? 0 : 1;

  return `${value.toFixed(decimals)} ${units[i]}`;
};

// webkitRelativePath 只在 <input webkitdirectory> 选择时由浏览器填充，拖拽时永远是空字符串
// 所以拖拽时通过 webkitGetAsEntry 来区分是文件还是文件夹
type DragItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => { isDirectory?: boolean } | null;
};

export const isDirectoryEntry = (item: DataTransferItem) => {
  const entry = (item as DragItemWithEntry).webkitGetAsEntry?.();
  return entry?.isDirectory ?? false;
};

export const isFileEntry = (item: DataTransferItem) => {
  const entry = (item as DragItemWithEntry).webkitGetAsEntry?.();
  return entry?.isFile ?? false;
};
