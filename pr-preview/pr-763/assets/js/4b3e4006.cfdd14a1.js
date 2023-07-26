"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[9393],{54852:(e,r,t)=>{t.d(r,{Zo:()=>a,kt:()=>m});var n=t(49231);function o(e,r,t){return r in e?Object.defineProperty(e,r,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[r]=t,e}function c(e,r){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);r&&(n=n.filter((function(r){return Object.getOwnPropertyDescriptor(e,r).enumerable}))),t.push.apply(t,n)}return t}function l(e){for(var r=1;r<arguments.length;r++){var t=null!=arguments[r]?arguments[r]:{};r%2?c(Object(t),!0).forEach((function(r){o(e,r,t[r])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):c(Object(t)).forEach((function(r){Object.defineProperty(e,r,Object.getOwnPropertyDescriptor(t,r))}))}return e}function s(e,r){if(null==e)return{};var t,n,o=function(e,r){if(null==e)return{};var t,n,o={},c=Object.keys(e);for(n=0;n<c.length;n++)t=c[n],r.indexOf(t)>=0||(o[t]=e[t]);return o}(e,r);if(Object.getOwnPropertySymbols){var c=Object.getOwnPropertySymbols(e);for(n=0;n<c.length;n++)t=c[n],r.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(o[t]=e[t])}return o}var u=n.createContext({}),i=function(e){var r=n.useContext(u),t=r;return e&&(t="function"==typeof e?e(r):l(l({},r),e)),t},a=function(e){var r=i(e.components);return n.createElement(u.Provider,{value:r},e.children)},p="mdxType",d={inlineCode:"code",wrapper:function(e){var r=e.children;return n.createElement(n.Fragment,{},r)}},f=n.forwardRef((function(e,r){var t=e.components,o=e.mdxType,c=e.originalType,u=e.parentName,a=s(e,["components","mdxType","originalType","parentName"]),p=i(t),f=o,m=p["".concat(u,".").concat(f)]||p[f]||d[f]||c;return t?n.createElement(m,l(l({ref:r},a),{},{components:t})):n.createElement(m,l({ref:r},a))}));function m(e,r){var t=arguments,o=r&&r.mdxType;if("string"==typeof e||o){var c=t.length,l=new Array(c);l[0]=f;var s={};for(var u in r)hasOwnProperty.call(r,u)&&(s[u]=r[u]);s.originalType=e,s[p]="string"==typeof e?e:o,l[1]=s;for(var i=2;i<c;i++)l[i]=t[i];return n.createElement.apply(null,l)}return n.createElement.apply(null,t)}f.displayName="MDXCreateElement"},65358:(e,r,t)=>{t.r(r),t.d(r,{assets:()=>u,contentTitle:()=>l,default:()=>d,frontMatter:()=>c,metadata:()=>s,toc:()=>i});var n=t(45675),o=(t(49231),t(54852));const c={title:"slurmdbd.conf \u914d\u7f6e",sidebar_position:3},l=void 0,s={unversionedId:"hpccluster/config/slurmdbd.conf",id:"hpccluster/config/slurmdbd.conf",title:"slurmdbd.conf \u914d\u7f6e",description:"",source:"@site/docs/hpccluster/config/slurmdbd.conf.md",sourceDirName:"hpccluster/config",slug:"/hpccluster/config/slurmdbd.conf",permalink:"/SCOW/pr-preview/pr-763/docs/hpccluster/config/slurmdbd.conf",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/hpccluster/config/slurmdbd.conf.md",tags:[],version:"current",sidebarPosition:3,frontMatter:{title:"slurmdbd.conf \u914d\u7f6e",sidebar_position:3},sidebar:"hpccluster",previous:{title:"slurm.conf \u914d\u7f6e",permalink:"/SCOW/pr-preview/pr-763/docs/hpccluster/config/slurm.conf"},next:{title:"slurm\u96c6\u7fa4\u90e8\u7f72",permalink:"/SCOW/pr-preview/pr-763/docs/slurm"}},u={},i=[],a={toc:i},p="wrapper";function d(e){let{components:r,...t}=e;return(0,o.kt)(p,(0,n.Z)({},a,t,{components:r,mdxType:"MDXLayout"}),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-Properties"},"#\n# slurmdbd.conf file.\n#\n# See the slurmdbd.conf man page for more information.\n#\n# Authentication info\nAuthType=auth/munge     #\u8ba4\u8bc1\u65b9\u5f0f\uff0c\u8be5\u5904\u91c7\u7528munge\u8fdb\u884c\u8ba4\u8bc1\nAuthInfo=/var/run/munge/munge.socket.2     #\u4e3a\u4e86\u4e0eslurmctld\u63a7\u5236\u8282\u70b9\u901a\u4fe1\u7684\u5176\u5b83\u8ba4\u8bc1\u4fe1\u606f\n#\n# slurmDBD info\nDbdAddr=localhost      #\u6570\u636e\u5e93\u8282\u70b9\u540d\nDbdHost=localhost     #\u6570\u636e\u5e93IP\u5730\u5740\nSlurmUser=slurm     #\u7528\u6237\u6570\u636e\u5e93\u64cd\u4f5c\u7684\u7528\u6237\nDebugLevel=verbose     #\u8c03\u8bd5\u4fe1\u606f\u7ea7\u522b\uff0cquiet\uff1a\u65e0\u8c03\u8bd5\u4fe1\u606f\uff1bfatal\uff1a\u4ec5\u4e25\u91cd\u9519\u8bef\u4fe1\u606f\uff1berror\uff1a\u4ec5\u9519\u8bef\u4fe1\u606f\uff1b info\uff1a\u9519\u8bef\u4e0e\u901a\u5e38\u4fe1\u606f\uff1bverbose\uff1a\u9519\u8bef\u548c\u8be6\u7ec6\u4fe1\u606f\uff1bdebug\uff1a\u9519\u8bef\u3001\u8be6\u7ec6\u548c\u8c03\u8bd5\u4fe1\u606f\uff1bdebug2\uff1a\u9519\u8bef\u3001\u8be6\u7ec6\u548c\u66f4\u591a\u8c03\u8bd5\u4fe1\u606f\uff1bdebug3\uff1a\u9519\u8bef\u3001\u8be6\u7ec6\u548c\u751a\u81f3\u66f4\u591a\u8c03\u8bd5\u4fe1\u606f\uff1bdebug4\uff1a\u9519\u8bef\u3001\u8be6\u7ec6\u548c\u751a\u81f3\u66f4\u591a\u8c03\u8bd5\u4fe1\u606f\uff1bdebug5\uff1a\u9519\u8bef\u3001\u8be6\u7ec6\u548c\u751a\u81f3\u66f4\u591a\u8c03\u8bd5\u4fe1\u606f\u3002debug\u6570\u5b57\u8d8a\u5927\uff0c\u4fe1\u606f\u8d8a\u8be6\u7ec6\nLogFile=/var/log/slurm/slurmdbd.log     #slurmdbd\u5b88\u62a4\u8fdb\u7a0b\u65e5\u5fd7\u6587\u4ef6\u7edd\u5bf9\u8def\u5f84 \nPidFile=/var/run/slurmdbd.pid     #slurmdbd\u5b88\u62a4\u8fdb\u7a0b\u5b58\u50a8\u8fdb\u7a0b\u53f7\u6587\u4ef6\u7edd\u5bf9\u8def\u5f84\n#\n# Database info\nStorageType=accounting_storage/mysql     #\u6570\u636e\u5b58\u50a8\u7c7b\u578b\nStoragePass=123456     #\u5b58\u50a8\u6570\u636e\u5e93\u5bc6\u7801\nStorageUser=slurm     #\u5b58\u50a8\u6570\u636e\u5e93\u7528\u6237\u540d\nStorageLoc=slurm_acct_db     #\u6570\u636e\u5e93\u540d\u79f0\n")))}d.isMDXComponent=!0}}]);