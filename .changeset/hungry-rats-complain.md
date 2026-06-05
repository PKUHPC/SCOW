---
"@scow/scheduler-adapter-protos": patch
---

1. GetJobsRequest 的 job_types 语义修改为：如果为空，返回 HPC 作业；如果有值，返回 AI 作业。如果适配器不支持对应作业类型，GetJobs 返回 UNIMPLEMENTED；
2. SubmitJob 的语义修改为：如果`extra_options[0]`为`app`或者`train`，则为提交AI作业了；其他情况为HPC作业
