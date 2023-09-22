"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[9915],{54852:(e,t,n)=>{n.d(t,{Zo:()=>p,kt:()=>d});var r=n(49231);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function i(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function a(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?i(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function c(e,t){if(null==e)return{};var n,r,o=function(e,t){if(null==e)return{};var n,r,o={},i=Object.keys(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var l=r.createContext({}),s=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):a(a({},t),e)),n},p=function(e){var t=s(e.components);return r.createElement(l.Provider,{value:t},e.children)},u="mdxType",m={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},f=r.forwardRef((function(e,t){var n=e.components,o=e.mdxType,i=e.originalType,l=e.parentName,p=c(e,["components","mdxType","originalType","parentName"]),u=s(n),f=o,d=u["".concat(l,".").concat(f)]||u[f]||m[f]||i;return n?r.createElement(d,a(a({ref:t},p),{},{components:n})):r.createElement(d,a({ref:t},p))}));function d(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var i=n.length,a=new Array(i);a[0]=f;var c={};for(var l in t)hasOwnProperty.call(t,l)&&(c[l]=t[l]);c.originalType=e,c[u]="string"==typeof e?e:o,a[1]=c;for(var s=2;s<i;s++)a[s]=n[s];return r.createElement.apply(null,a)}return r.createElement.apply(null,n)}f.displayName="MDXCreateElement"},84579:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>a,default:()=>m,frontMatter:()=>i,metadata:()=>c,toc:()=>s});var r=n(45675),o=(n(49231),n(54852));const i={sidebar_position:1,title:"\u4f7f\u7528\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf"},a="\u4f7f\u7528\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf",c={unversionedId:"integration/auth/use",id:"integration/auth/use",title:"\u4f7f\u7528\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf",description:"\u5982\u679c\u7cfb\u7edf\u63d0\u4f9b\u7684\u8ba4\u8bc1\u7cfb\u7edf\u4e0d\u80fd\u6ee1\u8db3\u60a8\u7684\u9700\u6c42\uff0c\u60a8\u53ef\u4ee5\u81ea\u5df1\u4f7f\u7528\u548c\u5b9e\u73b0\u4e00\u4e2a\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u670d\u52a1\u3002",source:"@site/docs/integration/auth/use.md",sourceDirName:"integration/auth",slug:"/integration/auth/use",permalink:"/SCOW/pr-preview/pr-867/docs/integration/auth/use",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/integration/auth/use.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1,title:"\u4f7f\u7528\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf"},sidebar:"integration",previous:{title:"\u4e0eSCOW\u96c6\u6210",permalink:"/SCOW/pr-preview/pr-867/docs/integration/"},next:{title:"\u5b9e\u73b0\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf",permalink:"/SCOW/pr-preview/pr-867/docs/integration/auth/impl"}},l={},s=[{value:"\u4f7f\u7528\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u670d\u52a1",id:"\u4f7f\u7528\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u670d\u52a1",level:2}],p={toc:s},u="wrapper";function m(e){let{components:t,...n}=e;return(0,o.kt)(u,(0,r.Z)({},p,n,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"\u4f7f\u7528\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf"},"\u4f7f\u7528\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf"),(0,o.kt)("p",null,"\u5982\u679c\u7cfb\u7edf\u63d0\u4f9b\u7684\u8ba4\u8bc1\u7cfb\u7edf\u4e0d\u80fd\u6ee1\u8db3\u60a8\u7684\u9700\u6c42\uff0c\u60a8\u53ef\u4ee5\u81ea\u5df1\u4f7f\u7528\u548c\u5b9e\u73b0\u4e00\u4e2a\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u670d\u52a1\u3002"),(0,o.kt)("h2",{id:"\u4f7f\u7528\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u670d\u52a1"},"\u4f7f\u7528\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u670d\u52a1"),(0,o.kt)("p",null,"\u60a8\u81ea\u5df1\u7f16\u5199\u7684\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u670d\u52a1\u5e94\u8be5\u88ab\u6253\u5305\u4e3a\u4e00\u4e2adocker\u955c\u50cf\uff0c\u653e\u5728\u60a8\u90e8\u7f72\u6240\u5728\u673a\u5668\u53ef\u4ee5\u8bbf\u95ee\u7684\u5730\u5740\u4e0a\u3002"),(0,o.kt)("p",null,"\u4fee\u6539\u5b89\u88c5\u914d\u7f6e\u6587\u4ef6\u7684",(0,o.kt)("inlineCode",{parentName:"p"},"auth.custom"),"\u90e8\u5206\u4ee5\u4f7f\u7528\u60a8\u7684\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u670d\u52a1\u3002"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-yaml",metastring:'title="install.yaml"',title:'"install.yaml"'},'auth:\n  custom:\n    # \u955c\u50cf\u5730\u5740\u3002\u5fc5\u586b\uff0c\u53ea\u8981\u662f\u80fd\u8bbf\u95ee\u7684\u955c\u50cf\u5730\u5740\u5373\u53ef\u3002\n    image: "ghcr.io/pkuhpc/scow-auth:master",\n  \n    # \u7aef\u53e3\u6620\u5c04\uff08\u53ef\u9009\uff09\n    # ports: ["80:80", "3302:3302"],\n  \n    # \u73af\u5883\u53d8\u91cf\uff08\u53ef\u9009\uff09\n    # environment: ["KEY=123"],\n  \n    # \u5377\u6620\u5c04\uff08\u53ef\u9009\uff09\n    # \u9ed8\u8ba4\u6dfb\u52a0/etc/hosts:/etc/hosts\u548c./config:/etc/scow\n    # \u53ef\u9009\u6dfb\u52a0\u5176\u4ed6\u6620\u5c04\n    # volumes:\n    #   - ./test.py:/etc/test.py\n')))}m.isMDXComponent=!0}}]);