import { BigNumber as Decimal } from "bignumber.js";

export const CALCULATION_PRECISION = 20;

Decimal.set({ DECIMAL_PLACES: CALCULATION_PRECISION });

export { Decimal };

export * from "./convertion";
