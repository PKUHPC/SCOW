"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[9387],{4852:(e,t,n)=>{n.d(t,{Zo:()=>p,kt:()=>f});var r=n(9231);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function c(e,t){if(null==e)return{};var n,r,a=function(e,t){if(null==e)return{};var n,r,a={},o=Object.keys(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var l=r.createContext({}),s=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},p=function(e){var t=s(e.components);return r.createElement(l.Provider,{value:t},e.children)},u="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},m=r.forwardRef((function(e,t){var n=e.components,a=e.mdxType,o=e.originalType,l=e.parentName,p=c(e,["components","mdxType","originalType","parentName"]),u=s(n),m=a,f=u["".concat(l,".").concat(m)]||u[m]||d[m]||o;return n?r.createElement(f,i(i({ref:t},p),{},{components:n})):r.createElement(f,i({ref:t},p))}));function f(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var o=n.length,i=new Array(o);i[0]=m;var c={};for(var l in t)hasOwnProperty.call(t,l)&&(c[l]=t[l]);c.originalType=e,c[u]="string"==typeof e?e:a,i[1]=c;for(var s=2;s<o;s++)i[s]=n[s];return r.createElement.apply(null,i)}return r.createElement.apply(null,n)}m.displayName="MDXCreateElement"},55:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>d,frontMatter:()=>o,metadata:()=>c,toc:()=>s});var r=n(5675),a=(n(9231),n(4852));const o={sidebar_label:"\u6570\u636e\u76d8\u6302\u8f7d",title:"\u6570\u636e\u76d8\u6302\u8f7d",sidebar_position:6},i=void 0,c={unversionedId:"hpccluster/mount-disk",id:"hpccluster/mount-disk",title:"\u6570\u636e\u76d8\u6302\u8f7d",description:"\u5047\u8bbe\u5f85\u6302\u8f7d\u76d8\u7b26\u4e3a/dev/sdb\uff0c\u6302\u8f7d\u76ee\u5f55\u4e3a/data",source:"@site/docs/hpccluster/mount-disk.md",sourceDirName:"hpccluster",slug:"/hpccluster/mount-disk",permalink:"/SCOW/docs/hpccluster/mount-disk",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/hpccluster/mount-disk.md",tags:[],version:"current",sidebarPosition:6,frontMatter:{sidebar_label:"\u6570\u636e\u76d8\u6302\u8f7d",title:"\u6570\u636e\u76d8\u6302\u8f7d",sidebar_position:6},sidebar:"hpccluster",previous:{title:"slurm\u96c6\u7fa4\u90e8\u7f72",permalink:"/SCOW/docs/slurm"},next:{title:"LDAP\u65b0\u5efa\u7528\u6237",permalink:"/SCOW/docs/hpccluster/add-user"}},l={},s=[],p={toc:s},u="wrapper";function d(e){let{components:t,...o}=e;return(0,a.kt)(u,(0,r.Z)({},p,o,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("blockquote",null,(0,a.kt)("p",{parentName:"blockquote"},"\u5047\u8bbe\u5f85\u6302\u8f7d\u76d8\u7b26\u4e3a",(0,a.kt)("inlineCode",{parentName:"p"},"/dev/sdb"),"\uff0c\u6302\u8f7d\u76ee\u5f55\u4e3a",(0,a.kt)("inlineCode",{parentName:"p"},"/data"))),(0,a.kt)("p",null,"\u67e5\u770b\u51c6\u5907\u7684\u78c1\u76d8\uff1a"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre"},"fdisk -l\n")),(0,a.kt)("p",null,(0,a.kt)("img",{alt:"img",src:n(18).Z,width:"1048",height:"738"})),(0,a.kt)("p",null,"\u521b\u5efa\u78c1\u76d8\u5206\u533a\uff1a"),(0,a.kt)("p",null,(0,a.kt)("inlineCode",{parentName:"p"},"fdisk /dev/sdb")," \uff0c\u4f9d\u6b21\u8f93\u5165\uff1an, p, 1, \u4e24\u6b21\u56de\u8f66, wq"),(0,a.kt)("p",null,(0,a.kt)("img",{alt:"img",src:n(5331).Z,width:"914",height:"581"})),(0,a.kt)("p",null,"\u683c\u5f0f\u5316\u78c1\u76d8\uff1a"),(0,a.kt)("p",null,(0,a.kt)("inlineCode",{parentName:"p"},"mkfs.ext4 /dev/sdb"),"\uff0c\u8f93\u5165\uff1ay"),(0,a.kt)("p",null,(0,a.kt)("img",{alt:"img",src:n(6091).Z,width:"767",height:"543"})),(0,a.kt)("p",null,"\u6302\u8f7d\u78c1\u76d8\uff1a"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-PowerShell"},"# 1. \u5efa\u7acb\u6302\u8f7d\u76ee\u5f55\n mkdir -p /data\n\n# 2. \u6302\u8f7d\u786c\u76d8\n mount /dev/sdb /data\n\n# 3. \u8bbe\u7f6e\u5f00\u673a\u81ea\u52a8\u6302\u8f7d\nvim /etc/fstab\n# \u5728\u6587\u6863\u672b\u5c3e\u6dfb\u52a0\n/dev/sdb        /data   ext4    defaults        0       0    \n\n# 4. \u91cd\u542f\u751f\u6548\nreboot\n")))}d.isMDXComponent=!0},18:(e,t,n)=>{n.d(t,{Z:()=>r});const r=n.p+"assets/images/-8-1-98f4acb6a06731634dd622623661ef0a.png"},5331:(e,t,n)=>{n.d(t,{Z:()=>r});const r=n.p+"assets/images/-8-2-98386af57ed61941286eb62f36f7a00c.png"},6091:(e,t,n)=>{n.d(t,{Z:()=>r});const r=n.p+"assets/images/-8-3-59eb28c9faf44c4ac944c9a2a489be3b.png"}}]);