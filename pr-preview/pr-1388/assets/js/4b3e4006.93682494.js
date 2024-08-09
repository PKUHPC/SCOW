"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[1959],{6631:(e,n,r)=>{r.r(n),r.d(n,{assets:()=>d,contentTitle:()=>c,default:()=>a,frontMatter:()=>s,metadata:()=>u,toc:()=>i});var t=r(49214),o=r(5409);const s={title:"slurmdbd.conf \u914d\u7f6e",sidebar_position:3},c=void 0,u={id:"hpccluster/config/slurmdbd.conf",title:"slurmdbd.conf \u914d\u7f6e",description:"",source:"@site/docs/hpccluster/config/slurmdbd.conf.md",sourceDirName:"hpccluster/config",slug:"/hpccluster/config/slurmdbd.conf",permalink:"/SCOW/pr-preview/pr-1388/docs/hpccluster/config/slurmdbd.conf",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/hpccluster/config/slurmdbd.conf.md",tags:[],version:"current",sidebarPosition:3,frontMatter:{title:"slurmdbd.conf \u914d\u7f6e",sidebar_position:3},sidebar:"hpccluster",previous:{title:"slurm.conf \u914d\u7f6e",permalink:"/SCOW/pr-preview/pr-1388/docs/hpccluster/config/slurm.conf"},next:{title:"slurm\u96c6\u7fa4\u90e8\u7f72",permalink:"/SCOW/pr-preview/pr-1388/docs/slurm"}},d={},i=[];function l(e){const n={code:"code",pre:"pre",...(0,o.R)(),...e.components};return(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-Properties",children:"#\n# slurmdbd.conf file.\n#\n# See the slurmdbd.conf man page for more information.\n#\n# Authentication info\nAuthType=auth/munge     #\u8ba4\u8bc1\u65b9\u5f0f\uff0c\u8be5\u5904\u91c7\u7528munge\u8fdb\u884c\u8ba4\u8bc1\nAuthInfo=/var/run/munge/munge.socket.2     #\u4e3a\u4e86\u4e0eslurmctld\u63a7\u5236\u8282\u70b9\u901a\u4fe1\u7684\u5176\u5b83\u8ba4\u8bc1\u4fe1\u606f\n#\n# slurmDBD info\nDbdAddr=localhost      #\u6570\u636e\u5e93\u8282\u70b9\u540d\nDbdHost=localhost     #\u6570\u636e\u5e93IP\u5730\u5740\nSlurmUser=slurm     #\u7528\u6237\u6570\u636e\u5e93\u64cd\u4f5c\u7684\u7528\u6237\nDebugLevel=verbose     #\u8c03\u8bd5\u4fe1\u606f\u7ea7\u522b\uff0cquiet\uff1a\u65e0\u8c03\u8bd5\u4fe1\u606f\uff1bfatal\uff1a\u4ec5\u4e25\u91cd\u9519\u8bef\u4fe1\u606f\uff1berror\uff1a\u4ec5\u9519\u8bef\u4fe1\u606f\uff1b info\uff1a\u9519\u8bef\u4e0e\u901a\u5e38\u4fe1\u606f\uff1bverbose\uff1a\u9519\u8bef\u548c\u8be6\u7ec6\u4fe1\u606f\uff1bdebug\uff1a\u9519\u8bef\u3001\u8be6\u7ec6\u548c\u8c03\u8bd5\u4fe1\u606f\uff1bdebug2\uff1a\u9519\u8bef\u3001\u8be6\u7ec6\u548c\u66f4\u591a\u8c03\u8bd5\u4fe1\u606f\uff1bdebug3\uff1a\u9519\u8bef\u3001\u8be6\u7ec6\u548c\u751a\u81f3\u66f4\u591a\u8c03\u8bd5\u4fe1\u606f\uff1bdebug4\uff1a\u9519\u8bef\u3001\u8be6\u7ec6\u548c\u751a\u81f3\u66f4\u591a\u8c03\u8bd5\u4fe1\u606f\uff1bdebug5\uff1a\u9519\u8bef\u3001\u8be6\u7ec6\u548c\u751a\u81f3\u66f4\u591a\u8c03\u8bd5\u4fe1\u606f\u3002debug\u6570\u5b57\u8d8a\u5927\uff0c\u4fe1\u606f\u8d8a\u8be6\u7ec6\nLogFile=/var/log/slurm/slurmdbd.log     #slurmdbd\u5b88\u62a4\u8fdb\u7a0b\u65e5\u5fd7\u6587\u4ef6\u7edd\u5bf9\u8def\u5f84 \nPidFile=/var/run/slurmdbd.pid     #slurmdbd\u5b88\u62a4\u8fdb\u7a0b\u5b58\u50a8\u8fdb\u7a0b\u53f7\u6587\u4ef6\u7edd\u5bf9\u8def\u5f84\n#\n# Database info\nStorageType=accounting_storage/mysql     #\u6570\u636e\u5b58\u50a8\u7c7b\u578b\nStoragePass=123456     #\u5b58\u50a8\u6570\u636e\u5e93\u5bc6\u7801\nStorageUser=slurm     #\u5b58\u50a8\u6570\u636e\u5e93\u7528\u6237\u540d\nStorageLoc=slurm_acct_db     #\u6570\u636e\u5e93\u540d\u79f0\n"})})}function a(e={}){const{wrapper:n}={...(0,o.R)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(l,{...e})}):l(e)}},5409:(e,n,r)=>{r.d(n,{R:()=>c,x:()=>u});var t=r(48318);const o={},s=t.createContext(o);function c(e){const n=t.useContext(s);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function u(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(o):e.components||o:c(e.components),t.createElement(s.Provider,{value:n},e.children)}}}]);