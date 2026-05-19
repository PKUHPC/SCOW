import { Type } from "@sinclair/typebox";
import { validateObject } from "src/validation";

const Schema = Type.Object({
  propertyA: Type.Number(),
});

it.each([
  [{ propertyA: 1 }, true],
  [{ propertyA: 1, propertyB: 2 }, true],
  [{ propertyA: "1" }, false],
  [{ propertyB: 2 }, false],
])("returns correct validation result", (data, expected) => {
  const result = validateObject(Schema, data);

  if (expected) {
    expect(result).toEqual(data);
  } else {
    expect(result).toBeInstanceOf(Error);
  }
});
