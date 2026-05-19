import { plugin } from "@ddadaal/tsgrpc-server";
import { createPriceMap } from "src/bl/PriceMap";

export interface PricePlugin {
  price: {};
}

export const pricePlugin = plugin(async (s) => {
  const logger = s.logger.child({ plugin: "price" });

  // check price item completeness
  const priceMap = await createPriceMap(s.ext.orm.em.fork(), s.ext.clusters, logger);
  const missingItems = priceMap.getMissingDefaultPriceItems();
  if (missingItems.length > 0) {
    logger.warn(
      `
      The following price items are missing in platform scope: %o.
      An error will be thrown when such a job is fetched.
    `,
      missingItems,
    );
  } else {
    logger.info("Platform price items are complete. ");
  }

  s.addExtension("price", {} as PricePlugin["price"]);
});
