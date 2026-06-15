import { Collection, Entity, OneToMany, PrimaryKey, Property } from "@mikro-orm/core";
import { Decimal } from "@scow/lib-decimal";
import { DecimalType } from "src/utils/decimal";
import { DATETIME_TYPE } from "src/utils/orm";
import { type AnyJson } from "src/utils/types";

import { UserBill } from "./UserBill";

export enum BillType {
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

@Entity()
export class AccountBill {
  @PrimaryKey()
  id!: number;

  @Property({ comment: "所属租户" })
  tenantName: string;

  @Property({ comment: "所属账户" })
  accountName: string;

  @Property({ nullable: true, comment: "账户主管理员id" })
  accountOwnerId?: string;

  @Property({ nullable: true, comment: "账户主管理员姓名" })
  accountOwnerName?: string;

  @Property({ comment: "账期，如202407、2024" })
  term: string;

  @Property({ type: DecimalType })
  amount: Decimal = new Decimal(0);

  @Property({ comment: "账单类型，年度账单或月度账单" })
  type: BillType;

  @Property({ columnType: DATETIME_TYPE, nullable: true })
  createTime: Date;

  @Property({ columnType: DATETIME_TYPE, nullable: true, onUpdate: () => new Date() })
  updateTime: Date;

  @OneToMany(() => UserBill, (u) => u.accountBill)
  userBills = new Collection<UserBill>(this);

  @Property({ comment: "账单详情，因为扣费类型不确定，此处用JSON展示，便于拓展", type: "json", nullable: true })
  details?: AnyJson;

  constructor(init: {
    id?: number;
    tenantName: string;
    accountName: string;
    accountOwnerId?: string;
    accountOwnerName?: string;
    term: string;
    amount: Decimal;
    type: BillType;
    details?: AnyJson;
    createTime?: Date;
    updateTime?: Date;
  }) {
    if (init.id) {
      this.id = init.id;
    }
    this.tenantName = init.tenantName;
    this.accountName = init.accountName;
    this.accountOwnerId = init.accountOwnerId;
    this.accountOwnerName = init.accountOwnerName;
    this.term = init.term;
    this.amount = init.amount;
    this.type = init.type;
    this.details = init.details;
    this.createTime = init.createTime ?? new Date();
    this.updateTime = init.updateTime ?? new Date();
  }
}
