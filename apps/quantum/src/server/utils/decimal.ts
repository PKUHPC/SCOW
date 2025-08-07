import { Type } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";

/**
 * This type saves datetime value in mysql with ms precision
 * aligning the value in DB with the value in JS.
 */

const dbPrecision = 4;
const DECIMAL_COLUMN_TYPE = `DECIMAL(19,${dbPrecision})`;
export const DECIMAL_DEFAULT_RAW = `0.${"0".repeat(dbPrecision)}`;

export class DecimalType extends Type<Decimal | undefined, string | undefined> {
  convertToDatabaseValue(value: Decimal | string | undefined): string | undefined {
    if (!value) { return value; }
    return value.toString();
  }

  convertToJSValue(value: string | undefined): Decimal | undefined {
    if (!value) { return undefined; }
    return new Decimal(value);
  }

  getColumnType(): string {
    return DECIMAL_COLUMN_TYPE;
  }

  compareAsType(): string {
    return "number";
  }

}
