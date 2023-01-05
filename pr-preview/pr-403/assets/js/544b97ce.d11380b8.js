"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[3658],{4852:(e,t,r)=>{r.d(t,{Zo:()=>u,kt:()=>s});var n=r(9231);function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function l(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function i(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?l(Object(r),!0).forEach((function(t){o(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):l(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function a(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},l=Object.keys(e);for(n=0;n<l.length;n++)r=l[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var l=Object.getOwnPropertySymbols(e);for(n=0;n<l.length;n++)r=l[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}var p=n.createContext({}),c=function(e){var t=n.useContext(p),r=t;return e&&(r="function"==typeof e?e(t):i(i({},t),e)),r},u=function(e){var t=c(e.components);return n.createElement(p.Provider,{value:t},e.children)},d={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},m=n.forwardRef((function(e,t){var r=e.components,o=e.mdxType,l=e.originalType,p=e.parentName,u=a(e,["components","mdxType","originalType","parentName"]),m=c(r),s=o,f=m["".concat(p,".").concat(s)]||m[s]||d[s]||l;return r?n.createElement(f,i(i({ref:t},u),{},{components:r})):n.createElement(f,i({ref:t},u))}));function s(e,t){var r=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var l=r.length,i=new Array(l);i[0]=m;var a={};for(var p in t)hasOwnProperty.call(t,p)&&(a[p]=t[p]);a.originalType=e,a.mdxType="string"==typeof e?e:o,i[1]=a;for(var c=2;c<l;c++)i[c]=r[c];return n.createElement.apply(null,i)}return n.createElement.apply(null,r)}m.displayName="MDXCreateElement"},3707:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>p,contentTitle:()=>i,default:()=>d,frontMatter:()=>l,metadata:()=>a,toc:()=>c});var n=r(9675),o=(r(9231),r(4852));const l={title:"\u591a\u67b6\u6784\u652f\u6301",sidebar_position:7},i="\u591a\u67b6\u6784\u652f\u6301",a={unversionedId:"deploy/SCOW/multi-platform",id:"deploy/SCOW/multi-platform",title:"\u591a\u67b6\u6784\u652f\u6301",description:"SCOW\u7cfb\u7edf\u652f\u6301\u4ee5\u4e0b\u8fd0\u884c\u73af\u5883\u7684\u955c\u50cf\u3002\u60a8\u53ea\u9700\u5728\u652f\u6301\u7684\u673a\u5668\u4e0a\u5b89\u88c5\u5bf9\u5e94\u7248\u672c\u7684docker\uff0c\u5c31\u53ef\u4ee5\u62c9\u53d6\u6216\u8005\u6784\u5efa\u7b26\u5408\u4f60\u5f53\u524d\u673a\u5668\u67b6\u6784\u7684\u955c\u50cf\u3002",source:"@site/docs/deploy/SCOW/multi-platform.md",sourceDirName:"deploy/SCOW",slug:"/deploy/SCOW/multi-platform",permalink:"/SCOW/pr-preview/pr-403/docs/deploy/SCOW/multi-platform",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/SCOW/multi-platform.md",tags:[],version:"current",sidebarPosition:7,frontMatter:{title:"\u591a\u67b6\u6784\u652f\u6301",sidebar_position:7},sidebar:"deploy",previous:{title:"\u81ea\u5b9a\u4e49\u524d\u7aef\u9879\u76ee\u4e3b\u9898",permalink:"/SCOW/pr-preview/pr-403/docs/deploy/SCOW/customization/webui"},next:{title:"\u591a\u96c6\u7fa4\u7ba1\u7406",permalink:"/SCOW/pr-preview/pr-403/docs/multi_cluster"}},p={},c=[{value:"\u7f16\u8bd1\u652f\u6301\u591a\u67b6\u6784\u7684\u955c\u50cf",id:"\u7f16\u8bd1\u652f\u6301\u591a\u67b6\u6784\u7684\u955c\u50cf",level:2}],u={toc:c};function d(e){let{components:t,...r}=e;return(0,o.kt)("wrapper",(0,n.Z)({},u,r,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"\u591a\u67b6\u6784\u652f\u6301"},"\u591a\u67b6\u6784\u652f\u6301"),(0,o.kt)("p",null,"SCOW\u7cfb\u7edf\u652f\u6301\u4ee5\u4e0b\u8fd0\u884c\u73af\u5883\u7684\u955c\u50cf\u3002\u60a8\u53ea\u9700\u5728\u652f\u6301\u7684\u673a\u5668\u4e0a\u5b89\u88c5\u5bf9\u5e94\u7248\u672c\u7684docker\uff0c\u5c31\u53ef\u4ee5\u62c9\u53d6\u6216\u8005\u6784\u5efa\u7b26\u5408\u4f60\u5f53\u524d\u673a\u5668\u67b6\u6784\u7684\u955c\u50cf\u3002"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("inlineCode",{parentName:"li"},"linux/amd64")),(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("inlineCode",{parentName:"li"},"linux/arm64"))),(0,o.kt)("h2",{id:"\u7f16\u8bd1\u652f\u6301\u591a\u67b6\u6784\u7684\u955c\u50cf"},"\u7f16\u8bd1\u652f\u6301\u591a\u67b6\u6784\u7684\u955c\u50cf"),(0,o.kt)("p",null,"\u60a8\u901a\u8fc7",(0,o.kt)("inlineCode",{parentName:"p"},"dev/docker-compose.build.yml"),"\u6784\u5efa\u51fa\u6765\u7684\u955c\u50cf\u4e3a\u53ea\u652f\u6301\u60a8\u7f16\u8bd1\u65f6\u673a\u5668\u7684\u67b6\u6784\u7684\u955c\u50cf\u3002\u8981\u60f3\u7f16\u8bd1\u51fa\u540c\u65f6\u652f\u6301\u4ee5\u4e0a\u6240\u6709\u67b6\u6784\u7684\u7684\u955c\u50cf\uff0c\u8bf7\u53c2\u8003\u4ee5\u4e0b\u6b65\u9aa4\uff1a"),(0,o.kt)("ol",null,(0,o.kt)("li",{parentName:"ol"},"\u6839\u636edocker\u5b98\u65b9\u7684",(0,o.kt)("a",{parentName:"li",href:"https://docs.docker.com/build/building/multi-platform/"},(0,o.kt)("inlineCode",{parentName:"a"},"Multi-platform images"),"\u6587\u6863"),"\uff0c\u521b\u5efa\u51fa\u652f\u6301\u591a\u5e73\u53f0\u7f16\u8bd1\u7684builder")),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-bash"},"docker buildx create --name mybuilder --driver docker-container --bootstrap\n")),(0,o.kt)("ol",{start:2},(0,o.kt)("li",{parentName:"ol"},"\u901a\u8fc7",(0,o.kt)("inlineCode",{parentName:"li"},"dev/docker-compose.build-multiplatform.yml"),"\u6784\u5efa\u955c\u50cf")),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-bash"},"docker compose --env-file dev/.env.build -f dev/docker-compose.build-multiplatform.yml build \n")))}d.isMDXComponent=!0}}]);