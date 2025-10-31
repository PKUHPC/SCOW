/**
 * 根据颜色格式添加透明度。
 * @param color 颜色字符串 (e.g., "#3470FF", "rgb(52, 112, 255)")
 * @param alpha 透明度值 (0-1)
 * @returns 返回带透明度的颜色字符串
 */
export const getTransparentColor = (color: string, alpha: number): string => {
  // 1. 如果颜色是十六进制格式
  if (color.startsWith("#") && color.length === 7) {
    const hexAlpha = Math.round(alpha * 255).toString(16).padStart(2, "0");
    return `${color}${hexAlpha}`;
  }

  // 2. 如果颜色是rgb格式
  if (color.startsWith("rgb(")) {
    return `rgba(${color.slice(4, -1)}, ${alpha})`;
  }

  // 3. 如果是其他格式（如rgba），直接返回原颜色
  return color;
};
