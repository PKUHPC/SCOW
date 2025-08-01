import { ValueOf } from "next/dist/shared/lib/constants";
import { join } from "path";
import { Lang } from "react-typed-i18n";
import en from "src/i18n/en";
import { BASE_PATH } from "src/utils/processEnv";
import { z } from "zod";

export type TransType = (id: Lang<typeof en>, args?: React.ReactNode[]) => string;

export const DisplayedDeviceState = {
  DISPLAYED_ONLINE: 0,
  DISPLAYED_OFFLINE: 1,
  DISPLAYED_MAINTENANCE: 2,
} as const;

export type DisplayedDeviceState = ValueOf<typeof DisplayedDeviceState>;

export const getDisplayedStateI18nTexts = (t: TransType) => {
  return {
    [DisplayedDeviceState.DISPLAYED_ONLINE]: t("pageComp.device.deviceCard.online"),
    [DisplayedDeviceState.DISPLAYED_OFFLINE]: t("pageComp.device.deviceCard.offline"),
    [DisplayedDeviceState.DISPLAYED_MAINTENANCE]: t("pageComp.device.deviceCard.maintenance"),
  };
};

// 允许的芯片ID列表
export const allowedChipsArr = [
  "t9",
  "t40v20s1",
  "t40",
  "t13v7",
  "t40v20s2",
  "t13",
  "t59v15s3",
  "t59v14s4",
  "t60v15s4",
  "t60v15s2",
  "t59v14s2",
  "t60v15s3",
  "t59v16s1",
  "t60v15s1",
  "t60",
  "t59",
  "simulator:tc",
  "t13v6",
  "testing",
] as const;

export const allowedQosValues = ["0", "1", "2", "3", "4", "5", "6", "7"];

const ReadoutSchema = z.object({
  F0: z.number(),
  F1: z.number(),
});

export const ErrSchema = z.object({
  SQ: z.number().optional(),
  CZ: z.number().optional(),
  Readout: ReadoutSchema.optional(), // Make Readout itself optional
});

export type BaseDeviceErr = z.infer<typeof ErrSchema>;

export const DeviceStateStringSchema =
 z.union([z.literal("on"), z.literal("off"), z.literal("maintenance")]);

export type DeviceStateString = z.infer<typeof DeviceStateStringSchema>;

// 设备基础属性
export const BaseDeviceSchema = z.object({
  id: z.enum(allowedChipsArr),
  alias: z.string().optional(),
  type: z.union([z.literal("SIM"), z.literal("CHIP"), z.literal("vCHIP")]).optional(),
  qubits: z.number().optional(),
  T1: z.number().optional(),
  T2: z.number().optional(),
  report: z.record(z.string(), z.number()).optional(),
  at: z.number().optional(),
  state: DeviceStateStringSchema.optional(),
  queue: z.number().optional(),
  Err: ErrSchema.optional(),
});

export const DeviceLinkSchema = z.object({
  A: z.number(),
  B: z.number(),
  CZErrRate: z.number().optional(),
  GateLenInNs: z.number().optional(),
});

// bits 数组的单个元素 schema
export const DeviceBitSchema = z.record(z.string(), z.any());

export const FindDeviceOutputSchema = z.object({
  devices: z.array(BaseDeviceSchema.extend({
    langs: z.array(z.string()).optional(),
    memo: z.string().optional(),
    usage: z.string().optional(),
  })),
});

export const DevicesMapSchema = BaseDeviceSchema.extend({
  gateFidelity: z.string().optional(),
  status: z.nativeEnum(DisplayedDeviceState).optional(),
});


export type DevicesMap = z.infer<typeof DevicesMapSchema>;

export const GetDeviceStatusInputSchema = z.object({
  id: z.array(z.enum(allowedChipsArr)),
  accountName: z.string(),
});

export const GetDeviceStatusOutputSchema = z.object({
  devices: z.array(BaseDeviceSchema),
});

export const GetDeviceDetailInputSchema = z.object({
  id: z.enum(allowedChipsArr),
  accountName: z.string(),
});

// getDeviceDetail 和 getDeviceTopology 接口的 Device Output Schema
export const DetailedDeviceSchema = BaseDeviceSchema.extend({
  gates: z.array(z.string()).optional(),
  links: z.array(DeviceLinkSchema).optional(),
  bits: z.array(DeviceBitSchema).optional(),
  langs: z.array(z.string()).optional(), // detail 接口有 langs, usage, memo
  memo: z.string().optional(),
  usage: z.string().optional(),
});

export const GetDeviceDetailOutputSchema = z.object({
  device: DetailedDeviceSchema,
});


export const GetDeviceTopologyInputSchema = z.object({
  id: z.enum(allowedChipsArr),
  accountName: z.string(),
});

export const GetDeviceTopologyOutputSchema = z.object({
  device: DetailedDeviceSchema.omit({ langs: true, memo: true, usage: true }), // topology 接口输出不包含 langs, memo, usage
});

export const UpdateChipIdInputSchema = z.object({
  id: z.enum(allowedChipsArr),
  state: z.string().optional(),
  queue: z.number().optional(),
  gates: z.array(z.string()).optional(),
  links: z.array(DeviceLinkSchema).optional(),
  bits: z.array(DeviceBitSchema).optional(),
  qubits: z.number().optional(),
  memo: z.string().optional(),
  at: z.number().optional(), // 示例中存在，但 REQUEST 结构中未明确列出，保留为可选
  accountName: z.string(),
});

export const UpdateChipIdOutputSchema = z.object({
  id: z.enum(allowedChipsArr).optional(),
  err: z.string().optional(),
});

export type AllowedChipIdType = (typeof allowedChipsArr)[number];

interface DeviceCard {
  id: AllowedChipIdType; // 关键约束
  path: string;
}

export const DeviceCardsData: DeviceCard[] = [
  {
    id: "t9",
    path: join(BASE_PATH, "/device/1.jpg"),
  },
  {
    id: "t40v20s1",
    path: join(BASE_PATH, "/device/2.jpg"),
  },
  {
    id: "t40",
    path: join(BASE_PATH, "/device/3.jpg"),
  },
  {
    id: "t13v7",
    path: join(BASE_PATH, "/device/4.png"),
  },
  {
    id: "t40v20s2",
    path: join(BASE_PATH, "/device/5.jpg"),
  },
  {
    id: "t13",
    path: join(BASE_PATH, "/device/6.jpg"),
  },
  {
    id: "t59v15s3",
    path: join(BASE_PATH, "/device/1.jpg"),
  },
  {
    id: "t59v14s4",
    path: join(BASE_PATH, "/device/2.jpg"),
  },
  {
    id: "t60v15s4",
    path: join(BASE_PATH, "/device/3.jpg"),
  },
  {
    id: "t60v15s2",
    path: join(BASE_PATH, "/device/4.png"),
  },
  {
    id: "t59v14s2",
    path: join(BASE_PATH, "/device/5.jpg"),
  },
  {
    id: "t60v15s3",
    path: join(BASE_PATH, "/device/6.jpg"),
  },
  {
    id: "t59v16s1",
    path: join(BASE_PATH, "/device/1.jpg"),
  },
  {
    id: "t60v15s1",
    path: join(BASE_PATH, "/device/2.jpg"),
  },
  {
    id: "t60",
    path: join(BASE_PATH, "/device/3.jpg"),
  },
  {
    id: "t59",
    path: join(BASE_PATH, "/device/4.png"),
  },
  {
    id: "simulator:tc",
    path: join(BASE_PATH, "/device/5.jpg"),
  },
  {
    id: "t13v6",
    path: join(BASE_PATH, "/device/6.jpg"),
  },
];

export const GetRecommendedDevicesOutputSchema = z.array(z.enum(allowedChipsArr));
