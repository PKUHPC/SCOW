import { customCleanEnv, EnvError, makeValidator, Spec, strictProxyMiddleware, ValidatorSpec } from "envalid";
import * as envalid from "envalid";

/**
 * Replace ${a} to valueObj[a]. If valueObj[a] is undefined, replace with ""
 * @param str the original string
 * @param valueObj the object containing keys and values
 * @returns replaced string
 */
export function parsePlaceholder(str: string, valueObj: object) {
  return str.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_, p1: string) => valueObj[p1] ?? "");
}

export type Validator<T> = readonly [(spec?: Spec<T>) => ValidatorSpec<T>, Spec<T>];

function parsePlaceholders(env: Record<string, any>, rawEnv: any) {
  for (const k in env) {
    if (typeof env[k] === "string") {
      env[k] = parsePlaceholder(env[k], rawEnv);
    }
  }
  return env;
}

/** Separate function and params */
function make<T>(validator: Validator<T>[0], name: string) {
  const func = (spec: Spec<T>) => [validator, spec] as const;
  Object.defineProperty(func, "name", { value: name });
  return func;
}

export const str = make(envalid.str, "str");
export const host = make(envalid.host, "host");
export const url = make(envalid.url, "url");
export const num = make(envalid.num, "num");
export const bool = make(envalid.bool, "bool");

export const envConfig = <T extends object>(specs: { [K in keyof T]: Validator<T[K]> }, envObject = process.env) => {
  const envalidSpecs = {} as { [K in keyof T]: ValidatorSpec<T[K]> };

  for (const k in specs) {
    const [func, spec] = specs[k];
    envalidSpecs[k] = func(spec);
  }

  return {
    ...customCleanEnv(envObject, envalidSpecs, (env, rawEnv) =>
      strictProxyMiddleware(parsePlaceholders(env, rawEnv) as T, rawEnv),
    ),
    _specs: specs,
  };
};

export function omitConfigSpec<T extends {}>(spec: T) {
  return Object.keys(spec).reduce((prev, key) => {
    if (key !== "_specs") {
      prev[key] = spec[key];
    }
    return prev;
  }, {}) as Omit<T, "_specs">;
}

/** Custom validators */

function makeCustomValidator<T>(name: string, parseFn: (input: string) => T) {
  const validator = makeValidator(parseFn);
  Object.defineProperty(validator, "name", { value: name });
  return make(validator, name);
}

export const port = makeCustomValidator("port", (x) => {
  const coerced = +x;
  if (Number.isNaN(coerced) || `${coerced}` !== `${x}` || coerced % 1 !== 0 || coerced < 0 || coerced > 65535) {
    throw new EnvError(`Invalid port input: "${x}"`);
  }
  return coerced;
});

export const regex = makeCustomValidator("regex", (x) => {
  if (!x) {
    return x;
  }
  new RegExp(x);
  return x;
});
