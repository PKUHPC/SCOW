export enum InternalMessageType {
  AccountOverdue = "AccountOverdue",
  AccountRechargeSuccess = "AccountRechargeSuccess",
  AccountLowBalance = "AccountLowBalance",
  AccountBalance = "AccountBalance",
  AccountLocked = "AccountLocked",
  AccountUnblocked = "AccountUnblocked",
  JobStarted = "JobStarted",
  JobFinished = "JobFinished",
  JobAbnormalTermination = "JobAbnormalTermination",
  AccountUserSyncResult = "AccountUserSyncResult",
}


export enum MessageStatus {
  // 异常
  EXCEPTION = "Exception",
  // 完成
  COMPLETED = "Completed",
  // 其他
}
