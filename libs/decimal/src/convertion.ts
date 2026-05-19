import { Decimal } from "./index";

interface Money {
  positive: boolean;
  yuan: number;
  decimalPlace: number;
}

const DECIMAL_PLACE = 10000;

export const moneyToNumber = (money: Money) => {
  const num = money.yuan + money.decimalPlace / DECIMAL_PLACE;
  return money.positive ? num : -num;
};

export const numberToMoney = (num: number): Money => decimalToMoney(new Decimal(num));

export const decimalToMoney = (dec: Decimal): Money => {
  const abs = dec.abs();

  return {
    positive: dec.gte(0),
    yuan: abs.integerValue(Decimal.ROUND_FLOOR).toNumber(),
    decimalPlace: abs.multipliedBy(DECIMAL_PLACE).mod(DECIMAL_PLACE).integerValue(Decimal.ROUND_FLOOR).toNumber(),
  };
};
