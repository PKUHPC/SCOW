"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[2051],{3845:(n,e,o)=>{o.r(e),o.d(e,{assets:()=>u,contentTitle:()=>s,default:()=>m,frontMatter:()=>c,metadata:()=>l,toc:()=>i});var r=o(35250),t=o(57766);const c={title:"slurm.conf \u914d\u7f6e",sidebar_position:2},s=void 0,l={id:"hpccluster/config/slurm.conf",title:"slurm.conf \u914d\u7f6e",description:"",source:"@site/docs/hpccluster/config/slurm.conf.md",sourceDirName:"hpccluster/config",slug:"/hpccluster/config/slurm.conf",permalink:"/SCOW/pr-preview/pr-949/docs/hpccluster/config/slurm.conf",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/hpccluster/config/slurm.conf.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{title:"slurm.conf \u914d\u7f6e",sidebar_position:2},sidebar:"hpccluster",previous:{title:"NFS\u5b89\u88c5\u548c\u914d\u7f6e",permalink:"/SCOW/pr-preview/pr-949/docs/hpccluster/nfs"},next:{title:"slurmdbd.conf \u914d\u7f6e",permalink:"/SCOW/pr-preview/pr-949/docs/hpccluster/config/slurmdbd.conf"}},u={},i=[];function a(n){const e={code:"code",pre:"pre",...(0,t.a)(),...n.components};return(0,r.jsx)(e.pre,{children:(0,r.jsx)(e.code,{className:"language-Properties",children:"#\n# slurm.conf file. Please run configurator.html\n# (in doc/html) to build a configuration file customized\n# for your environment.\n#\n#\n# slurm.conf file generated by configurator.html.\n# Put this file on all nodes of your cluster.\n# See the slurm.conf man page for more information.\n#\n################################################\n#                   CONTROL                    #\n################################################\nClusterName=cluster    #\u96c6\u7fa4\u540d\u79f0\nSlurmctldHost=manage01    #\u7ba1\u7406\u670d\u52a1\u8282\u70b9\u540d\u79f0\nSlurmctldPort=6817    #slurmctld\u670d\u52a1\u7aef\u53e3\nSlurmdPort=6818   #slurmd\u670d\u52a1\u7684\u7aef\u53e3 \nSlurmUser=slurm    #slurm\u7684\u4e3b\u7528\u6237\n#SlurmdUser=root    #slurmd\u670d\u52a1\u7684\u542f\u52a8\u7528\u6237\n\n################################################\n#            LOGGING & OTHER PATHS             #\n################################################\nSlurmctldDebug=info\nSlurmctldLogFile=/var/log/slurm/slurmctld.log\nSlurmdDebug=info\nSlurmdLogFile=/var/log/slurm/slurmd.log\nSlurmctldPidFile=/var/run/slurmctld.pid\nSlurmdPidFile=/var/run/slurmd.pid\nSlurmdSpoolDir=/var/spool/slurmd\nStateSaveLocation=/var/spool/slurmctld\n\n################################################\n#                  ACCOUNTING                  #\n################################################\nAccountingStorageEnforce=associations,limits,qos  #account\u5b58\u50a8\u6570\u636e\u7684\u914d\u7f6e\u9009\u9879\nAccountingStorageHost=manage01    #\u6570\u636e\u5e93\u5b58\u50a8\u8282\u70b9\nAccountingStoragePass=/var/run/munge/munge.socket.2    #munge\u8ba4\u8bc1\u6587\u4ef6\uff0c\u4e0eslurmdbd.conf\u6587\u4ef6\u4e2d\u7684AuthInfo\u6587\u4ef6\u540c\u540d\u3002\nAccountingStoragePort=6819    #slurmd\u670d\u52a1\u76d1\u542c\u7aef\u53e3\uff0c\u9ed8\u8ba4\u4e3a6819\nAccountingStorageType=accounting_storage/slurmdbd    #\u6570\u636e\u5e93\u8bb0\u8d26\u670d\u52a1\n\n################################################\n#                      JOBS                    #\n################################################\nJobCompHost=localhost      #\u4f5c\u4e1a\u5b8c\u6210\u4fe1\u606f\u7684\u6570\u636e\u5e93\u672c\u8282\u70b9\nJobCompLoc=slurm_acct_db    #\u6570\u636e\u5e93\u540d\u79f0\nJobCompPass=123456    #slurm\u7528\u6237\u6570\u636e\u5e93\u5bc6\u7801\nJobCompPort=3306    #\u6570\u636e\u5e93\u7aef\u53e3\nJobCompType=jobcomp/mysql     #\u4f5c\u4e1a\u5b8c\u6210\u4fe1\u606f\u6570\u636e\u5b58\u50a8\u7c7b\u578b\uff0c\u91c7\u7528mysql\u6570\u636e\u5e93\nJobCompUser=slurm    #\u4f5c\u4e1a\u5b8c\u6210\u4fe1\u606f\u6570\u636e\u5e93\u7528\u6237\u540d\nJobContainerType=job_container/none\nJobAcctGatherFrequency=30\nJobAcctGatherType=jobacct_gather/linux\n\n################################################\n#           SCHEDULING & ALLOCATION            #\n################################################\nSchedulerType=sched/backfill\nSelectType=select/cons_tres\nSelectTypeParameters=CR_Core\n\n################################################\n#                    TIMERS                    #\n################################################\nInactiveLimit=0\nKillWait=30\nMinJobAge=300\nSlurmctldTimeout=120\nSlurmdTimeout=300\nWaittime=0\n\n################################################\n#                    OTHER                     #\n################################################\nMpiDefault=none\nProctrackType=proctrack/cgroup\nReturnToService=1\nSwitchType=switch/none\nTaskPlugin=task/affinity\n\n################################################\n#                    NODES                     #\n################################################\nNodeName=manage01 NodeAddr=192.168.29.106  CPUs=2 CoresPerSocket=1 ThreadsPerCore=1 RealMemory=200 Procs=1 State=UNKNOWN\nNodeName=login01 NodeAddr=192.168.29.101  CPUs=2 CoresPerSocket=1 ThreadsPerCore=1 RealMemory=200 Procs=1 State=UNKNOWN\nNodeName=compute0[1-2] NodeAddr=192.168.29.10[2-3]  CPUs=2 CoresPerSocket=1 ThreadsPerCore=1 RealMemory=200 Procs=1 State=UNKNOWN\n\n################################################\n#                  PARTITIONS                  #\n################################################\nPartitionName=compute Nodes=compute0[1-2] Default=YES MaxTime=INFINITE State=UP\n"})})}function m(n={}){const{wrapper:e}={...(0,t.a)(),...n.components};return e?(0,r.jsx)(e,{...n,children:(0,r.jsx)(a,{...n})}):a(n)}},57766:(n,e,o)=>{o.d(e,{Z:()=>l,a:()=>s});var r=o(70079);const t={},c=r.createContext(t);function s(n){const e=r.useContext(c);return r.useMemo((function(){return"function"==typeof n?n(e):{...e,...n}}),[e,n])}function l(n){let e;return e=n.disableParentContext?"function"==typeof n.components?n.components(t):n.components||t:s(n.components),r.createElement(c.Provider,{value:e},n.children)}}}]);