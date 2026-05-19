import { Decimal } from "../src";

it("performs correct values", () => {
  const expectEqual = (actual: Decimal, expected: Decimal) => {
    expect(actual.toNumber()).toBe(expected.toNumber());
  };

  const v = (v: number) => new Decimal(v);

  expectEqual(v(0.1).plus(v(0.2)), v(0.3));
  expectEqual(v(100000).minus(v(0.01)), v(99999.99));
  expectEqual(v(0.03).multipliedBy(0.14), v(0.0042));
});
