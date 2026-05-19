import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { ChannelCredentials } from "@grpc/grpc-js";
import { ScowHookConfigSchema } from "@scow/config/build/common";
import { HookServiceClient, OnEventRequest } from "@scow/protos/build/hook/hook";
import { Logger } from "ts-log";

type Event = Exclude<OnEventRequest["event"], undefined>;

export const createHookClient = (config: ScowHookConfigSchema | undefined, logger: Logger) => {
  const hooks: {
    name?: string;
    client: HookServiceClient;
  }[] = [];

  const createHook = (url: string, name?: string) => {
    return {
      name: name ?? url,
      client: new HookServiceClient(url, ChannelCredentials.createInsecure()),
    };
  };

  if (!config) {
    logger.info("Hook is not configured.");
  } else if (!config.enabled) {
    logger.info("Hook is explicitly disabled in config.");
  } else if (config.hooks) {
    for (const hook of config.hooks) {
      hooks.push(createHook(hook.url, hook.name));
    }
    logger.info("Hooks are configured with %d hooks", hooks.length);
  } else if (config.url) {
    hooks.push(createHook(config.url));
    logger.info("Hook %s is configured.", config.url);
  } else {
    logger.info("No hooks or url is provided in hook config. Hook is not configured.");
  }

  return {
    callHook: async <TEventName extends Event["$case"]>(
      eventName: TEventName,
      // @ts-ignore
      eventPayload: (Event & { $case: TEventName })[TEventName],
      logger: Logger,
    ) => {
      if (hooks.length === 0) {
        logger.debug("Attempt to call hook %s with %o", eventName, eventPayload);
        return;
      }

      logger.info("Calling hooks concurrently with event name %s and payload %o", eventName, eventPayload);

      await Promise.all(
        hooks.map(async (hook) => {
          logger.info("Calling hook %s", hook.name);
          await asyncUnaryCall(hook.client, "onEvent", {
            metadata: { time: new Date().toISOString() },
            // @ts-ignore
            event: { $case: eventName, [eventName]: eventPayload },
          }).then(
            () => {
              logger.debug("Hook call completed");
            },
            (e) => {
              logger.error(e, "Error when calling hook");
            },
          );
        }),
      );
    },
  };
};
