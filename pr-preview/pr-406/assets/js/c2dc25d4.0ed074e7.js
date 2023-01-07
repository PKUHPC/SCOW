"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[5095],{4852:(e,t,n)=>{n.d(t,{Zo:()=>d,kt:()=>N});var a=n(9231);function l(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function r(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function p(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?r(Object(n),!0).forEach((function(t){l(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):r(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function i(e,t){if(null==e)return{};var n,a,l=function(e,t){if(null==e)return{};var n,a,l={},r=Object.keys(e);for(a=0;a<r.length;a++)n=r[a],t.indexOf(n)>=0||(l[n]=e[n]);return l}(e,t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);for(a=0;a<r.length;a++)n=r[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(l[n]=e[n])}return l}var o=a.createContext({}),m=function(e){var t=a.useContext(o),n=t;return e&&(n="function"==typeof e?e(t):p(p({},t),e)),n},d=function(e){var t=m(e.components);return a.createElement(o.Provider,{value:t},e.children)},k={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},s=a.forwardRef((function(e,t){var n=e.components,l=e.mdxType,r=e.originalType,o=e.parentName,d=i(e,["components","mdxType","originalType","parentName"]),s=m(n),N=l,u=s["".concat(o,".").concat(N)]||s[N]||k[N]||r;return n?a.createElement(u,p(p({ref:t},d),{},{components:n})):a.createElement(u,p({ref:t},d))}));function N(e,t){var n=arguments,l=t&&t.mdxType;if("string"==typeof e||l){var r=n.length,p=new Array(r);p[0]=s;var i={};for(var o in t)hasOwnProperty.call(t,o)&&(i[o]=t[o]);i.originalType=e,i.mdxType="string"==typeof e?e:l,p[1]=i;for(var m=2;m<r;m++)p[m]=n[m];return a.createElement.apply(null,p)}return a.createElement.apply(null,n)}s.displayName="MDXCreateElement"},2865:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>o,contentTitle:()=>p,default:()=>k,frontMatter:()=>r,metadata:()=>i,toc:()=>m});var a=n(9675),l=(n(9231),n(4852));const r={sidebar_position:1,title:"\u76f8\u5bf9\u8def\u5f84"},p="\u81ea\u5b9a\u4e49\u76f8\u5bf9\u8def\u5f84",i={unversionedId:"deploy/SCOW/customization/basepath",id:"deploy/SCOW/customization/basepath",title:"\u76f8\u5bf9\u8def\u5f84",description:"\u4ec0\u4e48\u662f\u76f8\u5bf9\u8def\u5f84\uff08base path\uff09",source:"@site/docs/deploy/SCOW/customization/basepath.md",sourceDirName:"deploy/SCOW/customization",slug:"/deploy/SCOW/customization/basepath",permalink:"/SCOW/pr-preview/pr-406/docs/deploy/SCOW/customization/basepath",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/SCOW/customization/basepath.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1,title:"\u76f8\u5bf9\u8def\u5f84"},sidebar:"deploy",previous:{title:"\u5b9e\u73b0",permalink:"/SCOW/pr-preview/pr-406/docs/deploy/SCOW/auth/custom/implementation"},next:{title:"\u81ea\u5b9a\u4e49\u524d\u7aef\u9879\u76ee\u4e3b\u9898",permalink:"/SCOW/pr-preview/pr-406/docs/deploy/SCOW/customization/webui"}},o={},m=[{value:"\u4ec0\u4e48\u662f\u76f8\u5bf9\u8def\u5f84\uff08base path\uff09",id:"\u4ec0\u4e48\u662f\u76f8\u5bf9\u8def\u5f84base-path",level:2},{value:"\u9700\u91cd\u65b0\u6784\u5efa\u955c\u50cf",id:"\u9700\u91cd\u65b0\u6784\u5efa\u955c\u50cf",level:2},{value:"\u65b9\u6cd51\uff1a\u4ece\u6e90\u7801\u6784\u5efa\u65f6\u914d\u7f6e\u6574\u4e2a\u7cfb\u7edf\u7684\u76f8\u5bf9\u8def\u5f84",id:"\u65b9\u6cd51\u4ece\u6e90\u7801\u6784\u5efa\u65f6\u914d\u7f6e\u6574\u4e2a\u7cfb\u7edf\u7684\u76f8\u5bf9\u8def\u5f84",level:3},{value:"\u65b9\u6cd52\uff1a\u66f4\u7075\u6d3b\u5730\u81ea\u5b9a\u4e49\u8def\u5f84",id:"\u65b9\u6cd52\u66f4\u7075\u6d3b\u5730\u81ea\u5b9a\u4e49\u8def\u5f84",level:3},{value:"<code>config.py</code>\u4e2d<code>BASE_PATH</code>\u586b\u5199\u89c4\u5219",id:"configpy\u4e2dbase_path\u586b\u5199\u89c4\u5219",level:2}],d={toc:m};function k(e){let{components:t,...n}=e;return(0,l.kt)("wrapper",(0,a.Z)({},d,n,{components:t,mdxType:"MDXLayout"}),(0,l.kt)("h1",{id:"\u81ea\u5b9a\u4e49\u76f8\u5bf9\u8def\u5f84"},"\u81ea\u5b9a\u4e49\u76f8\u5bf9\u8def\u5f84"),(0,l.kt)("h2",{id:"\u4ec0\u4e48\u662f\u76f8\u5bf9\u8def\u5f84base-path"},"\u4ec0\u4e48\u662f\u76f8\u5bf9\u8def\u5f84\uff08base path\uff09"),(0,l.kt)("p",null,"\u5047\u8bbe\u6211\u4eec\u7684\u7cfb\u7edf\u90e8\u7f72\u5728",(0,l.kt)("inlineCode",{parentName:"p"},"https://scowtest.com"),"\u4e0b\uff0c\u90a3\u4e48\u5728\u6d4f\u89c8\u5668\u4e2d\u8f93\u5165\u6b64URL\uff0c\u5373\u53ef\u8bbf\u95ee\u7cfb\u7edf\u3002\u5728\u8fd9\u79cd\u90e8\u7f72\u6761\u4ef6\u4e0b\uff0c\u6211\u4eec\u8bf4\uff0c\u7cfb\u7edf\u90e8\u7f72\u5728",(0,l.kt)("inlineCode",{parentName:"p"},"scowtest.com"),"\u57df\u540d\u4e0b\uff0c\u5176\u76f8\u5bf9\u4e8e\u57df\u540d\u7684\u8def\u5f84\uff08\u76f8\u5bf9\u8def\u5f84\uff09\u4e3a\u6839\u8def\u5f84\uff0c\u5373",(0,l.kt)("inlineCode",{parentName:"p"},"/"),"\u3002"),(0,l.kt)("p",null,"\u5728\u4e00\u4e9b\u7279\u6b8a\u6761\u4ef6\u4e0b\uff0c\u6211\u4eec\u60f3\u4f7f\u7528\u540c\u4e00\u4e2a\u57df\u540d\u90e8\u7f72\u591a\u4e2a\u7cfb\u7edf\uff0c\u6bcf\u4e2a\u7cfb\u7edf\u90e8\u7f72\u5728\u4e00\u4e2a\u57df\u540d\u7684\u67d0\u4e2a",(0,l.kt)("strong",{parentName:"p"},"\u76f8\u5bf9\u8def\u5f84(base path)"),"\u4e0b\uff0c\u4f8b\u5982\uff0c\u6211\u4eec\u53ef\u80fd\u60f3\u901a\u8fc7",(0,l.kt)("inlineCode",{parentName:"p"},"https://scowtest.com/scow"),"\u8bbf\u95ee\u7cfb\u7edf\u3002\u5728\u8fd9\u79cd\u6761\u4ef6\u4e0b\uff0c\u7cfb\u7edf\u4ecd\u7136\u90e8\u7f72\u5728",(0,l.kt)("inlineCode",{parentName:"p"},"scowtest.com"),"\u57df\u540d\u4e0b\uff0c\u4f46\u662f\u5176",(0,l.kt)("strong",{parentName:"p"},"\u76f8\u5bf9\u8def\u5f84"),"\u4e3a",(0,l.kt)("inlineCode",{parentName:"p"},"/scow"),"\u3002"),(0,l.kt)("h2",{id:"\u9700\u91cd\u65b0\u6784\u5efa\u955c\u50cf"},"\u9700\u91cd\u65b0\u6784\u5efa\u955c\u50cf"),(0,l.kt)("p",null,"\u5f53\u524d\u7531\u4e8e\u6280\u672f\u9650\u5236\uff0c\u5c06\u7cfb\u7edf\u90e8\u7f72\u4e0d\u540c\u7684\u76f8\u5bf9\u8def\u5f84\u4e0b\u9700\u8981\u91cd\u65b0\u7f16\u8bd1\u524d\u7aef\u9879\u76ee\u7684\u955c\u50cf\u4ee5\u53ca\u8fdb\u884c\u4e00\u4e9b\u914d\u7f6e\u3002"),(0,l.kt)("h3",{id:"\u65b9\u6cd51\u4ece\u6e90\u7801\u6784\u5efa\u65f6\u914d\u7f6e\u6574\u4e2a\u7cfb\u7edf\u7684\u76f8\u5bf9\u8def\u5f84"},"\u65b9\u6cd51\uff1a\u4ece\u6e90\u7801\u6784\u5efa\u65f6\u914d\u7f6e\u6574\u4e2a\u7cfb\u7edf\u7684\u76f8\u5bf9\u8def\u5f84"),(0,l.kt)("p",null,"\u60a8\u53ef\u4ee5\u4f7f\u7528\u4ee5\u4e0b\u547d\u4ee4\u6784\u5efa\u6574\u4e2a\u7cfb\u7edf\u7684\u6240\u6709\u955c\u50cf\u3002"),(0,l.kt)("pre",null,(0,l.kt)("code",{parentName:"pre",className:"language-bash"},"docker compose --env-file dev/.env.build -f dev/docker-compose.build.yml build \n")),(0,l.kt)("p",null,"\u6784\u5efa\u5b8c\u6210\u540e\uff0c\u5c06\u4f1a\u751f\u6210\u4ee5\u4e0b\u56db\u4e2aweb\u76f8\u5173\u7684\u955c\u50cf\uff1a"),(0,l.kt)("table",null,(0,l.kt)("thead",{parentName:"table"},(0,l.kt)("tr",{parentName:"thead"},(0,l.kt)("th",{parentName:"tr",align:null},"\u7cfb\u7edf"),(0,l.kt)("th",{parentName:"tr",align:null},"\u955c\u50cf\uff08\u4e0d\u5305\u62ecIMAGE_BASE\u90e8\u5206\uff09"),(0,l.kt)("th",{parentName:"tr",align:null},"\u76f8\u5bf9\u8def\u5f84"))),(0,l.kt)("tbody",{parentName:"table"},(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"\u95e8\u6237"),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"portal-web-root")),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"/"))),(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"\u95e8\u6237"),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"portal-web-portal")),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"/portal"))),(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"\u7ba1\u7406"),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"mis-web-root")),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"/"))),(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"\u7ba1\u7406"),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"mis-web-mis")),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"/mis"))))),(0,l.kt)("p",null,"\u60a8\u4e5f\u53ef\u4ee5\u9009\u62e9\u6027\u5730\u6784\u5efa\u60a8\u9700\u8981\u7684\u955c\u50cf\uff0c\u800c\u4e0d\u662f\u4ee5\u4e0a\u7684\u6240\u6709\u955c\u50cf\u3002\u4f8b\u5982\uff0c\u4ee5\u4e0b\u547d\u4ee4\u53ea\u4f1a\u6784\u5efa",(0,l.kt)("inlineCode",{parentName:"p"},"portal-web-root"),"\u4e00\u4e2a\u955c\u50cf"),(0,l.kt)("pre",null,(0,l.kt)("code",{parentName:"pre",className:"language-bash"},"docker compose --env-file dev/.env.build -f dev/docker-compose.build.yml build portal-web-root\n")),(0,l.kt)("p",null,"\u5982\u679c\u60a8\u53ea\u9700\u8981\u5728\u5df2\u7ecf\u63d0\u4f9b\u7684\u76f8\u5bf9\u8def\u5f84\uff08",(0,l.kt)("inlineCode",{parentName:"p"},"/"),"\u3001",(0,l.kt)("inlineCode",{parentName:"p"},"/portal"),"\u548c",(0,l.kt)("inlineCode",{parentName:"p"},"/mis"),"\uff09\u524d\u9762\u52a0\u4e0a\u4e00\u6bb5\u8def\u5f84\uff0c\u60a8\u53ef\u4ee5\u5728\u8fd0\u884c\u6b64",(0,l.kt)("inlineCode",{parentName:"p"},"docker compose build"),"\u547d\u4ee4\u65f6\u901a\u8fc7Shell\u4f20\u5165",(0,l.kt)("inlineCode",{parentName:"p"},"BASE_PATH"),"\u73af\u5883\u53d8\u91cf\u3002"),(0,l.kt)("p",null,"\u4f8b\u5982\uff0c\u5982\u679c\u4fee\u6539\u7684\u6216\u8005\u4f20\u5165\u7684",(0,l.kt)("inlineCode",{parentName:"p"},"BASE_PATH"),"\u4e3a",(0,l.kt)("inlineCode",{parentName:"p"},"/demo"),"\uff0c\u90a3\u4e48\u4e0a\u8ff0\u547d\u4ee4\u5c06\u4f1a\u751f\u6210\u4ee5\u4e0b4\u4e2aweb\u76f8\u5173\u7684\u955c\u50cf"),(0,l.kt)("table",null,(0,l.kt)("thead",{parentName:"table"},(0,l.kt)("tr",{parentName:"thead"},(0,l.kt)("th",{parentName:"tr",align:null},"\u7cfb\u7edf"),(0,l.kt)("th",{parentName:"tr",align:null},"\u955c\u50cf\uff08\u4e0d\u5305\u62ecIMAGE_BASE\u90e8\u5206\uff09"),(0,l.kt)("th",{parentName:"tr",align:null},"\u76f8\u5bf9\u8def\u5f84"))),(0,l.kt)("tbody",{parentName:"table"},(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"\u95e8\u6237"),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"portal-web-root")),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"/demo/"))),(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"\u95e8\u6237"),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"portal-web-portal")),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"/demo/portal"))),(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"\u7ba1\u7406"),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"mis-web-root")),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"/demo/"))),(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"\u7ba1\u7406"),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"mis-web-mis")),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"/demo/mis"))))),(0,l.kt)("p",null,"\u5047\u8bbe\u6574\u4e2a\u7cfb\u7edf\u5728",(0,l.kt)("inlineCode",{parentName:"p"},"/demo"),"\u4e0b\uff0c\u95e8\u6237\u7cfb\u7edf\u8fd0\u884c\u5728",(0,l.kt)("inlineCode",{parentName:"p"},"/demo"),"\u4e0b\uff0c\u7ba1\u7406\u7cfb\u7edf\u5728",(0,l.kt)("inlineCode",{parentName:"p"},"/demo/mis"),"\u4e0b\u3002"),(0,l.kt)("p",null,"\u60a8\u53ef\u4ee5\u76f4\u63a5\u8fd0\u884c\u4ee5\u4e0b\u547d\u4ee4\u6784\u5efa\u6240\u6709\u955c\u50cf\uff1a"),(0,l.kt)("pre",null,(0,l.kt)("code",{parentName:"pre",className:"language-bash"},"BASE_PATH=/demo docker compose --env-file dev/.env.build -f dev/docker-compose.build.yml build\n")),(0,l.kt)("p",null,"\u4e5f\u53ef\u4ee5\u9009\u62e9\u6027\u5730\u53ea\u6784\u5efa\u90e8\u5206\u955c\u50cf\uff1a\u56e0\u4e3a",(0,l.kt)("inlineCode",{parentName:"p"},"/demo"),"\u76f8\u5bf9\u4e8e",(0,l.kt)("inlineCode",{parentName:"p"},"/demo"),"\u4e3a",(0,l.kt)("inlineCode",{parentName:"p"},"/"),"\uff0c",(0,l.kt)("inlineCode",{parentName:"p"},"/demo/mis"),"\u76f8\u5bf9\u4e8e",(0,l.kt)("inlineCode",{parentName:"p"},"/demo"),"\u4e3a",(0,l.kt)("inlineCode",{parentName:"p"},"/mis"),"\uff0c\u6240\u4ee5\u6211\u4eec\u53ea\u9700\u8981\u91cd\u65b0\u6784\u5efa",(0,l.kt)("inlineCode",{parentName:"p"},"portal-web-root"),"\u548c",(0,l.kt)("inlineCode",{parentName:"p"},"mis-web-mis"),"\u4e24\u4e2a\u955c\u50cf\u3002\u6240\u4ee5\u8fd0\u884c"),(0,l.kt)("pre",null,(0,l.kt)("code",{parentName:"pre",className:"language-bash"},"BASE_PATH=/demo docker compose --env-file dev/.env.build -f dev/docker-compose.build.yml build portal-web-root mis-web-mis\n")),(0,l.kt)("p",null,"\u5c06\u4f1a\u6784\u5efa\u51fa\u4e24\u4e2a\u955c\u50cf\uff1a"),(0,l.kt)("table",null,(0,l.kt)("thead",{parentName:"table"},(0,l.kt)("tr",{parentName:"thead"},(0,l.kt)("th",{parentName:"tr",align:null},"\u7cfb\u7edf"),(0,l.kt)("th",{parentName:"tr",align:null},"\u955c\u50cf\uff08\u4e0d\u5305\u62ecIMAGE_BASE\u90e8\u5206\uff09"),(0,l.kt)("th",{parentName:"tr",align:null},"\u76f8\u5bf9\u8def\u5f84"))),(0,l.kt)("tbody",{parentName:"table"},(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"\u95e8\u6237"),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"portal-web-root")),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"/demo"))),(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"\u7ba1\u7406"),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"mis-web-mis")),(0,l.kt)("td",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"td"},"/demo/mis"))))),(0,l.kt)("p",null,"\u6784\u5efa\u597d\u955c\u50cf\u540e\uff0c",(0,l.kt)("inlineCode",{parentName:"p"},"config.py"),"\u4e2d\u7684\u4fee\u6539\u5982\u4e0b\u3002"),(0,l.kt)("pre",null,(0,l.kt)("code",{parentName:"pre",className:"language-python"},'# \u6574\u4e2a\u7cfb\u7edf\u7684\u6839\u8def\u5f84\nCOMMON = {\n  "BASE_PATH": "/demo",\n  # ...\n}\n\n# \u5df2\u7ecf\u90e8\u7f72\u7684\u95e8\u6237\u7cfb\u7edf\n# \u95e8\u6237\u7cfb\u7edf\u90e8\u7f72\u5728/demo\u4e0b\uff0c\u76f8\u5bf9\u4e8eCOMMON.BASE_PATH\u662f\u6839\u8def\u5f84\uff0c\u6240\u4ee5\u8bbe\u7f6ePORTAL.BASE_PATH\u4e3a/\n# PORTAL.BASE_PATH\u82e5\u4e0d\u8bbe\u7f6e\uff0c\u9ed8\u8ba4\u503c\u4e3a/\n# \u95e8\u6237\u7cfb\u7edf\u5bf9\u5e94\u6b64\u57fa\u7840\u8def\u5f84\u7684\u955c\u50cf\u4e3aportal-web-root\uff0c\u6240\u4ee5PORTAL.IMAGE_POSTFIX\u53d6root\nPORTAL = {\n  "BASE_PATH": "/",\n  "IMAGE_POSTFIX": "root"\n}\n\n\n# \u5df2\u7ecf\u90e8\u7f72\u7684\u7ba1\u7406\u7cfb\u7edf\n# \u7ba1\u7406\u7cfb\u7edf\u90e8\u7f72\u5728/demo/mis\u4e0b\uff0c\u76f8\u5bf9\u4e8eCOMMON.BASE_PATH\u4e3a/mis\uff0c\u6240\u4ee5\u8bbe\u7f6eMIS.BASE_PATH\u4e3a/scow-mis\n# \u7ba1\u7406\u7cfb\u7edf\u5bf9\u5e94\u6b64\u57fa\u7840\u8def\u5f84\u7684\u955c\u50cf\u7684\u662fmis-web-mis\uff0c\u6240\u4ee5MIS.IMAGE_POSTFIX\u53d6mis\nMIS = {\n  "BASE_PATH": "/mis",\n  "IMAGE_POSTFIX": "mis",\n  # ...\n}\n\n')),(0,l.kt)("h3",{id:"\u65b9\u6cd52\u66f4\u7075\u6d3b\u5730\u81ea\u5b9a\u4e49\u8def\u5f84"},"\u65b9\u6cd52\uff1a\u66f4\u7075\u6d3b\u5730\u81ea\u5b9a\u4e49\u8def\u5f84"),(0,l.kt)("p",null,"\u5982\u679c\u60a8\u60f3\u8981\u66f4\u7075\u6d3b\u5730\u81ea\u5b9a\u4e49\u76f8\u5bf9\u8def\u5f84\uff0c\u8bf7\u53c2\u8003\u4ee5\u4e0b\u65b9\u6848\uff1a"),(0,l.kt)("p",null,"\u6211\u4eec\u5047\u8bbe\u6574\u4e2a\u7cfb\u7edf\u90e8\u7f72\u5728",(0,l.kt)("inlineCode",{parentName:"p"},"/demo1"),"\u4e4b\u4e0b\uff0c\u95e8\u6237\u5728",(0,l.kt)("inlineCode",{parentName:"p"},"/demo1"),"\u6839\u76ee\u5f55\u4e0b\uff0c\u7ba1\u7406\u7cfb\u7edf\u5728",(0,l.kt)("inlineCode",{parentName:"p"},"/demo1/scow-mis"),"\u4e0b\uff0c",(0,l.kt)("inlineCode",{parentName:"p"},"config.py"),"\u4e2d\u7684",(0,l.kt)("inlineCode",{parentName:"p"},"COMMON.IMAGE_BASE"),"\u4e3a",(0,l.kt)("inlineCode",{parentName:"p"},"ghcr.io/pkuhpc/scow"),"\uff0c",(0,l.kt)("inlineCode",{parentName:"p"},"COMMON.IMAGE_TAG"),"\u4e3a",(0,l.kt)("inlineCode",{parentName:"p"},"master"),"\u3002"),(0,l.kt)("p",null,"\u8fd9\u79cd\u60c5\u51b5\u64cd\u4f5c\u5982\u4e0b\uff1a"),(0,l.kt)("ol",null,(0,l.kt)("li",{parentName:"ol"},(0,l.kt)("p",{parentName:"li"},"\u786e\u4fdd\u64cd\u4f5c\u673a\u5668\u4e2d\u5b89\u88c5\u4e86\u4ee5\u4e0b\u5b89\u88c5\u4e86",(0,l.kt)("a",{parentName:"p",href:"https://docs.docker.com/engine/install/"},"docker"))),(0,l.kt)("li",{parentName:"ol"},(0,l.kt)("p",{parentName:"li"},"\u514b\u9686\u4ed3\u5e93\u6e90\u7801"))),(0,l.kt)("pre",null,(0,l.kt)("code",{parentName:"pre",className:"language-bash"},"git clone --depth=1 https://github.com/PKUHPC/SCOW\n")),(0,l.kt)("ol",{start:3},(0,l.kt)("li",{parentName:"ol"},"\u6784\u5efa\u955c\u50cf")),(0,l.kt)("pre",null,(0,l.kt)("code",{parentName:"pre",className:"language-bash"},'# \u5728\u9879\u76ee\u6839\u76ee\u5f55\u5904\u8fd0\u884c\n# BASE_PATH\u8bbe\u7f6e\u4e3a\u90e8\u7f72\u65f6\u7684\u76f8\u5bf9\u8def\u5f84\uff0c\u4ee5/\u5f00\u5934\uff0c\u4e0d\u8981\u4ee5/\u7ed3\u5c3e\n\n# \u7ba1\u7406\u7cfb\u7edf\ndocker build -f dockerfiles/Dockerfile.mis-web --build-arg BASE_PATH="/demo1/scow-mis" -t "ghcr.io/pkuhpc/scow/mis-web-mis1:master" .\n\n# \u95e8\u6237\u7cfb\u7edf\ndocker build -f dockerfiles/Dockerfile.portal-web --build-arg BASE_PATH="/demo1" -t "ghcr.io/pkuhpc/scow/portal-web-portal1:master" .\n')),(0,l.kt)("ol",{start:4},(0,l.kt)("li",{parentName:"ol"},"\u6784\u5efa\u5b8c\u6210\u540e\uff0c\u4fee\u6539",(0,l.kt)("inlineCode",{parentName:"li"},"config.py"))),(0,l.kt)("pre",null,(0,l.kt)("code",{parentName:"pre",className:"language-python"},'# \u5177\u4f53\u6ce8\u91ca\u8bf7\u53c2\u8003config.py\u4e2d\u7684\u5907\u6ce8\n\n# \u6574\u4e2a\u7cfb\u7edf\u7684\u6839\u8def\u5f84\nCOMMON = {\n  "BASE_PATH": "/demo1",\n  # ...\n}\n\n# \u5df2\u7ecf\u90e8\u7f72\u7684\u95e8\u6237\u7cfb\u7edf\n# \u95e8\u6237\u7cfb\u7edf\u90e8\u7f72\u5728/demo1\u4e0b\uff0c\u76f8\u5bf9\u4e8eCOMMON.BASE_PATH\u662f\u6839\u8def\u5f84\uff0c\u6240\u4ee5\u8bbe\u7f6ePORTAL.BASE_PATH\u4e3a/\n# PORTAL.BASE_PATH\u82e5\u4e0d\u8bbe\u7f6e\uff0c\u9ed8\u8ba4\u503c\u4e3a/\n# \u95e8\u6237\u7cfb\u7edf\u7684\u955c\u50cf\u662fportal-web-{portal1}\uff0c\u6240\u4ee5PORTAL.IMAGE_POSTFIX\u53d6portal1\nPORTAL = {\n  "BASE_PATH": "/",\n  "IMAGE_POSTFIX": "portal1"\n}\n\n\n# \u5df2\u7ecf\u90e8\u7f72\u7684\u7ba1\u7406\u7cfb\u7edf\n# \u7ba1\u7406\u7cfb\u7edf\u90e8\u7f72\u5728/demo1/scow-mis\u4e0b\uff0c\u76f8\u5bf9\u4e8eCOMMON.BASE_PATH\u4e3a/scow-mis\uff0c\u6240\u4ee5\u8bbe\u7f6eMIS.BASE_PATH\u4e3a/scow-mis\n# \u7ba1\u7406\u7cfb\u7edf\u7684\u955c\u50cf\u7684\u662fmis-web-{mis1}\uff0c\u6240\u4ee5MIS.IMAGE_POSTFIX\u53d6mis1\nMIS = {\n  "BASE_PATH": "/scow-mis",\n  "IMAGE_POSTFIX": "mis1",\n  # ...\n}\n\n')),(0,l.kt)("h2",{id:"configpy\u4e2dbase_path\u586b\u5199\u89c4\u5219"},(0,l.kt)("inlineCode",{parentName:"h2"},"config.py"),"\u4e2d",(0,l.kt)("inlineCode",{parentName:"h2"},"BASE_PATH"),"\u586b\u5199\u89c4\u5219"),(0,l.kt)("p",null,(0,l.kt)("inlineCode",{parentName:"p"},"config.py"),"\u4e2d\uff0c",(0,l.kt)("inlineCode",{parentName:"p"},"COMMON.BASE_PATH"),"\u3001",(0,l.kt)("inlineCode",{parentName:"p"},"PORTAL.BASE_PATH"),"\u548c",(0,l.kt)("inlineCode",{parentName:"p"},"MIS.BASE_PATH"),"\u5747\u4e0d\u4ee5",(0,l.kt)("inlineCode",{parentName:"p"},"/"),"\u7ed3\u5c3e\u3002",(0,l.kt)("inlineCode",{parentName:"p"},"COMMON.BASE_PATH"),"\u586b\u5199\u6574\u4e2a\u7cfb\u7edf\u7684\u6839\u8def\u5f84\uff0c",(0,l.kt)("inlineCode",{parentName:"p"},"PORTAL.BASE_PATH"),"\u548c",(0,l.kt)("inlineCode",{parentName:"p"},"MIS.BASE_PATH"),"\u5206\u522b\u8868\u793a\u95e8\u6237\u7cfb\u7edf\u548c\u7ba1\u7406\u7cfb\u7edf\u76f8\u5bf9\u4e8e\u7cfb\u7edf\u7684\u76f8\u5bf9\u8def\u5f84\uff0c\u9075\u5faa\u4ee5\u4e0b\u7684\u7f16\u5199\u539f\u5219\uff1a"),(0,l.kt)("table",null,(0,l.kt)("thead",{parentName:"table"},(0,l.kt)("tr",{parentName:"thead"},(0,l.kt)("th",{parentName:"tr",align:null},"\u6574\u4e2a\u7cfb\u7edf\u7684\u8bbf\u95ee\u8def\u5f84"),(0,l.kt)("th",{parentName:"tr",align:null},"\u95e8\u6237\u7cfb\u7edf\u7684\u8bbf\u95ee\u8def\u5f84"),(0,l.kt)("th",{parentName:"tr",align:null},"\u7ba1\u7406\u7cfb\u7edf\u7684\u8bbf\u95ee\u8def\u5f84"),(0,l.kt)("th",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"th"},"COMMON.BASE_PATH")),(0,l.kt)("th",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"th"},"PORTAL.BASE_PATH")),(0,l.kt)("th",{parentName:"tr",align:null},(0,l.kt)("inlineCode",{parentName:"th"},"MIS.BASE_PATH")))),(0,l.kt)("tbody",{parentName:"table"},(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"/"),(0,l.kt)("td",{parentName:"tr",align:null},"/"),(0,l.kt)("td",{parentName:"tr",align:null},"/mis"),(0,l.kt)("td",{parentName:"tr",align:null},"/"),(0,l.kt)("td",{parentName:"tr",align:null},"/"),(0,l.kt)("td",{parentName:"tr",align:null},"/mis")),(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"/"),(0,l.kt)("td",{parentName:"tr",align:null},"/portal"),(0,l.kt)("td",{parentName:"tr",align:null},"/"),(0,l.kt)("td",{parentName:"tr",align:null},"/"),(0,l.kt)("td",{parentName:"tr",align:null},"/portal"),(0,l.kt)("td",{parentName:"tr",align:null},"/")),(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"/scow"),(0,l.kt)("td",{parentName:"tr",align:null},"/scow"),(0,l.kt)("td",{parentName:"tr",align:null},"/scow/mis"),(0,l.kt)("td",{parentName:"tr",align:null},"/scow"),(0,l.kt)("td",{parentName:"tr",align:null},"/"),(0,l.kt)("td",{parentName:"tr",align:null},"/mis")),(0,l.kt)("tr",{parentName:"tbody"},(0,l.kt)("td",{parentName:"tr",align:null},"/scow"),(0,l.kt)("td",{parentName:"tr",align:null},"/scow/portal"),(0,l.kt)("td",{parentName:"tr",align:null},"/scow"),(0,l.kt)("td",{parentName:"tr",align:null},"/scow"),(0,l.kt)("td",{parentName:"tr",align:null},"/portal"),(0,l.kt)("td",{parentName:"tr",align:null},"/")))))}k.isMDXComponent=!0}}]);