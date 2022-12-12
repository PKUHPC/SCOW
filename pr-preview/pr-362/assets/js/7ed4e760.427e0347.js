"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[5338],{4852:(e,t,r)=>{r.d(t,{Zo:()=>c,kt:()=>m});var n=r(9231);function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function a(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function l(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?a(Object(r),!0).forEach((function(t){o(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):a(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function i(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},a=Object.keys(e);for(n=0;n<a.length;n++)r=a[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(n=0;n<a.length;n++)r=a[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}var p=n.createContext({}),s=function(e){var t=n.useContext(p),r=t;return e&&(r="function"==typeof e?e(t):l(l({},t),e)),r},c=function(e){var t=s(e.components);return n.createElement(p.Provider,{value:t},e.children)},d={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},u=n.forwardRef((function(e,t){var r=e.components,o=e.mdxType,a=e.originalType,p=e.parentName,c=i(e,["components","mdxType","originalType","parentName"]),u=s(r),m=o,f=u["".concat(p,".").concat(m)]||u[m]||d[m]||a;return r?n.createElement(f,l(l({ref:t},c),{},{components:r})):n.createElement(f,l({ref:t},c))}));function m(e,t){var r=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var a=r.length,l=new Array(a);l[0]=u;var i={};for(var p in t)hasOwnProperty.call(t,p)&&(i[p]=t[p]);i.originalType=e,i.mdxType="string"==typeof e?e:o,l[1]=i;for(var s=2;s<a;s++)l[s]=r[s];return n.createElement.apply(null,l)}return n.createElement.apply(null,r)}u.displayName="MDXCreateElement"},6746:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>p,contentTitle:()=>l,default:()=>d,frontMatter:()=>a,metadata:()=>i,toc:()=>s});var n=r(9675),o=(r(9231),r(4852));const a={sidebar_label:"\u6570\u636e\u76d8\u6302\u8f7d",title:"\u6570\u636e\u76d8\u6302\u8f7d",sidebar_position:6},l=void 0,i={unversionedId:"deploy/slurm/mount-disk",id:"deploy/slurm/mount-disk",title:"\u6570\u636e\u76d8\u6302\u8f7d",description:"\u5047\u8bbe\u5f85\u6302\u8f7d\u76d8\u7b26\u4e3a/dev/sdb\uff0c\u6302\u8f7d\u76ee\u5f55\u4e3a/data",source:"@site/docs/deploy/slurm/mount-disk.md",sourceDirName:"deploy/slurm",slug:"/deploy/slurm/mount-disk",permalink:"/SCOW/pr-preview/pr-362/docs/deploy/slurm/mount-disk",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/slurm/mount-disk.md",tags:[],version:"current",sidebarPosition:6,frontMatter:{sidebar_label:"\u6570\u636e\u76d8\u6302\u8f7d",title:"\u6570\u636e\u76d8\u6302\u8f7d",sidebar_position:6},sidebar:"deploy",previous:{title:"slurm\u96c6\u7fa4\u90e8\u7f72",permalink:"/SCOW/pr-preview/pr-362/docs/slurm"},next:{title:"LDAP\u65b0\u5efa\u7528\u6237",permalink:"/SCOW/pr-preview/pr-362/docs/deploy/slurm/add-user"}},p={},s=[],c={toc:s};function d(e){let{components:t,...a}=e;return(0,o.kt)("wrapper",(0,n.Z)({},c,a,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("blockquote",null,(0,o.kt)("p",{parentName:"blockquote"},"\u5047\u8bbe\u5f85\u6302\u8f7d\u76d8\u7b26\u4e3a",(0,o.kt)("inlineCode",{parentName:"p"},"/dev/sdb"),"\uff0c\u6302\u8f7d\u76ee\u5f55\u4e3a",(0,o.kt)("inlineCode",{parentName:"p"},"/data"))),(0,o.kt)("p",null,"\u67e5\u770b\u51c6\u5907\u7684\u78c1\u76d8\uff1a"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre"},"fdisk -l\n")),(0,o.kt)("p",null,(0,o.kt)("img",{alt:"img",src:r(1126).Z,width:"1048",height:"738"})),(0,o.kt)("p",null,"\u521b\u5efa\u78c1\u76d8\u5206\u533a\uff1a"),(0,o.kt)("p",null,(0,o.kt)("inlineCode",{parentName:"p"},"fdisk /dev/sdb")," \uff0c\u4f9d\u6b21\u8f93\u5165\uff1an, p, 1, \u4e24\u6b21\u56de\u8f66, wq"),(0,o.kt)("p",null,(0,o.kt)("img",{alt:"img",src:r(2068).Z,width:"914",height:"581"})),(0,o.kt)("p",null,"\u683c\u5f0f\u5316\u78c1\u76d8\uff1a"),(0,o.kt)("p",null,(0,o.kt)("inlineCode",{parentName:"p"},"mkfs.ext4 /dev/sdb"),"\uff0c\u8f93\u5165\uff1ay"),(0,o.kt)("p",null,(0,o.kt)("img",{alt:"img",src:r(3369).Z,width:"767",height:"543"})),(0,o.kt)("p",null,"\u6302\u8f7d\u78c1\u76d8\uff1a"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-PowerShell"},"# 1. \u5efa\u7acb\u6302\u8f7d\u76ee\u5f55\n mkdir -p /data\n\n# 2. \u6302\u8f7d\u786c\u76d8\n mount /dev/sdb /data\n\n# 3. \u8bbe\u7f6e\u5f00\u673a\u81ea\u52a8\u6302\u8f7d\nvim /etc/fstab\n# \u5728\u6587\u6863\u672b\u5c3e\u6dfb\u52a0\n/dev/sdb        /data   ext4    defaults        0       0    \n\n# 4. \u91cd\u542f\u751f\u6548\nreboot\n")))}d.isMDXComponent=!0},1126:(e,t,r)=>{r.d(t,{Z:()=>n});const n=r.p+"assets/images/-8-1-98f4acb6a06731634dd622623661ef0a.png"},2068:(e,t,r)=>{r.d(t,{Z:()=>n});const n=r.p+"assets/images/-8-2-98386af57ed61941286eb62f36f7a00c.png"},3369:(e,t,r)=>{r.d(t,{Z:()=>n});const n=r.p+"assets/images/-8-3-59eb28c9faf44c4ac944c9a2a489be3b.png"}}]);