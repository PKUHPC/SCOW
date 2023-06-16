"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[6167],{54852:(e,t,r)=>{r.d(t,{Zo:()=>u,kt:()=>f});var n=r(49231);function l(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function o(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function i(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?o(Object(r),!0).forEach((function(t){l(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):o(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function a(e,t){if(null==e)return{};var r,n,l=function(e,t){if(null==e)return{};var r,n,l={},o=Object.keys(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||(l[r]=e[r]);return l}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(l[r]=e[r])}return l}var c=n.createContext({}),p=function(e){var t=n.useContext(c),r=t;return e&&(r="function"==typeof e?e(t):i(i({},t),e)),r},u=function(e){var t=p(e.components);return n.createElement(c.Provider,{value:t},e.children)},s="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},m=n.forwardRef((function(e,t){var r=e.components,l=e.mdxType,o=e.originalType,c=e.parentName,u=a(e,["components","mdxType","originalType","parentName"]),s=p(r),m=l,f=s["".concat(c,".").concat(m)]||s[m]||d[m]||o;return r?n.createElement(f,i(i({ref:t},u),{},{components:r})):n.createElement(f,i({ref:t},u))}));function f(e,t){var r=arguments,l=t&&t.mdxType;if("string"==typeof e||l){var o=r.length,i=new Array(o);i[0]=m;var a={};for(var c in t)hasOwnProperty.call(t,c)&&(a[c]=t[c]);a.originalType=e,a[s]="string"==typeof e?e:l,i[1]=a;for(var p=2;p<o;p++)i[p]=r[p];return n.createElement.apply(null,i)}return n.createElement.apply(null,r)}m.displayName="MDXCreateElement"},4340:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>c,contentTitle:()=>i,default:()=>d,frontMatter:()=>o,metadata:()=>a,toc:()=>p});var n=r(95907),l=(r(49231),r(54852));const o={title:"\u591a\u67b6\u6784\u652f\u6301",sidebar_position:4,description:"SCOW\u5bf9\u5404\u7c7b\u7cfb\u7edf\u548c\u67b6\u6784\u7684\u652f\u6301"},i="\u591a\u67b6\u6784\u652f\u6301",a={unversionedId:"deploy/install/multi-platform",id:"deploy/install/multi-platform",title:"\u591a\u67b6\u6784\u652f\u6301",description:"SCOW\u5bf9\u5404\u7c7b\u7cfb\u7edf\u548c\u67b6\u6784\u7684\u652f\u6301",source:"@site/docs/deploy/install/multi-platform.md",sourceDirName:"deploy/install",slug:"/deploy/install/multi-platform",permalink:"/SCOW/pr-preview/pr-688/docs/deploy/install/multi-platform",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/install/multi-platform.md",tags:[],version:"current",sidebarPosition:4,frontMatter:{title:"\u591a\u67b6\u6784\u652f\u6301",sidebar_position:4,description:"SCOW\u5bf9\u5404\u7c7b\u7cfb\u7edf\u548c\u67b6\u6784\u7684\u652f\u6301"},sidebar:"deploy",previous:{title:"\u4ece\u6e90\u7801\u6784\u5efa",permalink:"/SCOW/pr-preview/pr-688/docs/deploy/install/build-from-source"},next:{title:"\u914d\u7f6e",permalink:"/SCOW/pr-preview/pr-688/docs/category/\u914d\u7f6e"}},c={},p=[{value:"<code>scow-cli</code>",id:"scow-cli",level:2},{value:"\u7f16\u8bd1\u652f\u6301\u591a\u67b6\u6784\u7684\u955c\u50cf",id:"\u7f16\u8bd1\u652f\u6301\u591a\u67b6\u6784\u7684\u955c\u50cf",level:2}],u={toc:p},s="wrapper";function d(e){let{components:t,...r}=e;return(0,l.kt)(s,(0,n.Z)({},u,r,{components:t,mdxType:"MDXLayout"}),(0,l.kt)("h1",{id:"\u591a\u67b6\u6784\u652f\u6301"},"\u591a\u67b6\u6784\u652f\u6301"),(0,l.kt)("p",null,"SCOW\u7cfb\u7edf\u652f\u6301\u4ee5\u4e0b\u8fd0\u884c\u73af\u5883\u7684\u955c\u50cf\u3002\u60a8\u53ea\u9700\u5728\u652f\u6301\u7684\u673a\u5668\u4e0a\u5b89\u88c5\u5bf9\u5e94\u7248\u672c\u7684docker\uff0c\u5c31\u53ef\u4ee5\u62c9\u53d6\u6216\u8005\u6784\u5efa\u7b26\u5408\u4f60\u5f53\u524d\u673a\u5668\u67b6\u6784\u7684\u955c\u50cf\u3002"),(0,l.kt)("ul",null,(0,l.kt)("li",{parentName:"ul"},(0,l.kt)("inlineCode",{parentName:"li"},"linux/amd64")),(0,l.kt)("li",{parentName:"ul"},(0,l.kt)("inlineCode",{parentName:"li"},"linux/arm64"))),(0,l.kt)("h2",{id:"scow-cli"},(0,l.kt)("inlineCode",{parentName:"h2"},"scow-cli")),(0,l.kt)("p",null,(0,l.kt)("inlineCode",{parentName:"p"},"scow-cli"),"\u540c\u6837\u652f\u6301\u4e0a\u8ff0\u8fd0\u884c\u73af\u5883\u3002\u8bf7\u5728\u4e0b\u8f7d\u65f6\u9009\u62e9\u60a8\u90e8\u7f72\u6240\u5728\u7684\u673a\u5668\u7684\u64cd\u4f5c\u7cfb\u7edf\u548c\u67b6\u6784\u4e0b\u8f7d\u3002"),(0,l.kt)("h2",{id:"\u7f16\u8bd1\u652f\u6301\u591a\u67b6\u6784\u7684\u955c\u50cf"},"\u7f16\u8bd1\u652f\u6301\u591a\u67b6\u6784\u7684\u955c\u50cf"),(0,l.kt)("p",null,"\u76f4\u63a5\u8fd0\u884c",(0,l.kt)("inlineCode",{parentName:"p"},"docker build"),"\u6784\u5efa\u51fa\u6765\u7684\u955c\u50cf\u4e3a\u53ea\u652f\u6301\u60a8\u7f16\u8bd1\u65f6\u673a\u5668\u7684\u67b6\u6784\u7684\u955c\u50cf\u3002\u8981\u60f3\u7f16\u8bd1\u51fa\u540c\u65f6\u652f\u6301\u4ee5\u4e0a\u6240\u6709\u67b6\u6784\u7684\u7684\u955c\u50cf\uff0c\u8bf7\u53c2\u8003\u4ee5\u4e0b\u6b65\u9aa4\uff1a"),(0,l.kt)("ol",null,(0,l.kt)("li",{parentName:"ol"},"\u6839\u636edocker\u5b98\u65b9\u7684",(0,l.kt)("a",{parentName:"li",href:"https://docs.docker.com/build/building/multi-platform/"},(0,l.kt)("inlineCode",{parentName:"a"},"Multi-platform images"),"\u6587\u6863"),"\uff0c\u521b\u5efa\u5e76\u4f7f\u7528\u652f\u6301\u591a\u5e73\u53f0\u7f16\u8bd1\u7684builder")),(0,l.kt)("pre",null,(0,l.kt)("code",{parentName:"pre",className:"language-bash"},"docker buildx create --name mybuilder --driver docker-container --bootstrap --use\n")),(0,l.kt)("ol",{start:2},(0,l.kt)("li",{parentName:"ol"},"\u901a\u8fc7\u8fd9\u4e2abuilder\u6784\u5efa\u955c\u50cf")),(0,l.kt)("pre",null,(0,l.kt)("code",{parentName:"pre",className:"language-bash"},"# \ndocker buildx build -f docker/Dockerfile.scow -t scow --platform=linux/arm64,linux/cmd64 .\n")))}d.isMDXComponent=!0}}]);