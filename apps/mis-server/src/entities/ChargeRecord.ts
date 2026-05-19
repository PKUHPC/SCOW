import { Entity, Index, PrimaryKey, Property } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { Account } from "src/entities/Account";
import { Tenant } from "src/entities/Tenant";
import { DecimalType } from "src/utils/decimal";
import { type AnyJson } from "src/utils/types";

@Entity()
@Index({ name: "static_info", properties: ["time", "accountName", "amount"] })
@Index({ name: "idx_acc_time_type_amt", properties: ["accountName", "time", "type", "amount"] })
@Index({ name: "idx_type_time_acc_amt", properties: ["type", "time", "accountName", "amount"] })
@Index({ name: "idx_user_time_type_amt", properties: ["userId", "time", "type", "amount"] })
@Index({ name: "idx_tenant_time_acc_amt", properties: ["tenantName", "time", "accountName", "amount"] })
export class ChargeRecord {
  @PrimaryKey()
  id!: number;

  @Index({ name: "time" })
  @Property()
  time: Date;

  @Index()
  @Property()
  tenantName: string;

  @Index()
  @Property({ nullable: true })
  accountName?: string;

  @Index()
  @Property({ nullable: true })
  userId?: string;

  @Index()
  @Property()
  type: string;

  @Property({ type: DecimalType })
  amount: Decimal = new Decimal(0);

  @Property()
  comment: string;

  @Property({ type: "json", nullable: true })
  metadata?: AnyJson;

  constructor(init: {
    id?: number;
    time: Date;
    type: string;
    target: Tenant | Account;
    userId?: string;
    comment: string;
    amount: Decimal;
    metadata?: AnyJson;
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
    this.userId = init.userId;
    this.comment = init.comment;
    this.amount = init.amount;
    this.metadata = init.metadata;
  }
}
