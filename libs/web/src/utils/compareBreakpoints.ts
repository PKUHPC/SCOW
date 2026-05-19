const breakpointsSize = {
  xxsmall: 1,
  xsmall: 2,
  small: 3,
  medium: 4,
  large: 5,
  xlarge: 6,
  xxlarge: 7,
};

type Breakpoint = keyof typeof breakpointsSize;

export function compareBreakpoints(bp1: string, bp2: Breakpoint): -1 | 0 | 1 {
  const n1 = breakpointsSize[bp1];
  const n2 = breakpointsSize[bp2];
  return n1 < n2 ? -1 : n1 === n2 ? 0 : 1;
}
