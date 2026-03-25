// 将 hex 颜色转为 rgba（用于生成渐变）
export function hexToRgba(hex: string, alpha: number) {
  const parsed = hex.replace("#", "");
  const bigint = parseInt(parsed, 16);

  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
