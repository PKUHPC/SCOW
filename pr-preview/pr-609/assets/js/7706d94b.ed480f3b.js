"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[9931],{4852:(e,t,r)=>{r.d(t,{Zo:()=>c,kt:()=>k});var n=r(9231);function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function i(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function a(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?i(Object(r),!0).forEach((function(t){o(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):i(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function p(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}var l=n.createContext({}),s=function(e){var t=n.useContext(l),r=t;return e&&(r="function"==typeof e?e(t):a(a({},t),e)),r},c=function(e){var t=s(e.components);return n.createElement(l.Provider,{value:t},e.children)},u="mdxType",m={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},d=n.forwardRef((function(e,t){var r=e.components,o=e.mdxType,i=e.originalType,l=e.parentName,c=p(e,["components","mdxType","originalType","parentName"]),u=s(r),d=o,k=u["".concat(l,".").concat(d)]||u[d]||m[d]||i;return r?n.createElement(k,a(a({ref:t},c),{},{components:r})):n.createElement(k,a({ref:t},c))}));function k(e,t){var r=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var i=r.length,a=new Array(i);a[0]=d;var p={};for(var l in t)hasOwnProperty.call(t,l)&&(p[l]=t[l]);p.originalType=e,p[u]="string"==typeof e?e:o,a[1]=p;for(var s=2;s<i;s++)a[s]=r[s];return n.createElement.apply(null,a)}return n.createElement.apply(null,r)}d.displayName="MDXCreateElement"},6509:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>l,contentTitle:()=>a,default:()=>m,frontMatter:()=>i,metadata:()=>p,toc:()=>s});var n=r(5675),o=(r(9231),r(4852));const i={sidebar_position:2,title:"SCOW API"},a="SCOW API",p={unversionedId:"integration/scow-api-hook/api",id:"integration/scow-api-hook/api",title:"SCOW API",description:"SCOW\u7cfb\u7edf\u603b\u4f53\u6765\u8bf4\u5206\u4e3a\u524d\u7aef\u548c\u540e\u7aef\u90e8\u5206\uff08\u67b6\u6784\uff09\uff0cSCOW\u7684\u524d\u7aef\u548c\u540e\u7aef\u90e8\u5206\u4f7f\u7528gRPC\u8fdb\u884c\u901a\u4fe1\u3002",source:"@site/docs/integration/scow-api-hook/api.md",sourceDirName:"integration/scow-api-hook",slug:"/integration/scow-api-hook/api",permalink:"/SCOW/pr-preview/pr-609/docs/integration/scow-api-hook/api",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/integration/scow-api-hook/api.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2,title:"SCOW API"},sidebar:"integration",previous:{title:"SCOW Protobuf\u6587\u4ef6",permalink:"/SCOW/pr-preview/pr-609/docs/integration/scow-api-hook/proto"},next:{title:"SCOW Hook",permalink:"/SCOW/pr-preview/pr-609/docs/integration/scow-api-hook/hook"}},l={},s=[{value:"\u6253\u5f00\u540e\u7aef\u670d\u52a1\u7f51\u7edc\u63a5\u53e3",id:"\u6253\u5f00\u540e\u7aef\u670d\u52a1\u7f51\u7edc\u63a5\u53e3",level:2},{value:"\u5b89\u5168\u6027",id:"\u5b89\u5168\u6027",level:2},{value:"\u5b9e\u9645\u9879\u76ee\u793a\u4f8b",id:"\u5b9e\u9645\u9879\u76ee\u793a\u4f8b",level:2}],c={toc:s},u="wrapper";function m(e){let{components:t,...r}=e;return(0,o.kt)(u,(0,n.Z)({},c,r,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"scow-api"},"SCOW API"),(0,o.kt)("p",null,"SCOW\u7cfb\u7edf\u603b\u4f53\u6765\u8bf4\u5206\u4e3a\u524d\u7aef\u548c\u540e\u7aef\u90e8\u5206\uff08",(0,o.kt)("a",{parentName:"p",href:"/SCOW/pr-preview/pr-609/docs/deploy/architecture/"},"\u67b6\u6784"),"\uff09\uff0cSCOW\u7684\u524d\u7aef\u548c\u540e\u7aef\u90e8\u5206\u4f7f\u7528gRPC\u8fdb\u884c\u901a\u4fe1\u3002"),(0,o.kt)("p",null,"\u8981\u4f7f\u7528SCOW API\uff0c\u60a8\u9700\u8981"),(0,o.kt)("ol",null,(0,o.kt)("li",{parentName:"ol"},(0,o.kt)("a",{parentName:"li",href:"/SCOW/pr-preview/pr-609/docs/integration/scow-api-hook/proto"},"\u83b7\u53d6SCOW Protobuf\u6587\u4ef6"),"\u5e76\u751f\u6210\u76f8\u5173\u4ee3\u7801"),(0,o.kt)("li",{parentName:"ol"},"\u7f16\u5199\u7a0b\u5e8f\uff0c\u8c03\u7528gRPC API\u4e0eSCOW\u7684\u540e\u7aef\u90e8\u5206\u7ec4\u4ef6",(0,o.kt)("inlineCode",{parentName:"li"},"mis-server"),", ",(0,o.kt)("inlineCode",{parentName:"li"},"portal-server"),"\u4ea4\u4e92")),(0,o.kt)("h2",{id:"\u6253\u5f00\u540e\u7aef\u670d\u52a1\u7f51\u7edc\u63a5\u53e3"},"\u6253\u5f00\u540e\u7aef\u670d\u52a1\u7f51\u7edc\u63a5\u53e3"),(0,o.kt)("p",null,"\u90e8\u7f72\u597d\u7684\u7cfb\u7edf\u7684\u540e\u7aef\u670d\u52a1\u5bb9\u5668",(0,o.kt)("inlineCode",{parentName:"p"},"mis-server"),", ",(0,o.kt)("inlineCode",{parentName:"p"},"portal-server"),"\u4f4d\u4e8edocker compose\u521b\u5efa\u7684\u7f51\u7edc\u4e2d\uff0c\u4ece\u5916\u754c\u65e0\u6cd5\u76f4\u63a5\u8bbf\u95ee",(0,o.kt)("inlineCode",{parentName:"p"},"mis-server"),"\u548c",(0,o.kt)("inlineCode",{parentName:"p"},"portal-server"),"\u4e24\u4e2a\u670d\u52a1\u3002"),(0,o.kt)("p",null,"\u8981\u60f3\u8bbf\u95ee\u8fd9\u4e24\u4e2a\u670d\u52a1\uff0c\u60a8\u9700\u8981\u901a\u8fc7",(0,o.kt)("inlineCode",{parentName:"p"},"install.yaml"),"\u5c06\u4e3b\u673a\u4e0a\u7684\u7aef\u53e3\u6620\u5c04\u5230",(0,o.kt)("inlineCode",{parentName:"p"},"mis-server"),"\u548c",(0,o.kt)("inlineCode",{parentName:"p"},"portal-server"),"\u670d\u52a1\u76845000\u7aef\u53e3\u4e2d\u3002\u914d\u7f6e\u5b8c\u6210\u540e\uff0c\u60a8\u53ef\u4ee5\u4ece\u90e8\u7f72SCOW\u7684\u673a\u5668\u4e0a\u901a\u8fc7\u5b9a\u4e49\u7684IP\u548c\u7aef\u53e3\u4e0e\u5bf9\u5e94\u7684\u670d\u52a1\u4ea4\u4e92\u3002"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-yaml",metastring:"title=install.yaml",title:"install.yaml"},'\nportal:\n  portMappings:\n    # portal-server\u76845000\u7aef\u53e3\u6620\u5c04\u5230127.0.0.1:7572\n    portalServer: "127.0.0.1:7572"\nmis:\n  portMappings:\n    # mis-server\u76845000\u7aef\u53e3\u6620\u5c04\u5230127.0.0.1:7571\n    misServer: "127.0.0.1:7571"\n')),(0,o.kt)("h2",{id:"\u5b89\u5168\u6027"},"\u5b89\u5168\u6027"),(0,o.kt)("p",null,"SCOW\u7684gRPC\u540e\u7aef\u5e76\u4e0d\u5305\u542b\u4efb\u4f55\u9274\u6743\u548c\u8ba4\u8bc1\u8fc7\u7a0b\u3002\u5982\u679c\u60a8\u5728\u6620\u5c04\u7aef\u53e3\u65f6\u76f4\u63a5\u8f93\u5165\u7aef\u53e3\u53f7\uff08\u5982",(0,o.kt)("inlineCode",{parentName:"p"},"7571"),"\u4e0d\u662f",(0,o.kt)("inlineCode",{parentName:"p"},"127.0.0.1:7571"),"\uff09\uff0c\u7531\u4e8e\u5728\u540c\u4e00\u4e2a\u96c6\u7fa4\u4e2d\u5404\u4e2a\u8282\u70b9\u7684\u7f51\u7edc\u662f\u4e92\u901a\u7684\uff0c\u5219\u5728\u540c\u4e00\u4e2a\u96c6\u7fa4\u4e2d\u7684\u5176\u4ed6\u4f5c\u4e1a\u53ef\u80fd\u53ef\u4ee5\u76f4\u63a5\u8bbf\u95eeSCOW\u7684gRPC\u540e\u7aef\uff0c\u8fdb\u800c\u76f4\u63a5\u64cd\u4f5cSCOW\u7cfb\u7edf\u7684\u6570\u636e\uff0c\u9020\u6210\u5b89\u5168\u9690\u60a3\u3002\u6240\u4ee5\u6211\u4eec\u5efa\u8bae\uff1a"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},"\u4e0d\u5c06SCOW\u670d\u52a1\u8282\u70b9\u7528\u4f5c\u96c6\u7fa4\u7684\u767b\u5f55\u8282\u70b9\u6216\u8005\u8ba1\u7b97\u8282\u70b9"),(0,o.kt)("li",{parentName:"ul"},"\u5728\u6620\u5c04\u7aef\u53e3\u65f6\u8f93\u5165",(0,o.kt)("inlineCode",{parentName:"li"},"127.0.0.1:7571"),"\uff0c\u4f7f\u6620\u5c04\u51fa\u7684\u7aef\u53e3\u53ea\u80fd\u5728SCOW\u670d\u52a1\u8282\u70b9\u4e0a\u4f7f\u7528"),(0,o.kt)("li",{parentName:"ul"},"\u7ed9SCOW\u670d\u52a1\u8282\u70b9\u8bbe\u7f6e\u597d\u9632\u706b\u5899\uff0c\u9632\u6b62\u96c6\u7fa4\u5185\u90e8\u7684\u670d\u52a1\u8bbf\u95ee\u5230SCOW\u670d\u52a1")),(0,o.kt)("h2",{id:"\u5b9e\u9645\u9879\u76ee\u793a\u4f8b"},"\u5b9e\u9645\u9879\u76ee\u793a\u4f8b"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("a",{parentName:"li",href:"/SCOW/pr-preview/pr-609/docs/integration/scow-api-hook/examples/go#%E4%BD%BF%E7%94%A8scow-api"},"Go"))))}m.isMDXComponent=!0}}]);