import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

@Entity()
export class SystemState {
  @PrimaryKey()
  key: string;

  @Property()
  value: string;

  public static KEYS = {
    INITIALIZATION_TIME: "INITIALIZATION_TIME",
    UPDATE_SLURM_BLOCK_STATUS: "UPDATE_SLURM_BLOCK_STATUS",
  } as const;

  constructor(key: keyof typeof SystemState.KEYS, value: string) {
    this.key = key;
    this.value = value;
  }
}
