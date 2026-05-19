type CamelCase<S extends string> = S extends `${infer Prefix}_${infer Suffix}`
  ? `${Prefix}${Capitalize<CamelCase<Suffix>>}`
  : S;

type CamelCasedProperties<T> = {
  [K in keyof T as CamelCase<string & K>]: T[K] extends object
    ? T[K] extends any[]
      ? CamelCasedArray<T[K]>
      : CamelCasedProperties<T[K]>
    : T[K];
};

type CamelCasedArray<T> = T extends (infer U)[] ? CamelCasedProperties<U>[] : T;

// 单独处理对象键名转换
function toCamelCaseObject<T extends object>(obj: T): T {
  if (obj !== null && typeof obj === "object") {
    return Object.entries(obj).reduce(
      (result, [key, value]) => {
        const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        (result as any)[camelCaseKey] = typeof value === "object" && value !== null ? toCamelCase(value) : value;
        return result;
      },
      {} as Record<string, any>,
    ) as T;
  }
  return obj as any;
}

// 单独处理数组对象
export function toCamelCaseArray<T extends any[]>(arr: T): T {
  return arr.map((item) => (typeof item === "object" && item !== null ? toCamelCaseObject(item) : item)) as T;
}

// 通用入口函数
export function toCamelCase<T>(input: T): T extends any[] ? CamelCasedArray<T> : T {
  if (Array.isArray(input)) {
    return toCamelCaseArray(input) as any;
  } else if (typeof input === "object" && input !== null) {
    return toCamelCaseObject(input) as any;
  }
  return input as any;
}
