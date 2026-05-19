import { Logger } from "ts-log";

export const applicationJsonHeaders = { "content-type": "application/json" };

export class HttpError extends Error {
  constructor(public resp: Response) {
    super("Error occurred when calling auth HTTP API");
  }

  get status() {
    return this.resp.status;
  }
}

export const logHttpErrorAndThrow = (resp: Response, logger?: Logger) => {
  logger?.error("HTTP Error when calling auth HTTP API. Status code %s", resp.status);

  throw new HttpError(resp);
};
