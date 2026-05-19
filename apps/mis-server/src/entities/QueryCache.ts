import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { DATETIME_TYPE } from "src/utils/orm";

@Entity()
export class QueryCache {
  @PrimaryKey()
  id!: number;

  @Property()
  queryKey: string;

  @Property({ type: "json" })
  queryResult: any;

  @Property({ columnType: DATETIME_TYPE })
  timestamp: Date;

  constructor(init: { id?: number; queryKey: string; queryResult: string; timestamp?: Date }) {
    if (init.id) {
      this.id = init.id;
    }
    this.queryKey = init.queryKey;
    this.queryResult = init.queryResult;
    this.timestamp = init.timestamp ?? new Date();
  }
}
