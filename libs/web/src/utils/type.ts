// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type AnyJson = boolean | number | string | null | JsonArray | JsonMap;
// @ts-ignore
export type JsonMap = Record<string, AnyJson>;
interface JsonArray extends Array<AnyJson> {}

