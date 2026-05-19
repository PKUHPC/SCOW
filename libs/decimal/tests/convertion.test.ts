import { Decimal, decimalToMoney, moneyToNumber, numberToMoney } from "../src";

interface Money {
  positive: boolean;
  yuan: number;
  decimalPlace: number;
}

it("performs correct converions", () => {
  expect(numberToMoney(20.4)).toMatchObject({ positive: true, decimalPlace: 4000, yuan: 20 } as Money);
  expect(moneyToNumber({ decimalPlace: 2010, yuan: 100, positive: true })).toBe(100.201);
  expect(moneyToNumber({ decimalPlace: 30, yuan: 100, positive: false })).toBe(-100.003);
  expect(decimalToMoney(new Decimal(-200.3173))).toMatchObject({
    yuan: 200,
    decimalPlace: 3173,
    positive: false,
  } as Money);
});
