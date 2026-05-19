import { Entity, OneToOne, PrimaryKey, Property, Ref } from "@mikro-orm/core";
import { Account } from "src/entities/Account";
import { EntityOrRef, toRef } from "src/utils/orm";

@Entity()
export class AccountWhitelist {
  @PrimaryKey()
  id!: number;

  @OneToOne(() => Account, (a) => a.whitelist, { ref: true, nullable: false, unique: true })
  account: Ref<Account>;

  @Property()
  time: Date;

  @Property()
  comment: string;

  @Property()
  operatorId: string;

  // 当expirationTime为undefined时，即为永久有效
  @Property({ nullable: true })
  expirationTime?: Date;

  constructor(init: {
    account: EntityOrRef<Account>;
    time?: Date;
    comment: string;
    operatorId: string;
    expirationTime?: Date;
  }) {
    this.account = toRef(init.account);
    this.time = init.time ?? new Date();
    this.comment = init.comment;
    this.operatorId = init.operatorId;
    // undefined为永久有效
    this.expirationTime = init.expirationTime ?? undefined;
  }
}
