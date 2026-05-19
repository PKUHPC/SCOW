import { Type } from "@sinclair/typebox";

export const DateSchema = Type.Object({
  year: Type.Number(),
  month: Type.Number(),
  day: Type.Number(),
});
