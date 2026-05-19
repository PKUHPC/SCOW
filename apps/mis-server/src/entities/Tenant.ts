import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { DECIMAL_DEFAULT_RAW, DecimalType } from "src/utils/decimal";
import { CURRENT_TIMESTAMP, DATETIME_TYPE } from "src/utils/orm";

@Entity()
export class Tenant {
  @PrimaryKey()
  id!: number;

  @Property({ unique: true })
  name: string;

  @Property({ type: DecimalType, defaultRaw: DECIMAL_DEFAULT_RAW })
  balance: Decimal = new Decimal(0);

  @Property({ type: DecimalType, defaultRaw: DECIMAL_DEFAULT_RAW })
  defaultAccountBlockThreshold: Decimal = new Decimal(0);

  @Property({ columnType: DATETIME_TYPE, defaultRaw: CURRENT_TIMESTAMP })
  createTime: Date;

  constructor(init: { name: string; createTime?: Date }) {
    this.name = init.name;
    this.createTime = init.createTime ?? new Date();
  }
}
