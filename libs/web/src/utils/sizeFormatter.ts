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

export function formatBytesToGBString(bytes: number | bigint, fractionDigits = 2): string {
  const gb = 1024n ** 3n;
  const scale = 10n ** BigInt(fractionDigits);
  const bytesBigInt = typeof bytes === "bigint" ? bytes : BigInt(bytes);
  let integer = bytesBigInt / gb;
  let fraction = ((bytesBigInt % gb) * scale + gb / 2n) / gb;

  if (fraction >= scale) {
    integer += 1n;
    fraction -= scale;
  }

  return `${integer}.${fraction.toString().padStart(fractionDigits, "0")}`;
}

// gb 考虑只保留两位小时
export function formatGBToBytes(gb: number): number {
  // 1 GB = 1024^3 bytes (二进制标准)
  return gb * 1024 * 1024 * 1024;
}

export function formatMBToGB(mb: number): number {
  return mb / 1024;
}

export function formatMBToGBString(mb: number, fractionDigits = 2): string {
  return formatMBToGB(mb).toFixed(fractionDigits);
}

export function formatGBToMB(gb: number): number {
  return gb * 1024;
}

export function formatMBToString(mb: number): string {
  if (mb === 0) return "0 MB";
  const k = 1024;
  const sizes = ["MB", "GB", "TB", "PB", "EB"];
  const i = Math.floor(Math.log(mb) / Math.log(k));
  const unitIndex = Math.min(i, sizes.length - 1);
  const formattedValue = (mb / Math.pow(k, unitIndex)).toFixed(2);
  return `${formattedValue} ${sizes[unitIndex]}`;
}
