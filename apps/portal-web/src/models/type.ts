import { Type } from "@sinclair/typebox";

// TypeBox 递归定义
export const AnyJsonSchema = Type.Recursive((Self) =>
  Type.Union([
    Type.String(),
    Type.Number(),
    Type.Boolean(),
    Type.Null(),
    // 递归引用自身作为数组元素
    Type.Array(Self),
    // 递归引用自身作为 Record 的值
    Type.Record(Type.String(), Self),
  ]),
);
