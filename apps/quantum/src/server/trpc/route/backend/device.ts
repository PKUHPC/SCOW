import {
  FindDeviceOutputSchema, GetDeviceDetailInputSchema, GetDeviceDetailOutputSchema,
  GetDeviceStatusInputSchema, GetDeviceStatusOutputSchema, GetDeviceTopologyInputSchema,
  GetDeviceTopologyOutputSchema, GetRecommendedDevicesOutputSchema,
  UpdateChipIdInputSchema, UpdateChipIdOutputSchema,
} from "src/models/device";
import { allowedChipsArr } from "src/models/device";
import { quantumConfig } from "src/server/config/quantum";
import { router } from "src/server/trpc/def";
import { backendApiProcedure, callBackendApi } from "src/server/trpc/route/backend/common";
import { z } from "zod";

export const device = router({
  findDevice: backendApiProcedure.meta({
    openapi: {
      method: "POST",
      path: "/tc/{accountName}/device/find",
    },
  })
    .input(z.object({
      accountName: z.string(),
      type: z.array(z.string()).optional(),
      qubits: z.number().optional(),
      state: z.string().optional(),
      id: z.array(z.enum(allowedChipsArr)).optional(),
    }))
    .output(FindDeviceOutputSchema)
    .query(async ({ input }) => {

      const resp = await callBackendApi("/device/find", {
        method: "POST",
        body: JSON.stringify(input),
      });

      return resp as any;
    }),

  getDeviceStatus: backendApiProcedure.meta({
    openapi: {
      method: "POST",
      path: "/tc/{accountName}/device/status",
    },
  })
    .input(GetDeviceStatusInputSchema)
    .output(GetDeviceStatusOutputSchema)
    .query(async ({ input }) => {

      const resp = await callBackendApi("/device/status", {
        method: "POST",
        body: JSON.stringify(input),
      });

      return resp as any;
    }),

  getDeviceDetail: backendApiProcedure.meta({
    openapi: {
      method: "POST",
      path: "/tc/{accountName}/device/detail",
    },
  })
    .input(GetDeviceDetailInputSchema)
    .output(GetDeviceDetailOutputSchema)
    .query(async ({ input }) => {
      const resp = await callBackendApi("/device/detail", {
        method: "POST",
        body: JSON.stringify(input),
      });

      return resp as any;
    }),

  getDeviceTopology: backendApiProcedure.meta({
    openapi: {
      method: "POST",
      path: "/tc/{accountName}/device/topology",
    },
  })
    .input(GetDeviceTopologyInputSchema)
    .output(GetDeviceTopologyOutputSchema)
    .query(async ({ input }) => {
      const resp = await callBackendApi("/device/topology", {
        method: "POST",
        body: JSON.stringify(input),
      });

      return resp as any;
    }),

  // 当前接口为按文档定义，正常情况无法调用。文档有问题，实际上应当使用GET，返回和detail一样
  updateChipId: backendApiProcedure.meta({
    openapi: {
      method: "PUT",
      path: "/tc/{accountName}/device/{id}",
    },
  })
    .input(UpdateChipIdInputSchema)
    .output(UpdateChipIdOutputSchema)
    .mutation(async ({ input }) => {
      const { id, ...body } = input;
      const resp = await callBackendApi(`/device/${id}`, {
        method: "PUT",
        body: JSON.stringify({ id, ...body }),
      });

      return resp as any;
    }),

  getRecommendedDevices: backendApiProcedure.meta({
    openapi: {
      method: "GET",
      path: "/getRecommendedDevices",
      tags: ["getRecommendedDevices"],
      summary: "Get Recommended Devices",
    },
  })
    .input(z.void())
    .output(GetRecommendedDevicesOutputSchema)
    .query(async () => {
      return GetRecommendedDevicesOutputSchema.parse(quantumConfig.device.recommend);
    }),

});
