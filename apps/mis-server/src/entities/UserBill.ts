import { Entity, ManyToOne, PrimaryKey, Property, type Ref } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { DecimalType } from "src/utils/decimal";
import { DATETIME_TYPE, EntityOrRef, toRef } from "src/utils/orm";
import { type AnyJson } from "src/utils/types";

import { AccountBill, BillType } from "./AccountBill";

@Entity()
export class UserBill {
  @PrimaryKey()
  id!: number;

  @Property({ comment: "所属租户" })
  tenantName: string;

  @Property({ comment: "所属账户" })
  accountName: string;

  @Property({ comment: "用户id" })
  userId: string;

  @Property({ comment: "用户姓名" })
  name: string;

  @Property({ comment: "账期，如202407、2024" })
  term: string;

  @Property({ type: DecimalType })
  amount: Decimal = new Decimal(0);

  @Property({ comment: "账单类型，年度账单或月度账单" })
  type: BillType;

  @Property({ columnType: DATETIME_TYPE, nullable: true })
  createTime: Date;

  @ManyToOne(() => AccountBill, { deleteRule: "cascade", ref: true })
  accountBill: Ref<AccountBill>;

  @Property({ comment: "账单详情，因为扣费类型不确定，此处用JSON展示，便于拓展", type: "json" })
  details: AnyJson;

  constructor(init: {
    id?: number;
    tenantName: string;
    accountName: string;
    userId: string;
    name: string;
    term: string;
    amount: Decimal;
    type: BillType;
    accountBill: EntityOrRef<AccountBill>;
    details: AnyJson;
    createTime?: Date;
  }) {
    if (init.id) {
      this.id = init.id;
    }
    this.tenantName = init.tenantName;
    this.accountName = init.accountName;
    this.userId = init.userId;
    this.name = init.name;
    this.term = init.term;
    this.amount = init.amount;
    this.type = init.type;
    this.accountBill = toRef(init.accountBill);
    this.details = init.details;
    this.createTime = init.createTime ?? new Date();
  }
}
