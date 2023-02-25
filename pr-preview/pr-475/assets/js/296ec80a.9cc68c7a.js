"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[2205],{4852:(e,t,r)=>{r.d(t,{Zo:()=>s,kt:()=>f});var n=r(9231);function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function i(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function c(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?i(Object(r),!0).forEach((function(t){o(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):i(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function p(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}var a=n.createContext({}),l=function(e){var t=n.useContext(a),r=t;return e&&(r="function"==typeof e?e(t):c(c({},t),e)),r},s=function(e){var t=l(e.components);return n.createElement(a.Provider,{value:t},e.children)},d={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},u=n.forwardRef((function(e,t){var r=e.components,o=e.mdxType,i=e.originalType,a=e.parentName,s=p(e,["components","mdxType","originalType","parentName"]),u=l(r),f=o,y=u["".concat(a,".").concat(f)]||u[f]||d[f]||i;return r?n.createElement(y,c(c({ref:t},s),{},{components:r})):n.createElement(y,c({ref:t},s))}));function f(e,t){var r=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var i=r.length,c=new Array(i);c[0]=u;var p={};for(var a in t)hasOwnProperty.call(t,a)&&(p[a]=t[a]);p.originalType=e,p.mdxType="string"==typeof e?e:o,c[1]=p;for(var l=2;l<i;l++)c[l]=r[l];return n.createElement.apply(null,c)}return n.createElement.apply(null,r)}u.displayName="MDXCreateElement"},4134:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>a,contentTitle:()=>c,default:()=>d,frontMatter:()=>i,metadata:()=>p,toc:()=>l});var n=r(9675),o=(r(9231),r(4852));const i={sidebar_position:1,title:"\u914d\u7f6e\u7b80\u4ecb"},c="\u914d\u7f6e\u7b80\u4ecb",p={unversionedId:"deploy/config/index",id:"deploy/config/index",title:"\u914d\u7f6e\u7b80\u4ecb",description:"SCOW\u4f7f\u7528\u914d\u7f6e\u6587\u4ef6\u8fdb\u884c\u7cfb\u7edf\u7684\u914d\u7f6e\u3002",source:"@site/docs/deploy/config/index.md",sourceDirName:"deploy/config",slug:"/deploy/config/",permalink:"/SCOW/pr-preview/pr-475/docs/deploy/config/",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/index.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1,title:"\u914d\u7f6e\u7b80\u4ecb"},sidebar:"deploy",previous:{title:"\u914d\u7f6e",permalink:"/SCOW/pr-preview/pr-475/docs/category/\u914d\u7f6e"},next:{title:"\u96c6\u7fa4\u914d\u7f6e\u6587\u4ef6",permalink:"/SCOW/pr-preview/pr-475/docs/deploy/config/cluster-config"}},a={},l=[],s={toc:l};function d(e){let{components:t,...r}=e;return(0,o.kt)("wrapper",(0,n.Z)({},s,r,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"\u914d\u7f6e\u7b80\u4ecb"},"\u914d\u7f6e\u7b80\u4ecb"),(0,o.kt)("p",null,"SCOW\u4f7f\u7528\u914d\u7f6e\u6587\u4ef6\u8fdb\u884c\u7cfb\u7edf\u7684\u914d\u7f6e\u3002"),(0,o.kt)("p",null,"SCOW\u7684\u914d\u7f6e\u6587\u4ef6\u5747\u4f7f\u7528",(0,o.kt)("inlineCode",{parentName:"p"},"yaml"),"\u6216\u8005",(0,o.kt)("inlineCode",{parentName:"p"},"JSON"),"\u683c\u5f0f\uff0c\u5982\u679c\u4f7f\u7528",(0,o.kt)("inlineCode",{parentName:"p"},"scow-deployment"),"\u90e8\u7f72\uff0c\u5219\u914d\u7f6e\u6587\u4ef6\u5b58\u653e\u4e8e\u76ee\u5f55\u7684",(0,o.kt)("inlineCode",{parentName:"p"},"config"),"\u76ee\u5f55\u4e0b\u3002"),(0,o.kt)("p",null,"\u9879\u76ee\u5728\u542f\u52a8\u65f6\u5c06\u4f1a\u68c0\u67e5\u914d\u7f6e\u6587\u4ef6\u662f\u5426\u7b26\u5408\u683c\u5f0f\uff0c\u5982\u679c\u914d\u7f6e\u6587\u4ef6\u6709\u9519\uff0c\u5219\u7cfb\u7edf\u4f1a\u76f4\u63a5\u62a5\u9519\u3002"))}d.isMDXComponent=!0}}]);