export function formatBytesToString(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, sizes.length - 1);

  const formattedValue = (bytes / Math.pow(k, unitIndex)).toFixed(2);
  return `${formattedValue} ${sizes[unitIndex]}`;
}

export function formatBytesToGB(bytes: number): number {
  const GB = 1073741824; // 1GB = 1024^3 bytes
  return bytes / GB;
}

// gb 考虑只保留两位小时
export function formatGBToBytes(gb: number): number {
  // 1 GB = 1024^3 bytes (二进制标准)
  return gb * 1024 * 1024 * 1024;
}
