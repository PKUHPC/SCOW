"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[8042],{4852:(e,t,r)=>{r.d(t,{Zo:()=>s,kt:()=>m});var n=r(9231);function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function l(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function a(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?l(Object(r),!0).forEach((function(t){o(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):l(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function i(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},l=Object.keys(e);for(n=0;n<l.length;n++)r=l[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var l=Object.getOwnPropertySymbols(e);for(n=0;n<l.length;n++)r=l[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}var p=n.createContext({}),c=function(e){var t=n.useContext(p),r=t;return e&&(r="function"==typeof e?e(t):a(a({},t),e)),r},s=function(e){var t=c(e.components);return n.createElement(p.Provider,{value:t},e.children)},u={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},d=n.forwardRef((function(e,t){var r=e.components,o=e.mdxType,l=e.originalType,p=e.parentName,s=i(e,["components","mdxType","originalType","parentName"]),d=c(r),m=o,f=d["".concat(p,".").concat(m)]||d[m]||u[m]||l;return r?n.createElement(f,a(a({ref:t},s),{},{components:r})):n.createElement(f,a({ref:t},s))}));function m(e,t){var r=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var l=r.length,a=new Array(l);a[0]=d;var i={};for(var p in t)hasOwnProperty.call(t,p)&&(i[p]=t[p]);i.originalType=e,i.mdxType="string"==typeof e?e:o,a[1]=i;for(var c=2;c<l;c++)a[c]=r[c];return n.createElement.apply(null,a)}return n.createElement.apply(null,r)}d.displayName="MDXCreateElement"},1108:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>p,contentTitle:()=>a,default:()=>u,frontMatter:()=>l,metadata:()=>i,toc:()=>c});var n=r(9675),o=(r(9231),r(4852));const l={sidebar_position:1,title:"\u90e8\u7f72\u7b80\u4ecb"},a=void 0,i={unversionedId:"deploy/index",id:"deploy/index",title:"\u90e8\u7f72\u7b80\u4ecb",description:"\u672c\u6587\u6863\u5305\u542b\u4e00\u6574\u5957HPC\u96c6\u7fa4\u90e8\u7f72\uff0c\u5305\u62ecslurm\u3001ldap\u3001nfs\u3001SCOW\u7b49\u3002",source:"@site/docs/deploy/index.md",sourceDirName:"deploy",slug:"/deploy/",permalink:"/SCOW/docs/deploy/",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/index.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1,title:"\u90e8\u7f72\u7b80\u4ecb"},sidebar:"deploy",next:{title:"SCOW\u90e8\u7f72\u7b80\u4ecb",permalink:"/SCOW/docs/deploy/SCOW/"}},p={},c=[],s={toc:c};function u(e){let{components:t,...r}=e;return(0,o.kt)("wrapper",(0,n.Z)({},s,r,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("p",null,"\u672c\u6587\u6863\u5305\u542b\u4e00\u6574\u5957HPC\u96c6\u7fa4\u90e8\u7f72\uff0c\u5305\u62ecslurm\u3001ldap\u3001nfs\u3001SCOW\u7b49\u3002"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},"\u5df2\u7ecf\u90e8\u7f72\u597d\u4e86slurm\u7b49\uff0c\u53ea\u9700\u90e8\u7f72SCOW\uff0c\u53ef\u4ece",(0,o.kt)("a",{parentName:"li",href:"/SCOW/docs/deploy/SCOW/"},"SCOW\u90e8\u7f72"),"\u5f00\u59cb"),(0,o.kt)("li",{parentName:"ul"},"\u4ece0\u5f00\u59cb\uff0c\u53ef\u4ece",(0,o.kt)("a",{parentName:"li",href:"/SCOW/docs/deploy/slurm/"},"slurm\u90e8\u7f72"),"\u5f00\u59cb"),(0,o.kt)("li",{parentName:"ul"},"\u90e8\u7f72\u5171\u4eab\u5b58\u50a8\uff0c\u53ef\u53c2\u8003",(0,o.kt)("a",{parentName:"li",href:"/SCOW/docs/deploy/slurm/nfs"},"NFS\u5b89\u88c5\u548c\u914d\u7f6e")),(0,o.kt)("li",{parentName:"ul"},"\u90e8\u7f72LDAP\uff0c\u53ef\u53c2\u8003",(0,o.kt)("a",{parentName:"li",href:"/SCOW/docs/deploy/SCOW/auth/ldap"},"LDAP\u8ba4\u8bc1\u7cfb\u7edf")),(0,o.kt)("li",{parentName:"ul"},"\u5b89\u88c5module\u3001intel\u7b49\u5de5\u5177\u8f6f\u4ef6\uff0c\u53ef\u4ee5\u53c2\u8003",(0,o.kt)("a",{parentName:"li",href:"/SCOW/docs/deploy/slurm/module"},"module\u5b89\u88c5"),"\uff0c",(0,o.kt)("a",{parentName:"li",href:"/SCOW/docs/deploy/slurm/intel"},"intel\u7f16\u8bd1\u5668\u5b89\u88c5"))))}u.isMDXComponent=!0}}]);