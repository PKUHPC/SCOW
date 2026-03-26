export interface BaseFormValues {
  jobName: string;
}

export interface ResourceFormValues {
  account: string;
  cluster: string;
  partition: string;
  qos: string;
  nodeCount: number;
  gpuCores?: number;
  cpuCores?: number;
  maxTime: number;
}

export interface JobFormValues {
  workingDirectory: string;
  output: string;
  errorOutput: string;
  scriptOutput: string;
  command: string;
}
