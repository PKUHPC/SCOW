import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { contentType } from "mime-types";
import { NextApiRequest } from "next";
import { basename } from "path";

type ValueOf<T> = T[keyof T];

export const handlegRPCError =
  <THandlers extends Partial<Record<Status, (e: ServiceError) => unknown>>>(
    handlers: THandlers,
    logHandle?: () => Promise<void>,
  ) =>
  // @ts-ignore
  async (e: ServiceError): ReturnType<ValueOf<THandlers>> => {
    await logHandle?.();
    const handler = handlers[e.code];
    if (handler) {
      // @ts-ignore
      return handler(e) as ReturnType<ValueOf<THandlers>>;
    } else {
      throw e;
    }
  };
export const parseIp = (req: NextApiRequest): string | undefined => {
  let forwardedFor = req.headers["x-forwarded-for"];

  if (Array.isArray(forwardedFor)) {
    forwardedFor = forwardedFor.shift();
  }

  if (typeof forwardedFor === "string") {
    forwardedFor = forwardedFor.split(",").shift();
  }

  return forwardedFor ?? req.socket?.remoteAddress;
};

export function getContentType(filename: string, defaultValue: string) {
  const type = contentType(basename(filename));

  if (!type) {
    return defaultValue;
  }

  return type;
}
