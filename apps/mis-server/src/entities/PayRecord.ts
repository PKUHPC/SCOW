import { Entity, Index, PrimaryKey, Property } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { Account } from "src/entities/Account";
import { Tenant } from "src/entities/Tenant";
import { DecimalType } from "src/utils/decimal";
import { DATETIME_TYPE } from "src/utils/orm";

@Entity()
@Index({ name: "static_info", properties: ["time", "accountName", "amount"] })
export class PayRecord {
  @PrimaryKey()
  id!: number;

  @Property({ columnType: DATETIME_TYPE })
  time: Date;

  @Property()
  tenantName: string;

  @Property({ nullable: true })
  accountName?: string;

  @Property()
  type: string;

  @Property({ type: DecimalType })
  amount: Decimal = new Decimal(0);

  @Property()
  operatorId: string;

  @Property()
  ipAddress: string;

  @Property()
  comment: string;

  constructor(init: {
    id?: number;
    time: Date;
    type: string;
    target: Tenant | Account;
    operatorId: string;
    comment: string;
    amount: Decimal;
    ipAddress: string;
  }) {
    if (init.id) {
      this.id = init.id;
    }
    this.type = init.type;
    this.time = init.time;
    if (init.target instanceof Tenant) {
      this.tenantName = init.target.name;
    } else {
      this.tenantName = init.target.tenant.getProperty("name");
      this.accountName = init.target.accountName;
    }
    this.operatorId = init.operatorId;
    this.comment = init.comment;
    this.amount = init.amount;
    this.ipAddress = init.ipAddress;
  }
}
