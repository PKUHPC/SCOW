export function max(op1: number, op2: number) {
  return op1 > op2 ? op1 : op2;
}
export function min(op1: number, op2: number) {
  return op1 < op2 ? op1 : op2;
}

export function compareNumber(a: number, b: number): -1 | 0 | 1 {
  if (a === b) {
    return 0;
  }
  if (a < b) {
    return -1;
  }
  return 1;
}
