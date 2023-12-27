"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[9436],{55527:(e,t,s)=>{s.r(t),s.d(t,{assets:()=>c,contentTitle:()=>r,default:()=>u,frontMatter:()=>o,metadata:()=>a,toc:()=>i});var p=s(35250),n=s(57766);const o={slug:"update-portal-app",title:"\u4ea4\u4e92\u5f0f\u5e94\u7528\u914d\u7f6e\u66f4\u65b0",authors:["sunyixin"],tags:["scow","scow-portal-apps","scow-apps"]},r=void 0,a={permalink:"/SCOW/pr-preview/pr-1044/blog/update-portal-app",editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/blog/blog/2023-07-05-update-app.md",source:"@site/blog/2023-07-05-update-app.md",title:"\u4ea4\u4e92\u5f0f\u5e94\u7528\u914d\u7f6e\u66f4\u65b0",description:"\u4e0a\u4e00\u4e2a\u7248\u672c\uff0c\u5728SCOW\u95e8\u6237\u7cfb\u7edf\u7684\u4ea4\u4e92\u5f0f\u5e94\u7528\u4e0b\uff0c\u6211\u4eec\u901a\u8fc7\u5728config/apps\u4e0b\u914d\u7f6e\u7684\u4ea4\u4e92\u5f0f\u5e94\u7528\uff0c\u5b9e\u73b0\u521b\u5efa\u5404\u4e2a\u96c6\u7fa4\u4e0b\u5747\u53ef\u4ee5\u4f7f\u7528\u7684\u4ea4\u4e92\u5f0f\u5e94\u7528\u3002",date:"2023-07-05T00:00:00.000Z",formattedDate:"2023\u5e747\u67085\u65e5",tags:[{label:"scow",permalink:"/SCOW/pr-preview/pr-1044/blog/tags/scow"},{label:"scow-portal-apps",permalink:"/SCOW/pr-preview/pr-1044/blog/tags/scow-portal-apps"},{label:"scow-apps",permalink:"/SCOW/pr-preview/pr-1044/blog/tags/scow-apps"}],readingTime:1.305,hasTruncateMarker:!1,authors:[{name:"Sun Yixin",title:"Developer",url:"https://github.com/piccaSun",imageURL:"https://avatars.githubusercontent.com/u/43978285",key:"sunyixin"}],frontMatter:{slug:"update-portal-app",title:"\u4ea4\u4e92\u5f0f\u5e94\u7528\u914d\u7f6e\u66f4\u65b0",authors:["sunyixin"],tags:["scow","scow-portal-apps","scow-apps"]},unlisted:!1,prevItem:{title:"SCOW\u5347\u7ea7\uff1a\u4ecev0.4.0(\u53ca\u4ee5\u4e0a)\u5230v1.0.0",permalink:"/SCOW/pr-preview/pr-1044/blog/scow-update-to-v1.0"},nextItem:{title:"SCOW\u8c03\u5ea6\u5668\u9002\u914d\u5668",permalink:"/SCOW/pr-preview/pr-1044/blog/scow-scheduler-adapter"}},c={authorsImageUrls:[void 0]},i=[];function l(e){const t={a:"a",code:"code",li:"li",p:"p",ul:"ul",...(0,n.a)(),...e.components};return(0,p.jsxs)(p.Fragment,{children:[(0,p.jsxs)(t.p,{children:["\u4e0a\u4e00\u4e2a\u7248\u672c\uff0c\u5728SCOW\u95e8\u6237\u7cfb\u7edf\u7684\u4ea4\u4e92\u5f0f\u5e94\u7528\u4e0b\uff0c\u6211\u4eec\u901a\u8fc7\u5728",(0,p.jsx)(t.code,{children:"config/apps"}),"\u4e0b\u914d\u7f6e\u7684\u4ea4\u4e92\u5f0f\u5e94\u7528\uff0c\u5b9e\u73b0\u521b\u5efa\u5404\u4e2a\u96c6\u7fa4\u4e0b\u5747\u53ef\u4ee5\u4f7f\u7528\u7684\u4ea4\u4e92\u5f0f\u5e94\u7528\u3002\n\u4f46\u662f\u8003\u8651\u5230\u4e0d\u540c\u96c6\u7fa4\u7684\u8ba1\u7b97\u673a\u8282\u70b9\u4e0b\u5b89\u88c5\u73af\u5883\u4e0d\u540c\uff0c\u53ef\u80fd\u65e0\u6cd5\u6ee1\u8db3\u5bf9\u6240\u6709\u83b7\u53d6\u5230\u7684\u4ea4\u4e92\u5f0f\u5e94\u7528\u7684\u6b63\u5e38\u4f7f\u7528\u3002"]}),"\n",(0,p.jsx)(t.p,{children:"\u4e3a\u4e86\u8ba9\u5927\u5bb6\u66f4\u65b9\u4fbf\u3001\u9ad8\u6548\u5730\u7ba1\u7406\u548c\u4f7f\u7528SCOW\u96c6\u7fa4\uff0c\u6211\u4eec\u5728\u65b0\u7248\u672c\u7684\u4ea4\u4e92\u5f0f\u5e94\u7528\u914d\u7f6e\u90e8\u5206\uff0c\u5b9e\u73b0\u4e86\u4ee5\u4e0b\u529f\u80fd\uff1a"}),"\n",(0,p.jsxs)(t.ul,{children:["\n",(0,p.jsxs)(t.li,{children:["\u5b9e\u73b0\u5728",(0,p.jsx)(t.code,{children:"config/clusters/{\u96c6\u7fa4ID}/apps"}),"\u4e0b\u5bf9\u7279\u5b9a\u96c6\u7fa4\u53ef\u4ee5\u4f7f\u7528\u7684\u4ea4\u4e92\u5f0f\u5e94\u7528\u8fdb\u884c\u5355\u72ec\u914d\u7f6e"]}),"\n",(0,p.jsxs)(t.li,{children:["\u540c\u65f6\u6709\u6548\u517c\u5bb9\u65e7\u7248\u672c",(0,p.jsx)(t.code,{children:"config/apps"}),"\u4e0b\u6240\u6709\u96c6\u7fa4\u5747\u53ef\u4ee5\u4f7f\u7528\u7684\u4ea4\u4e92\u5f0f\u5e94\u7528\u914d\u7f6e"]}),"\n",(0,p.jsx)(t.li,{children:"\u4ea4\u4e92\u5f0f\u5e94\u7528\u914d\u7f6e\u589e\u52a0\u53ef\u9009\u81ea\u5b9a\u4e49\u56fe\u6807\u914d\u7f6e\uff0c\u5728\u521b\u5efa\u5e94\u7528\u9875\u9762\u5b9e\u73b0\u4ea4\u4e92\u5f0f\u5e94\u7528\u56fe\u6807\u53ef\u89c6\u5316\u7ba1\u7406"}),"\n"]}),"\n",(0,p.jsxs)(t.p,{children:["\u8be6\u7ec6\u8bf4\u660e\u53ef\u53c2\u8003SCOW",(0,p.jsx)(t.code,{children:"\u90e8\u7f72\u548c\u914d\u7f6e"}),"\u4e0b\u7684",(0,p.jsx)(t.a,{href:"https://PKUHPC.github.io/SCOW/pr-preview/pr-1044/docs/deploy/config/portal/apps/configure-cluster-apps",children:"\u591a\u96c6\u7fa4\u4e0b\u7684\u5e94\u7528\u914d\u7f6e"}),"\u3002"]})]})}function u(e={}){const{wrapper:t}={...(0,n.a)(),...e.components};return t?(0,p.jsx)(t,{...e,children:(0,p.jsx)(l,{...e})}):l(e)}},57766:(e,t,s)=>{s.d(t,{Z:()=>a,a:()=>r});var p=s(70079);const n={},o=p.createContext(n);function r(e){const t=p.useContext(o);return p.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:r(e.components),p.createElement(o.Provider,{value:t},e.children)}}}]);