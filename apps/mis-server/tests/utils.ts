import { ClientConstructor, getClientFn } from "@scow/lib-server";
import { ScowResourcePlugin } from "@scow/lib-scow-resource";
import { commonConfig } from "src/config/common";

export const createTestClient = <TClient>(serverAddress: string, ctor: ClientConstructor<TClient>): TClient =>
  getClientFn(serverAddress, commonConfig.scowApi.auth.token)(ctor);

export const mockAccountResourceOperations = (resource: ScowResourcePlugin["resource"]) => {
  jest.spyOn(resource, "assignAccountOnCreate").mockResolvedValue();
  jest.spyOn(resource, "getAccountAssignedPartitionsForCluster").mockResolvedValue([]);
};
