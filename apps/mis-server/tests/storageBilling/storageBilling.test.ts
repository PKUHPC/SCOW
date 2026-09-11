import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import * as grpc from "@grpc/grpc-js";
import { SqlEntityManager, MySqlDriver } from "@mikro-orm/mysql";
import { moneyToNumber, numberToMoney } from "@scow/lib-decimal";
import {
  AddStorageBillingItemRequest,
  StorageBillingServiceClient,
  StorageBillingMode as ProtoBillingMode,
} from "@scow/protos/build/server/storage_billing";
import { createServer } from "src/app";
import { StorageBillingMode, StoragePriceItem } from "src/entities/StoragePriceItem";
import { Tenant } from "src/entities/Tenant";
import { dropDatabase } from "tests/data/helpers";
import { createTestClient } from "tests/utils";

let server: Server;
let em: SqlEntityManager<MySqlDriver>;
let tenant: Tenant;

beforeEach(async () => {
  server = await createServer();
  em = server.ext.orm.em.fork();

  tenant = new Tenant({ name: "testTenant" });
  await em.persistAndFlush([tenant]);

  await server.start();
});

afterEach(async () => {
  if (server) {
    await dropDatabase(server.ext.orm);
    await server.close();
  }
});

function getClient() {
  return createTestClient(server.serverAddress, StorageBillingServiceClient);
}

function addStorageBillingItem(
  client: StorageBillingServiceClient,
  request: Omit<AddStorageBillingItemRequest, "originalTiers"> & Partial<Pick<AddStorageBillingItemRequest, "originalTiers">>,
) {
  return asyncClientCall(client, "addStorageBillingItem", {
    originalTiers: [],
    ...request,
  });
}

describe("AddStorageBillingItem", () => {

  it("adds a platform default billing item", async () => {
    const client = getClient();

    const { id } = await addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [
        { startTb: 0, pricePerTbPerDay: numberToMoney(0) },
        { startTb: 50, pricePerTbPerDay: numberToMoney(1.5) },
      ],
      originalTiers: [
        { startSize: 0, endSize: 51200, unit: "GB", pricePerTbPerDay: numberToMoney(0) },
        { startSize: 51200, unit: "GB", pricePerTbPerDay: numberToMoney(1.5) },
      ],
      description: "platform default",
    });

    expect(id).toBe(1);

    const item = await em.findOneOrFail(StoragePriceItem, { id });
    expect(item.storageId).toBe("home");
    expect(item.billingMode).toBe(StorageBillingMode.USAGE);
    expect(item.tiers).toHaveLength(2);
    expect(item.tiers[0].startTb).toBe(0);
    expect(item.tiers[0].pricePerTbPerDay).toBe(0);
    expect(item.tiers[1].startTb).toBe(50);
    expect(item.tiers[1].pricePerTbPerDay).toBe(1.5);
    expect(item.originalTiers).toEqual([
      { startSize: 0, endSize: 51200, unit: "GB", pricePerTbPerDay: 0 },
      { startSize: 51200, unit: "GB", pricePerTbPerDay: 1.5 },
    ]);
    expect(item.tenant).toBeUndefined();
    expect(item.description).toBe("platform default");
  });

  it("adds a tenant-specific billing item", async () => {
    const client = getClient();

    const { id } = await addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_QUOTA,
      tiers: [
        { startTb: 0, pricePerTbPerDay: numberToMoney(2.0) },
      ],
      tenantName: "testTenant",
      description: "tenant price",
    });

    expect(id).toBe(1);

    const item = await em.findOneOrFail(StoragePriceItem, { id }, { populate: ["tenant"] });
    expect(item.tenant?.getProperty("name")).toBe("testTenant");
    expect(item.billingMode).toBe(StorageBillingMode.QUOTA);
  });

  it("returns incrementing ids", async () => {
    const client = getClient();

    const r1 = await addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [{ startTb: 0, pricePerTbPerDay: numberToMoney(0) }],
      description: "first",
    });
    expect(r1.id).toBe(1);

    const r2 = await addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [{ startTb: 0, pricePerTbPerDay: numberToMoney(1) }],
      description: "second",
    });
    expect(r2.id).toBe(2);
  });

  it("rejects empty tiers", async () => {
    const client = getClient();

    await expect(addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [],
      description: "bad",
    })).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("rejects tiers where first tier does not start at 0", async () => {
    const client = getClient();

    await expect(addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [{ startTb: 10, pricePerTbPerDay: numberToMoney(1) }],
      description: "bad",
    })).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("rejects tiers with non-increasing startTb", async () => {
    const client = getClient();

    await expect(addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [
        { startTb: 0, pricePerTbPerDay: numberToMoney(0) },
        { startTb: 50, pricePerTbPerDay: numberToMoney(1) },
        { startTb: 50, pricePerTbPerDay: numberToMoney(2) },
      ],
      description: "bad",
    })).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("rejects original tiers when the last tier has an upper limit", async () => {
    const client = getClient();

    await expect(addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [
        { startTb: 0, pricePerTbPerDay: numberToMoney(0) },
        { startTb: 50, pricePerTbPerDay: numberToMoney(1) },
      ],
      originalTiers: [
        { startSize: 0, endSize: 50, unit: "TB", pricePerTbPerDay: numberToMoney(0) },
        { startSize: 50, endSize: 100, unit: "TB", pricePerTbPerDay: numberToMoney(1) },
      ],
      description: "bad",
    })).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("rejects non-existent tenant", async () => {
    const client = getClient();

    await expect(addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [{ startTb: 0, pricePerTbPerDay: numberToMoney(0) }],
      tenantName: "nonExistent",
      description: "bad",
    })).rejects.toMatchObject({ code: grpc.status.NOT_FOUND });
  });
});

describe("GetStorageBillingItems", () => {

  it("returns empty when no items exist", async () => {
    const client = getClient();

    const resp = await asyncClientCall(client, "getStorageBillingItems", {
      storageId: "home",
    });

    expect(resp.activeItems).toHaveLength(0);
    expect(resp.historyItems).toHaveLength(0);
  });

  it("returns the latest item as active and older ones as history", async () => {
    const client = getClient();

    await addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [{ startTb: 0, pricePerTbPerDay: numberToMoney(1) }],
      description: "v1",
    });

    await addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [{ startTb: 0, pricePerTbPerDay: numberToMoney(2) }],
      description: "v2",
    });

    const resp = await asyncClientCall(client, "getStorageBillingItems", {
      storageId: "home",
    });

    expect(resp.activeItems).toHaveLength(1);
    expect(resp.historyItems).toHaveLength(1);
    expect(resp.activeItems[0].description).toBe("v2");
    expect(resp.historyItems[0].description).toBe("v1");
  });

  it("separates platform and tenant items by tenantName filter", async () => {
    const client = getClient();

    await addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [{ startTb: 0, pricePerTbPerDay: numberToMoney(1) }],
      description: "platform",
    });

    await addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_QUOTA,
      tiers: [{ startTb: 0, pricePerTbPerDay: numberToMoney(2) }],
      tenantName: "testTenant",
      description: "tenant",
    });

    // query platform items (no tenantName)
    const platformResp = await asyncClientCall(client, "getStorageBillingItems", {
      storageId: "home",
    });
    expect(platformResp.activeItems).toHaveLength(1);
    expect(platformResp.activeItems[0].description).toBe("platform");
    expect(platformResp.activeItems[0].tenantName).toBeUndefined();

    // query tenant items
    const tenantResp = await asyncClientCall(client, "getStorageBillingItems", {
      storageId: "home",
      tenantName: "testTenant",
    });
    expect(tenantResp.activeItems).toHaveLength(1);
    expect(tenantResp.activeItems[0].description).toBe("tenant");
    expect(tenantResp.activeItems[0].tenantName).toBe("testTenant");
  });

  it("returns correct tier data in response", async () => {
    const client = getClient();

    await addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [
        { startTb: 0, pricePerTbPerDay: numberToMoney(0) },
        { startTb: 50, pricePerTbPerDay: numberToMoney(1.5) },
        { startTb: 200, pricePerTbPerDay: numberToMoney(3) },
      ],
      description: "tiered",
    });

    const resp = await asyncClientCall(client, "getStorageBillingItems", {
      storageId: "home",
    });

    const item = resp.activeItems[0];
    expect(item.tiers).toHaveLength(3);
    expect(item.tiers[0].startTb).toBe(0);
    expect(moneyToNumber(item.tiers[0].pricePerTbPerDay!)).toBe(0);
    expect(item.tiers[1].startTb).toBe(50);
    expect(moneyToNumber(item.tiers[1].pricePerTbPerDay!)).toBe(1.5);
    expect(item.tiers[2].startTb).toBe(200);
    expect(moneyToNumber(item.tiers[2].pricePerTbPerDay!)).toBe(3);
    expect(item.originalTiers).toHaveLength(3);
    expect(item.originalTiers[0].startSize).toBe(0);
    expect(item.originalTiers[0].endSize).toBe(50);
    expect(item.originalTiers[0].unit).toBe("TB");
  });

  it("does not mix items from different storageIds", async () => {
    const client = getClient();

    await addStorageBillingItem(client, {
      storageId: "home",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [{ startTb: 0, pricePerTbPerDay: numberToMoney(1) }],
      description: "home item",
    });

    await addStorageBillingItem(client, {
      storageId: "scratch",
      billingMode: ProtoBillingMode.STORAGE_BILLING_MODE_USAGE,
      tiers: [{ startTb: 0, pricePerTbPerDay: numberToMoney(2) }],
      description: "scratch item",
    });

    const homeResp = await asyncClientCall(client, "getStorageBillingItems", {
      storageId: "home",
    });
    expect(homeResp.activeItems).toHaveLength(1);
    expect(homeResp.activeItems[0].description).toBe("home item");

    const scratchResp = await asyncClientCall(client, "getStorageBillingItems", {
      storageId: "scratch",
    });
    expect(scratchResp.activeItems).toHaveLength(1);
    expect(scratchResp.activeItems[0].description).toBe("scratch item");
  });
});
