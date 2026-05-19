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

export const layoutConstants = {
  paddingBreakpoint: "md" as Breakpoint,
  menuBreakpoint: "md" as Breakpoint,
  headerHeight: 56,
  sidebarBreakpoint: "lg" as Breakpoint,
  headerIconColor: "#ffffff",
  headerIconBackgroundColor: "#1890FF",
  headerBackgrounColor: "#001529",
  maxWidth: 1200,
};
