import { EntitySchema } from "@mikro-orm/core";

export class UserToken {
  id!: number;
  userId: string;
  token: string;
  createdAt: Date;

  constructor(init: { userId: string; token: string; createdAt?: Date }) {
    this.userId = init.userId;
    this.token = init.token;
    this.createdAt = init.createdAt || new Date();
  }
}

export const UserTokenSchema = new EntitySchema<UserToken>({
  class: UserToken,
  name: "UserToken",
  properties: {
    id: { type: "number", primary: true },
    userId: { type: "string", unique: true },
    token: { type: "string", index: true },
    createdAt: { type: "Date", onCreate: () => new Date() },
  },
});
