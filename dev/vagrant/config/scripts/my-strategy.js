// interface JobInfo {
//   // cluster job id
//   jobId: number;
//   // scow cluster id
//   cluster: string;
//   partition: string;
//   qos: string;
//   timeUsed: number;
//   cpusAlloc: number;
//   gpu: number;
//   memReq: number;
//   memAlloc: number;
//   account: string;
//   tenant: string;
// }

// type MyStrategy = (jobInfo: JobInfo) => number | Promise<number>;
// 系统自带的计费规则请参考 apps/mis-server/src/bl/jobPrice.ts 文件中的 amountStrategyFuncs

// 本函数的计费模式：如果作业运行时间小于180s，则不扣费，如果使用了gpu，按照gpu分配量计费，其余的按照cpu分配量计费
function myStrategy(jobInfo) {
  if (jobInfo.timeUsed < 180) {
    return 0;
  } else if (info.gpu) {
    return info.gpu;
  }

  return info.cpusAlloc;
}

module.exports = myStrategy;
