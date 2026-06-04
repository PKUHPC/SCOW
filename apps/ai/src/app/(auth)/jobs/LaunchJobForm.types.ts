import type { ReactNode } from "react";

export type QueueKind = "gpu" | "cpu";

export interface QueueRowBase {
  id: string;
  queue: string;
  capacity: string;
  disabled: boolean;
  totalNodes: number;
  totalUnits: number;
  idleUnits: number;
  qosOptions?: string[];
  type: QueueKind;
}

export interface GPUQueueRow extends QueueRowBase {
  accelerator: string;
  acceleratorDetail?: string;
  acceleratorVramGb?: number;
  cpuModel: string;
  memoryPerGpu?: string;
  memoryPerGpuMb?: number;
  cpuPerGpu?: number;
  gpuType?: string;
  maxAcceleratorsPerPod?: number;
  type: "gpu";
}

export interface CPUQueueRow extends QueueRowBase {
  cpuModel: string;
  cpuDetail?: string;
  memoryPerCore?: string;
  memoryPerCoreMb?: number;
  type: "cpu";
}

export type QueueRow = GPUQueueRow | CPUQueueRow;

export type ImageSourceKey = "preset" | "mine" | "public" | "remote";

export type MaxTimeUnit = "min" | "hour" | "day";

export interface ImageOption {
  label: string;
  value: string;
  description?: string;
  rawName?: string;
  rawTag?: string;
  ownerName?: string;
  ownerId?: string;
  displayLabel?: ReactNode;
  startCommand?: string;
  servicePort?: number;
}

export interface QueueStats {
  totalUnits: number;
  cpuPerUnit: number;
  memoryPerUnitText: string;
  memoryPerUnitMb?: number;
  qosOptions: string[];
}

export interface ImageSourceDraft {
  image?: string;
  usePrivateImage?: boolean;
  remoteUsername?: string;
  remotePassword?: string;
  command?: string;
  containerServicePort?: number;
}

export interface CommandCacheEntry {
  default?: string;
  custom?: string;
}

export type CascaderSelection = (string | number)[];

export type CustomFieldsMap = Record<string, string | number | null | undefined>;

export interface BaseFormValues {
  appJobName: string;
}

export interface ResourceFormValues {
  account: string;
  cluster: string;
  queue: QueueKind;
  priority: string;
  gpuCores?: number;
  cpuCores?: number;
  maxTime: number;
}

export interface MountPointField {
  source: string;
  target: string;
}

export interface ResourceSelectionField {
  selection: CascaderSelection;
  target: string;
}

export interface EnvVariableField {
  key: string;
  value: string;
}

export interface AppFormValues {
  image?: string;
  usePrivateImage?: boolean;
  remoteUsername?: string;
  remotePassword?: string;
  command?: string;
  containerServicePort?: number;
  datasets?: ResourceSelectionField[];
  algorithms?: ResourceSelectionField[];
  models?: ResourceSelectionField[];
  mountPoints?: MountPointField[];
  envVariables?: EnvVariableField[];
  customFields?: CustomFieldsMap;
}

export interface VersionLookupEntry {
  isPrivate: boolean;
  currentNameVersion?: string;
}

export interface VersionItem {
  id: number;
  versionName?: string;
  label?: ReactNode;
}

export interface VersionGroup {
  name?: string;
  label?: ReactNode;
  versions?: VersionItem[];
}
