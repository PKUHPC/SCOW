"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[9387],{54852:(e,t,r)=>{r.d(t,{Zo:()=>s,kt:()=>f});var n=r(49231);function a(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function o(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function i(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?o(Object(r),!0).forEach((function(t){a(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):o(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function c(e,t){if(null==e)return{};var r,n,a=function(e,t){if(null==e)return{};var r,n,a={},o=Object.keys(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||(a[r]=e[r]);return a}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(a[r]=e[r])}return a}var l=n.createContext({}),p=function(e){var t=n.useContext(l),r=t;return e&&(r="function"==typeof e?e(t):i(i({},t),e)),r},s=function(e){var t=p(e.components);return n.createElement(l.Provider,{value:t},e.children)},u="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},m=n.forwardRef((function(e,t){var r=e.components,a=e.mdxType,o=e.originalType,l=e.parentName,s=c(e,["components","mdxType","originalType","parentName"]),u=p(r),m=a,f=u["".concat(l,".").concat(m)]||u[m]||d[m]||o;return r?n.createElement(f,i(i({ref:t},s),{},{components:r})):n.createElement(f,i({ref:t},s))}));function f(e,t){var r=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var o=r.length,i=new Array(o);i[0]=m;var c={};for(var l in t)hasOwnProperty.call(t,l)&&(c[l]=t[l]);c.originalType=e,c[u]="string"==typeof e?e:a,i[1]=c;for(var p=2;p<o;p++)i[p]=r[p];return n.createElement.apply(null,i)}return n.createElement.apply(null,r)}m.displayName="MDXCreateElement"},35709:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>d,frontMatter:()=>o,metadata:()=>c,toc:()=>p});var n=r(95907),a=(r(49231),r(54852));const o={sidebar_label:"\u6570\u636e\u76d8\u6302\u8f7d",title:"\u6570\u636e\u76d8\u6302\u8f7d",sidebar_position:6},i=void 0,c={unversionedId:"hpccluster/mount-disk",id:"hpccluster/mount-disk",title:"\u6570\u636e\u76d8\u6302\u8f7d",description:"\u5047\u8bbe\u5f85\u6302\u8f7d\u76d8\u7b26\u4e3a/dev/sdb\uff0c\u6302\u8f7d\u76ee\u5f55\u4e3a/data",source:"@site/docs/hpccluster/mount-disk.md",sourceDirName:"hpccluster",slug:"/hpccluster/mount-disk",permalink:"/SCOW/pr-preview/pr-704/docs/hpccluster/mount-disk",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/hpccluster/mount-disk.md",tags:[],version:"current",sidebarPosition:6,frontMatter:{sidebar_label:"\u6570\u636e\u76d8\u6302\u8f7d",title:"\u6570\u636e\u76d8\u6302\u8f7d",sidebar_position:6},sidebar:"hpccluster",previous:{title:"slurm\u96c6\u7fa4\u90e8\u7f72",permalink:"/SCOW/pr-preview/pr-704/docs/slurm"},next:{title:"LDAP\u65b0\u5efa\u7528\u6237",permalink:"/SCOW/pr-preview/pr-704/docs/hpccluster/add-user"}},l={},p=[],s={toc:p},u="wrapper";function d(e){let{components:t,...o}=e;return(0,a.kt)(u,(0,n.Z)({},s,o,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("blockquote",null,(0,a.kt)("p",{parentName:"blockquote"},"\u5047\u8bbe\u5f85\u6302\u8f7d\u76d8\u7b26\u4e3a",(0,a.kt)("inlineCode",{parentName:"p"},"/dev/sdb"),"\uff0c\u6302\u8f7d\u76ee\u5f55\u4e3a",(0,a.kt)("inlineCode",{parentName:"p"},"/data"))),(0,a.kt)("p",null,"\u67e5\u770b\u51c6\u5907\u7684\u78c1\u76d8\uff1a"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre"},"fdisk -l\n")),(0,a.kt)("p",null,(0,a.kt)("img",{alt:"img",src:r(90533).Z,width:"1048",height:"738"})),(0,a.kt)("p",null,"\u521b\u5efa\u78c1\u76d8\u5206\u533a\uff1a"),(0,a.kt)("p",null,(0,a.kt)("inlineCode",{parentName:"p"},"fdisk /dev/sdb")," \uff0c\u4f9d\u6b21\u8f93\u5165\uff1an, p, 1, \u4e24\u6b21\u56de\u8f66, wq"),(0,a.kt)("p",null,(0,a.kt)("img",{alt:"img",src:r(88384).Z,width:"914",height:"581"})),(0,a.kt)("p",null,"\u683c\u5f0f\u5316\u78c1\u76d8\uff1a"),(0,a.kt)("p",null,(0,a.kt)("inlineCode",{parentName:"p"},"mkfs.ext4 /dev/sdb"),"\uff0c\u8f93\u5165\uff1ay"),(0,a.kt)("p",null,(0,a.kt)("img",{alt:"img",src:r(35517).Z,width:"767",height:"543"})),(0,a.kt)("p",null,"\u6302\u8f7d\u78c1\u76d8\uff1a"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-PowerShell"},"# 1. \u5efa\u7acb\u6302\u8f7d\u76ee\u5f55\n mkdir -p /data\n\n# 2. \u6302\u8f7d\u786c\u76d8\n mount /dev/sdb /data\n\n# 3. \u8bbe\u7f6e\u5f00\u673a\u81ea\u52a8\u6302\u8f7d\nvim /etc/fstab\n# \u5728\u6587\u6863\u672b\u5c3e\u6dfb\u52a0\n/dev/sdb        /data   ext4    defaults        0       0    \n\n# 4. \u91cd\u542f\u751f\u6548\nreboot\n")))}d.isMDXComponent=!0},90533:(e,t,r)=>{r.d(t,{Z:()=>n});const n=r.p+"assets/images/-8-1-98f4acb6a06731634dd622623661ef0a.png"},88384:(e,t,r)=>{r.d(t,{Z:()=>n});const n=r.p+"assets/images/-8-2-98386af57ed61941286eb62f36f7a00c.png"},35517:(e,t,r)=>{r.d(t,{Z:()=>n});const n=r.p+"assets/images/-8-3-59eb28c9faf44c4ac944c9a2a489be3b.png"}}]);