"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[9020],{4852:(e,t,r)=>{r.d(t,{Zo:()=>s,kt:()=>h});var n=r(9231);function a(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function l(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function o(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?l(Object(r),!0).forEach((function(t){a(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):l(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function p(e,t){if(null==e)return{};var r,n,a=function(e,t){if(null==e)return{};var r,n,a={},l=Object.keys(e);for(n=0;n<l.length;n++)r=l[n],t.indexOf(r)>=0||(a[r]=e[r]);return a}(e,t);if(Object.getOwnPropertySymbols){var l=Object.getOwnPropertySymbols(e);for(n=0;n<l.length;n++)r=l[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(a[r]=e[r])}return a}var i=n.createContext({}),c=function(e){var t=n.useContext(i),r=t;return e&&(r="function"==typeof e?e(t):o(o({},t),e)),r},s=function(e){var t=c(e.components);return n.createElement(i.Provider,{value:t},e.children)},u="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},m=n.forwardRef((function(e,t){var r=e.components,a=e.mdxType,l=e.originalType,i=e.parentName,s=p(e,["components","mdxType","originalType","parentName"]),u=c(r),m=a,h=u["".concat(i,".").concat(m)]||u[m]||d[m]||l;return r?n.createElement(h,o(o({ref:t},s),{},{components:r})):n.createElement(h,o({ref:t},s))}));function h(e,t){var r=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var l=r.length,o=new Array(l);o[0]=m;var p={};for(var i in t)hasOwnProperty.call(t,i)&&(p[i]=t[i]);p.originalType=e,p[u]="string"==typeof e?e:a,o[1]=p;for(var c=2;c<l;c++)o[c]=r[c];return n.createElement.apply(null,o)}return n.createElement.apply(null,r)}m.displayName="MDXCreateElement"},8585:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>i,contentTitle:()=>o,default:()=>d,frontMatter:()=>l,metadata:()=>p,toc:()=>c});var n=r(5675),a=(r(9231),r(4852));const l={slug:"scow-scheduler-adapter",title:"SCOW\u8c03\u5ea6\u5668\u9002\u914d\u5668",authors:["quhan"],tags:["scow","scow-scheduler-adapter"]},o=void 0,p={permalink:"/SCOW/pr-preview/pr-917/blog/scow-scheduler-adapter",editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/blog/blog/2023-06-26-scow-scheduler-adapter.md",source:"@site/blog/2023-06-26-scow-scheduler-adapter.md",title:"SCOW\u8c03\u5ea6\u5668\u9002\u914d\u5668",description:"\u4ec0\u4e48\u662f\u8c03\u5ea6\u5668\u9002\u914d\u5668",date:"2023-06-26T00:00:00.000Z",formattedDate:"2023\u5e746\u670826\u65e5",tags:[{label:"scow",permalink:"/SCOW/pr-preview/pr-917/blog/tags/scow"},{label:"scow-scheduler-adapter",permalink:"/SCOW/pr-preview/pr-917/blog/tags/scow-scheduler-adapter"}],readingTime:2.935,hasTruncateMarker:!1,authors:[{name:"Qu Han",title:"Developer",imageURL:"https://avatars.githubusercontent.com/u/98016770",key:"quhan"}],frontMatter:{slug:"scow-scheduler-adapter",title:"SCOW\u8c03\u5ea6\u5668\u9002\u914d\u5668",authors:["quhan"],tags:["scow","scow-scheduler-adapter"]},prevItem:{title:"\u4ea4\u4e92\u5f0f\u5e94\u7528\u914d\u7f6e\u66f4\u65b0",permalink:"/SCOW/pr-preview/pr-917/blog/update-portal-app"},nextItem:{title:"scow-cli",permalink:"/SCOW/pr-preview/pr-917/blog/scow-cli-release"}},i={authorsImageUrls:[void 0]},c=[{value:"\u4ec0\u4e48\u662f\u8c03\u5ea6\u5668\u9002\u914d\u5668",id:"\u4ec0\u4e48\u662f\u8c03\u5ea6\u5668\u9002\u914d\u5668",level:2},{value:"\u600e\u6837\u5b9e\u73b0\u8c03\u5ea6\u5668\u9002\u914d\u5668",id:"\u600e\u6837\u5b9e\u73b0\u8c03\u5ea6\u5668\u9002\u914d\u5668",level:2},{value:"\u5982\u4f55\u5e73\u6ed1\u5347\u7ea7",id:"\u5982\u4f55\u5e73\u6ed1\u5347\u7ea7",level:2},{value:"1. \u90e8\u7f72\u8c03\u5ea6\u5668\u9002\u914d\u5668",id:"1-\u90e8\u7f72\u8c03\u5ea6\u5668\u9002\u914d\u5668",level:3},{value:"2. \u4fee\u6539SCOW\u914d\u7f6e\u6587\u4ef6",id:"2-\u4fee\u6539scow\u914d\u7f6e\u6587\u4ef6",level:3},{value:"3. \u4e0d\u518d\u4f7f\u7528\u6e90\u4f5c\u4e1a\u4fe1\u606f\u6570\u636e\u5e93",id:"3-\u4e0d\u518d\u4f7f\u7528\u6e90\u4f5c\u4e1a\u4fe1\u606f\u6570\u636e\u5e93",level:3}],s={toc:c},u="wrapper";function d(e){let{components:t,...r}=e;return(0,a.kt)(u,(0,n.Z)({},s,r,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h2",{id:"\u4ec0\u4e48\u662f\u8c03\u5ea6\u5668\u9002\u914d\u5668"},"\u4ec0\u4e48\u662f\u8c03\u5ea6\u5668\u9002\u914d\u5668"),(0,a.kt)("p",null,"SCOW\u662f\u5efa\u7acb\u5728\u5e95\u5c42\u4f5c\u4e1a\u8c03\u5ea6\u5668\u57fa\u7840\u4e0a\u7684\u7cfb\u7edf\uff0c\u5b83\u901a\u8fc7\u4e0e\u5e95\u5c42\u8c03\u5ea6\u5668\u8fdb\u884c\u529f\u80fd\u5bf9\u63a5\uff0c\u5411\u7528\u6237\u63d0\u4f9b\u5404\u79cd\u8d85\u7b97\u529f\u80fd\u3002"),(0,a.kt)("p",null,"\u5728\u4e4b\u524d\u7684\u5b9e\u73b0\u4e2d\uff0cscow\u76f4\u63a5\u4e0e\u4f5c\u4e1a\u8c03\u5ea6\u5668\u672c\u8eab\u4ea4\u4e92\uff0c\u56e0\u6b64scow\u5fc5\u987b\u77e5\u9053\u5e95\u5c42\u8c03\u5ea6\u5668\u5185\u90e8\u7684\u67d0\u4e9b\u7ec6\u8282\uff0c\n\u5bfc\u81f4scow\u5185\u90e8\u7684\u67d0\u4e9b\u4ee3\u7801\u662f\u4e0e\u8c03\u5ea6\u5668\u79cd\u7c7b\u76f4\u63a5\u76f8\u5173\u7684\uff08\u5982\u6700\u5148\u9002\u914d\u7684slurm\uff09\uff0c\u8fd9\u4f1a\u4f7f\u9002\u914d\u5176\u5b83\u8c03\u5ea6\u5668\u65f6\u6bd4\u8f83\u9ebb\u70e6\u3002"),(0,a.kt)("p",null,"\u8c03\u5ea6\u5668\u9002\u914d\u5668\uff08",(0,a.kt)("inlineCode",{parentName:"p"},"scheduler-adapter"),"\uff09\u5219\u662f\u4e3a\u4e86\u89e3\u51b3\u8fd9\u4e00\u95ee\u9898\uff0c\u901a\u8fc7\u4e00\u5c42\u9002\u914d\u5668\u5c42\uff0cscow\u53ea\u4e0e\u9002\u914d\u5668\u8fdb\u884c\u4ea4\u4e92\uff0c\n\u9002\u914d\u5668\u518d\u5bf9\u63a5\u4f5c\u4e1a\u8c03\u5ea6\u5668\uff0c\u5b9e\u73b0scow\u9700\u8981\u7684\u8c03\u5ea6\u5668\u529f\u80fd\u3002"),(0,a.kt)("h2",{id:"\u600e\u6837\u5b9e\u73b0\u8c03\u5ea6\u5668\u9002\u914d\u5668"},"\u600e\u6837\u5b9e\u73b0\u8c03\u5ea6\u5668\u9002\u914d\u5668"),(0,a.kt)("p",null,"\u8c03\u5ea6\u5668\u9002\u914d\u5668\u672c\u8d28\u4e0a\u662f\u4e00\u4e2agRPC\u670d\u52a1\u5668\uff0c\u5b83\u5b9e\u73b0\u4e86scow\u5b9a\u4e49\u7684\u4e00\u5957",(0,a.kt)("a",{parentName:"p",href:"https://github.com/PKUHPC/scow-scheduler-adapter-interface"},"\u63a5\u53e3"),"\uff0c\nscow\u53ea\u4f1a\u8c03\u7528\u8fd9\u5957\u63a5\u53e3\u6765\u5b9e\u73b0\u8c03\u5ea6\u5668\u529f\u80fd\u3002"),(0,a.kt)("p",null,"\u56e0\u6b64\uff0c\u53ea\u9700\u8981\u4e3a\u5bf9\u5e94\u79cd\u7c7b\u7684\u4f5c\u4e1a\u8c03\u5ea6\u5668\u5b9e\u73b0\u8fd9\u6837\u4e00\u4e2agRPC\u670d\u52a1\u5668\uff0c\u6ee1\u8db3\u4e0a\u8ff0\u63a5\u53e3\u5b9a\u4e49\uff0c\u5c31\u80fd\u591f\u8f7b\u677e\u5bf9\u63a5scow\u7cfb\u7edf"),(0,a.kt)("p",null,"\u6211\u4eec\u5df2\u7ecf\u5b9e\u73b0\u7684\u8c03\u5ea6\u5668\u9002\u914d\u5668\uff1a"),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("a",{parentName:"li",href:"https://github.com/PKUHPC/scow-slurm-adapter"},"slurm"))),(0,a.kt)("h2",{id:"\u5982\u4f55\u5e73\u6ed1\u5347\u7ea7"},"\u5982\u4f55\u5e73\u6ed1\u5347\u7ea7"),(0,a.kt)("p",null,"\u8fd9\u4e00\u90e8\u5206\u4ecb\u7ecd\u5982\u4f55\u4ece\u65e7\u7248\u672cscow\u5347\u7ea7\u81f3\u65b0\u7248\u672c\uff0c\u4f7f\u7528\u8c03\u5ea6\u5668\u9002\u914d\u5668"),(0,a.kt)("h3",{id:"1-\u90e8\u7f72\u8c03\u5ea6\u5668\u9002\u914d\u5668"},"1. \u90e8\u7f72\u8c03\u5ea6\u5668\u9002\u914d\u5668"),(0,a.kt)("p",null,"\u9996\u5148\u9700\u8981\u786e\u4fdd\u60a8\u7684\u96c6\u7fa4\u4e0a\u90e8\u7f72\u4e86\u5bf9\u5e94\u7684\u8c03\u5ea6\u5668\u9002\u914d\u5668\uff0c\u5f97\u5230\u8bbf\u95ee\u5b83\u7684\u5730\u5740\u53ca\u7aef\u53e3\u53f7"),(0,a.kt)("p",null,"\u90e8\u7f72\u9002\u914d\u5668\u53ef\u53c2\u8003\u6587\u6863\uff1a"),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("a",{parentName:"li",href:"https://github.com/PKUHPC/scow-slurm-adapter"},"slurm"))),(0,a.kt)("h3",{id:"2-\u4fee\u6539scow\u914d\u7f6e\u6587\u4ef6"},"2. \u4fee\u6539SCOW\u914d\u7f6e\u6587\u4ef6"),(0,a.kt)("p",null,"\u9996\u5148\u786e\u4fdd\u60a8\u4f7f\u7528\u4e86\u6700\u65b0\u7684SCOW\u955c\u50cf\uff08\u53ef\u67e5\u770b",(0,a.kt)("inlineCode",{parentName:"p"},"install.yaml"),"\u4e2d\u7684",(0,a.kt)("inlineCode",{parentName:"p"},"imageTag"),"\u5b57\u6bb5\uff09"),(0,a.kt)("p",null,"\u5728\u7528\u4e8e\u90e8\u7f72scow\u7684",(0,a.kt)("inlineCode",{parentName:"p"},"scow-deployment"),"\u6587\u4ef6\u5939\u4e2d\uff0c\u4fee\u6539\u914d\u7f6e\u6587\u4ef6\uff1a"),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},"\u9996\u5148\u4fee\u6539",(0,a.kt)("a",{parentName:"p",href:"https://PKUHPC.github.io/SCOW/pr-preview/pr-917/docs/deploy/config/cluster-config"},"\u96c6\u7fa4\u914d\u7f6e\u6587\u4ef6")),(0,a.kt)("p",{parentName:"li"},"\u4e3b\u8981\u53d8\u5316\u4e3a\u5220\u9664",(0,a.kt)("inlineCode",{parentName:"p"},"slurm"),"\u914d\u7f6e\u9879, \u5c06",(0,a.kt)("inlineCode",{parentName:"p"},"loginNodes"),"\u914d\u7f6e\u9879\u4f5c\u4e3a\u72ec\u7acb\u7684\u4e00\u9879\u914d\u7f6e\u3002\u65b0\u589e",(0,a.kt)("inlineCode",{parentName:"p"},"adapterUrl"),"\u914d\u7f6e\u9879\uff0c\u6807\u8bc6\u9002\u914d\u5668\u5730\u5740")),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},"\u4fee\u6539",(0,a.kt)("a",{parentName:"p",href:"https://PKUHPC.github.io/SCOW/pr-preview/pr-917/docs/deploy/config/mis/intro"},"\u7ba1\u7406\u7cfb\u7edf\u914d\u7f6e\u6587\u4ef6")),(0,a.kt)("p",{parentName:"li"},"\u5220\u9664\u4e86",(0,a.kt)("inlineCode",{parentName:"p"},"fetchJobs"),"\u914d\u7f6e\u9879\u4e2d\u7684",(0,a.kt)("inlineCode",{parentName:"p"},"db"),"\u9879\uff0c\u5373\u4e0d\u518d\u91c7\u7528\u6e90\u4f5c\u4e1a\u4fe1\u606f\u6570\u636e\u5e93\uff0c\u901a\u8fc7\u9002\u914d\u5668\u540c\u6b65\u4f5c\u4e1a\u4fe1\u606f"))),(0,a.kt)("h3",{id:"3-\u4e0d\u518d\u4f7f\u7528\u6e90\u4f5c\u4e1a\u4fe1\u606f\u6570\u636e\u5e93"},"3. \u4e0d\u518d\u4f7f\u7528\u6e90\u4f5c\u4e1a\u4fe1\u606f\u6570\u636e\u5e93"),(0,a.kt)("p",null,"\u90e8\u7f72\u4f7f\u7528\u9002\u914d\u5668\u540e\uff0c\u53ef\u4ee5\u4e0d\u518d\u90e8\u7f72",(0,a.kt)("a",{parentName:"p",href:"https://github.com/PKUHPC/export-jobs"},(0,a.kt)("inlineCode",{parentName:"a"},"export-jobs")),"\u9879\u76ee\uff0c\u540c\u6b65\u4f5c\u4e1a\u4fe1\u606f\u7684\u529f\u80fd\u7531\u9002\u914d\u5668\u5b8c\u6210"))}d.isMDXComponent=!0}}]);