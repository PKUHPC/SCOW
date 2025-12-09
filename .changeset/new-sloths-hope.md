---
"@scow/grpc-api": minor
---

**修改以下 proto 接口中 ownerId 及 ownerName 相关项为可选**:  
GetWhitelistedAccountsResponse, GetAccountsResponse, GetBillsResponse
**修改以下返回值带有 JobInfo 的 proto 接口中 ownerId 及 ownerName 相关项为可选**:  
ExportJobRecordResponse, GetJobsResponse, GetJobByBiJobIndexResponse  
**修改以下 HOOK 的 proto 接口中 ownerId 及 ownerName 相关项为可选**: 
JobsSaved, AccountDeleted
