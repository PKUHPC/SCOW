"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[6754],{4852:(e,n,t)=>{t.d(n,{Zo:()=>s,kt:()=>d});var r=t(9231);function o(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function a(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);n&&(r=r.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,r)}return t}function l(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?a(Object(t),!0).forEach((function(n){o(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):a(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function p(e,n){if(null==e)return{};var t,r,o=function(e,n){if(null==e)return{};var t,r,o={},a=Object.keys(e);for(r=0;r<a.length;r++)t=a[r],n.indexOf(t)>=0||(o[t]=e[t]);return o}(e,n);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(r=0;r<a.length;r++)t=a[r],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(o[t]=e[t])}return o}var i=r.createContext({}),c=function(e){var n=r.useContext(i),t=n;return e&&(t="function"==typeof e?e(n):l(l({},n),e)),t},s=function(e){var n=c(e.components);return r.createElement(i.Provider,{value:n},e.children)},u={inlineCode:"code",wrapper:function(e){var n=e.children;return r.createElement(r.Fragment,{},n)}},m=r.forwardRef((function(e,n){var t=e.components,o=e.mdxType,a=e.originalType,i=e.parentName,s=p(e,["components","mdxType","originalType","parentName"]),m=c(t),d=o,f=m["".concat(i,".").concat(d)]||m[d]||u[d]||a;return t?r.createElement(f,l(l({ref:n},s),{},{components:t})):r.createElement(f,l({ref:n},s))}));function d(e,n){var t=arguments,o=n&&n.mdxType;if("string"==typeof e||o){var a=t.length,l=new Array(a);l[0]=m;var p={};for(var i in n)hasOwnProperty.call(n,i)&&(p[i]=n[i]);p.originalType=e,p.mdxType="string"==typeof e?e:o,l[1]=p;for(var c=2;c<a;c++)l[c]=t[c];return r.createElement.apply(null,l)}return r.createElement.apply(null,t)}m.displayName="MDXCreateElement"},9789:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>i,contentTitle:()=>l,default:()=>u,frontMatter:()=>a,metadata:()=>p,toc:()=>c});var r=t(6215),o=(t(9231),t(4852));const a={sidebar_position:2,title:"\u90e8\u7f72"},l="\u90e8\u7f72\u95e8\u6237\u7cfb\u7edf",p={unversionedId:"portal/deployment",id:"portal/deployment",title:"\u90e8\u7f72",description:"\u672c\u8282\u4ecb\u7ecd\u5982\u4f55\u90e8\u7f72\u95e8\u6237\u7cfb\u7edf\u3002",source:"@site/docs/portal/deployment.md",sourceDirName:"portal",slug:"/portal/deployment",permalink:"/SCOW/docs/portal/deployment",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/portal/deployment.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2,title:"\u90e8\u7f72"},sidebar:"portal",previous:{title:"\u7b80\u4ecb",permalink:"/SCOW/docs/portal/"},next:{title:"\u7b80\u4ecb",permalink:"/SCOW/docs/portal/apps/"}},i={},c=[{value:"\u4fee\u6539.env\u6587\u4ef6",id:"\u4fee\u6539env\u6587\u4ef6",level:2},{value:"\u7f16\u5199\u95e8\u6237\u670d\u52a1\u914d\u7f6e",id:"\u7f16\u5199\u95e8\u6237\u670d\u52a1\u914d\u7f6e",level:2},{value:"\u542f\u52a8\u670d\u52a1",id:"\u542f\u52a8\u670d\u52a1",level:2}],s={toc:c};function u(e){let{components:n,...t}=e;return(0,o.kt)("wrapper",(0,r.Z)({},s,t,{components:n,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"\u90e8\u7f72\u95e8\u6237\u7cfb\u7edf"},"\u90e8\u7f72\u95e8\u6237\u7cfb\u7edf"),(0,o.kt)("p",null,"\u672c\u8282\u4ecb\u7ecd\u5982\u4f55\u90e8\u7f72\u95e8\u6237\u7cfb\u7edf\u3002"),(0,o.kt)("h2",{id:"\u4fee\u6539env\u6587\u4ef6"},"\u4fee\u6539.env\u6587\u4ef6"),(0,o.kt)("p",null,"\u4fee\u6539\u90e8\u7f72\u8def\u5f84\u4e0b\u7684.env\u6587\u4ef6"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-env"},"# \u786e\u4fddCOMPOSE_PROFILES\u4e2d\u5305\u62ecportal\n# COMPOSE_PROFILES=portal\nCOMPOSE_PROFILES=mis,portal\n\n# \u5982\u679c\u672c\u9879\u76ee\u5c06\u4f1a\u90e8\u7f72\u5728\u57df\u540d\u7684\u6839\u76ee\u5f55\u4e0b\uff0c\u6309\u5982\u4e0b\u8bbe\u7f6e\u8fd9\u4e24\u4e2a\u53d8\u91cf\nPORTAL_ROOT_URL=/\nPORTAL_IMAGE_POSTFIX=root\n\n# \u5982\u679c\u5c06\u4f1a\u90e8\u7f72\u5728`/portal`\u8def\u5f84\u4e0b\uff0c\u6309\u5982\u4e0b\u8bbe\u7f6e\u8fd9\u4e24\u4e2a\u53d8\u91cf\nPORTAL_ROOT_URL=/portal\nPORTAL_IMAGE_POSTFIX=root\n")),(0,o.kt)("h2",{id:"\u7f16\u5199\u95e8\u6237\u670d\u52a1\u914d\u7f6e"},"\u7f16\u5199\u95e8\u6237\u670d\u52a1\u914d\u7f6e"),(0,o.kt)("p",null,"\u5728",(0,o.kt)("inlineCode",{parentName:"p"},"config/portal.yaml"),"\u6587\u4ef6\u4e2d\uff0c\u6839\u636e\u5907\u6ce8\u4fee\u6539\u6240\u9700\u8981\u7684\u914d\u7f6e"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-yaml",metastring:'title="config/mis.yaml"',title:'"config/mis.yaml"'},'# \u662f\u5426\u542f\u7528\u4f5c\u4e1a\u7ba1\u7406\u529f\u80fd\njobManagement: true\n\n# \u767b\u5f55\u8282\u70b9\u684c\u9762\u529f\u80fd\nloginDesktop:\n  # \u662f\u5426\u542f\u7528\u684c\u9762\u529f\u80fd\n  enabled: true\n\n  # \u684c\u9762\n  wms: \n    # \u684c\u9762\u540d\u548c\u5bf9\u5e94\u7684wm\u503c\u3002\u89c1\u6587\u6863\n    - name: Xfce\n      wm: xfce\n\n  # \u6700\u591a\u542f\u52a8\u591a\u5c11\u4e2a\u684c\u9762\u8282\u70b9\n  maxDesktops: 3\n\n# \u662f\u5426\u542f\u7528\u4ea4\u4e92\u5f0f\u4efb\u52a1\u529f\u80fd\napps: true\n\n# \u4e3b\u9875\u6807\u9898\nhomeTitle: \n  # \u9ed8\u8ba4\u6587\u672c\n  defaultText: "Super Computing on Web"\n  # \u4ece\u4e0d\u540c\u57df\u540d\u8bbf\u95ee\uff0c\u663e\u793a\u7684\u4e0d\u540c\u7684\u6587\u672c\n  hostnameMap: \n    a.com: "a.com\'s SCOW Deployment"\n\n# \u4e3b\u9875\u6587\u672c\nhomeText: \n  # \u9ed8\u8ba4\u6587\u672c\n  defaultText: "SCOW"\n  # \u4ece\u4e0d\u540c\u57df\u540d\u8bbf\u95ee\uff0c\u663e\u793a\u7684\u4e0d\u540c\u7684\u6587\u672c\n  hostnameMap: \n    a.com: "a.com\'s SCOW"\n\n# \u662f\u5426\u542f\u7528\u7ec8\u7aef\u529f\u80fd\nshell: true\n\n# \u63d0\u4ea4\u4f5c\u4e1a\u7684\u9ed8\u8ba4\u5de5\u4f5c\u76ee\u5f55\u3002\u4f7f\u7528{name}\u4ee3\u66ff\u4f5c\u4e1a\u540d\u79f0\u3002\u76f8\u5bf9\u4e8e\u7528\u6237\u7684\u5bb6\u76ee\u5f55\n# submitJobDefaultPwd: scow/jobs/{name}\n\n# \u5c06\u4fdd\u5b58\u7684\u4f5c\u4e1a\u4fdd\u5b58\u5230\u4ec0\u4e48\u4f4d\u7f6e\u3002\u76f8\u5bf9\u4e8e\u7528\u6237\u5bb6\u76ee\u5f55\n# savedJobsDir: scow/savedJobs\n\n# \u5c06\u4ea4\u4e92\u5f0f\u4efb\u52a1\u7684\u4fe1\u606f\u4fdd\u5b58\u5230\u4ec0\u4e48\u4f4d\u7f6e\u3002\u76f8\u5bf9\u4e8e\u7528\u6237\u7684\u5bb6\u76ee\u5f55\n# appJobsDir: scow/appData\n\n# TurboVNC\u7684\u5b89\u88c5\u8def\u5f84\n# turboVNCPath: /opt/TurboVNC\n')),(0,o.kt)("h2",{id:"\u542f\u52a8\u670d\u52a1"},"\u542f\u52a8\u670d\u52a1"),(0,o.kt)("p",null,"\u8fd0\u884c",(0,o.kt)("inlineCode",{parentName:"p"},"docker compose up -d"),"\u542f\u52a8\u95e8\u6237\u7cfb\u7edf\u3002"))}u.isMDXComponent=!0}}]);