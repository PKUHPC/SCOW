"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[2205],{54852:(e,t,r)=>{r.d(t,{Zo:()=>s,kt:()=>m});var n=r(49231);function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function i(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function c(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?i(Object(r),!0).forEach((function(t){o(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):i(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function a(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}var p=n.createContext({}),l=function(e){var t=n.useContext(p),r=t;return e&&(r="function"==typeof e?e(t):c(c({},t),e)),r},s=function(e){var t=l(e.components);return n.createElement(p.Provider,{value:t},e.children)},d="mdxType",u={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},f=n.forwardRef((function(e,t){var r=e.components,o=e.mdxType,i=e.originalType,p=e.parentName,s=a(e,["components","mdxType","originalType","parentName"]),d=l(r),f=o,m=d["".concat(p,".").concat(f)]||d[f]||u[f]||i;return r?n.createElement(m,c(c({ref:t},s),{},{components:r})):n.createElement(m,c({ref:t},s))}));function m(e,t){var r=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var i=r.length,c=new Array(i);c[0]=f;var a={};for(var p in t)hasOwnProperty.call(t,p)&&(a[p]=t[p]);a.originalType=e,a[d]="string"==typeof e?e:o,c[1]=a;for(var l=2;l<i;l++)c[l]=r[l];return n.createElement.apply(null,c)}return n.createElement.apply(null,r)}f.displayName="MDXCreateElement"},36394:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>p,contentTitle:()=>c,default:()=>u,frontMatter:()=>i,metadata:()=>a,toc:()=>l});var n=r(45675),o=(r(49231),r(54852));const i={sidebar_position:1,title:"\u914d\u7f6e\u7b80\u4ecb"},c="\u914d\u7f6e\u7b80\u4ecb",a={unversionedId:"deploy/config/index",id:"deploy/config/index",title:"\u914d\u7f6e\u7b80\u4ecb",description:"SCOW\u4f7f\u7528\u914d\u7f6e\u6587\u4ef6\u8fdb\u884c\u7cfb\u7edf\u7684\u914d\u7f6e\u3002",source:"@site/docs/deploy/config/index.md",sourceDirName:"deploy/config",slug:"/deploy/config/",permalink:"/SCOW/pr-preview/pr-726/docs/deploy/config/",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/index.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1,title:"\u914d\u7f6e\u7b80\u4ecb"},sidebar:"deploy",previous:{title:"\u914d\u7f6e",permalink:"/SCOW/pr-preview/pr-726/docs/category/\u914d\u7f6e"},next:{title:"\u96c6\u7fa4\u914d\u7f6e\u6587\u4ef6",permalink:"/SCOW/pr-preview/pr-726/docs/deploy/config/cluster-config"}},p={},l=[],s={toc:l},d="wrapper";function u(e){let{components:t,...r}=e;return(0,o.kt)(d,(0,n.Z)({},s,r,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"\u914d\u7f6e\u7b80\u4ecb"},"\u914d\u7f6e\u7b80\u4ecb"),(0,o.kt)("p",null,"SCOW\u4f7f\u7528\u914d\u7f6e\u6587\u4ef6\u8fdb\u884c\u7cfb\u7edf\u7684\u914d\u7f6e\u3002"),(0,o.kt)("p",null,"SCOW\u7684\u914d\u7f6e\u6587\u4ef6\u5747\u4f7f\u7528",(0,o.kt)("inlineCode",{parentName:"p"},"yaml"),"\u6216\u8005",(0,o.kt)("inlineCode",{parentName:"p"},"JSON"),"\u683c\u5f0f\uff0c\u5b58\u653e\u4e8e",(0,o.kt)("inlineCode",{parentName:"p"},"config"),"\u76ee\u5f55\u4e0b\u3002"),(0,o.kt)("p",null,"\u9879\u76ee\u5728\u542f\u52a8\u65f6\u5c06\u4f1a\u68c0\u67e5\u914d\u7f6e\u6587\u4ef6\u662f\u5426\u7b26\u5408\u683c\u5f0f\uff0c\u5982\u679c\u914d\u7f6e\u6587\u4ef6\u6709\u9519\uff0c\u5219\u7cfb\u7edf\u4f1a\u76f4\u63a5\u62a5\u9519\u3002"),(0,o.kt)("p",null,"\u60a8\u4e5f\u53ef\u4ee5\u4f7f\u7528",(0,o.kt)("a",{parentName:"p",href:"/SCOW/pr-preview/pr-726/docs/deploy/install/scow-cli"},"scow-cli"),"\u7684",(0,o.kt)("inlineCode",{parentName:"p"},"check-config"),"\u5b50\u547d\u4ee4\uff0c\u5728\u4e0d\u8fd0\u884c\u7cfb\u7edf\u7684\u60c5\u51b5\u4e0b\u68c0\u67e5\u914d\u7f6e\u6587\u4ef6\u683c\u5f0f\u3002"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre"},"> ./cli check-config \n\nERROR: Error reading config file config/clusters/hpc01.yaml: data/slurm/loginNodes/0 must be string\nWARN: mis.yaml userIdPattern is deprecated and will be removed in a future version. Use createUser.userIdPattern instead\n")))}u.isMDXComponent=!0}}]);