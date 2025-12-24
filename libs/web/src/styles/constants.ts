export const antdBreakpoints = {
  xxs: 0,
  xs: 480,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
};

export type Breakpoint = keyof typeof antdBreakpoints;

// neutral 灰阶
export const lightGray = [
  "#ffffff",
  "#fafafa",
  "#f5f5f5",
  "#f0f0f0",
  "#d9d9d9",
  "#bfbfbf",
  "#8c8c8c",
  "#595959",
  "#434343",
  "#262626",
];

export const darkGray = [
  "#141414",
  "#1f1f1f",
  "#262626",
  "#303030",
  "#434343",
  "#595959",
  "#8c8c8c",
  "#bfbfbf",
  "#d9d9d9",
  "#ffffff",
];
