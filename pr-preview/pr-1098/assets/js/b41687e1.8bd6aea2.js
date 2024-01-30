"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[9155],{53381:(e,c,s)=>{s.r(c),s.d(c,{assets:()=>i,contentTitle:()=>l,default:()=>p,frontMatter:()=>n,metadata:()=>r,toc:()=>d});var o=s(35250),t=s(57766);const n={slug:"scow-cli-release",title:"scow-cli",authors:["chenjunda"],tags:["scow","scow-cli","scow-deployment"]},l="scow-cli",r={permalink:"/SCOW/pr-preview/pr-1098/blog/scow-cli-release",editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/blog/blog/2023-03-29-scow-cli.md",source:"@site/blog/2023-03-29-scow-cli.md",title:"scow-cli",description:"\u6211\u4eec\u81f4\u529b\u4e8e\u4ee5\u8ba9\u5927\u5bb6\u66f4\u65b9\u4fbf\u5730\u90e8\u7f72\u3001\u8fd0\u7ef4\u548c\u7ba1\u7406SCOW\u96c6\u7fa4\u3002",date:"2023-03-29T00:00:00.000Z",formattedDate:"2023\u5e743\u670829\u65e5",tags:[{label:"scow",permalink:"/SCOW/pr-preview/pr-1098/blog/tags/scow"},{label:"scow-cli",permalink:"/SCOW/pr-preview/pr-1098/blog/tags/scow-cli"},{label:"scow-deployment",permalink:"/SCOW/pr-preview/pr-1098/blog/tags/scow-deployment"}],readingTime:1.285,hasTruncateMarker:!1,authors:[{name:"Chen Junda",title:"Developer",url:"https://ddadaal.me",imageURL:"https://avatars.githubusercontent.com/u/8363856",key:"chenjunda"}],frontMatter:{slug:"scow-cli-release",title:"scow-cli",authors:["chenjunda"],tags:["scow","scow-cli","scow-deployment"]},unlisted:!1,prevItem:{title:"SCOW\u8c03\u5ea6\u5668\u9002\u914d\u5668",permalink:"/SCOW/pr-preview/pr-1098/blog/scow-scheduler-adapter"},nextItem:{title:"scow-deployment\u5e73\u6ed1\u5347\u7ea7\u6307\u5bfc",permalink:"/SCOW/pr-preview/pr-1098/blog/update-to-python-deployment"}},i={authorsImageUrls:[void 0]},d=[];function a(e){const c={a:"a",code:"code",li:"li",p:"p",ul:"ul",...(0,t.a)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(c.p,{children:"\u6211\u4eec\u81f4\u529b\u4e8e\u4ee5\u8ba9\u5927\u5bb6\u66f4\u65b9\u4fbf\u5730\u90e8\u7f72\u3001\u8fd0\u7ef4\u548c\u7ba1\u7406SCOW\u96c6\u7fa4\u3002"}),"\n",(0,o.jsxs)(c.p,{children:["\u4e4b\u524d\u7684",(0,o.jsx)(c.code,{children:"scow-deployment"}),"\u4e3a\u4e86\u4fdd\u8bc1\u65e0\u9700\u5b89\u88c5\u4f9d\u8d56\u5747\u53ef\u4f7f\u7528\uff0c\u6240\u4ee5\u91c7\u7528\u4e86\u548cSCOW\u5176\u4ed6\u90e8\u5206\u4e0d\u4e00\u6837\u7684python\u8bed\u8a00\u5f00\u53d1\uff0c\u4e14\u65e0\u6cd5\u4f7f\u7528\u7b2c\u4e09\u65b9\u5305\u7684\u529f\u80fd\uff0c\u9650\u5236\u4e86",(0,o.jsx)(c.code,{children:"scow-deployment"}),"\u7684\u529f\u80fd\u3002"]}),"\n",(0,o.jsxs)(c.p,{children:["\u4e3a\u4e86\u89e3\u51b3\u8fd9\u4e9b\u95ee\u9898\uff0c\u6211\u4eec\u91cd\u65b0\u7f16\u5199\u4e86",(0,o.jsx)(c.code,{children:"scow-cli"}),"\u3002\u6b64\u5de5\u5177\u6709\u4ee5\u4e0b\u7279\u70b9\uff1a"]}),"\n",(0,o.jsxs)(c.ul,{children:["\n",(0,o.jsxs)(c.li,{children:["\u4f7f\u7528",(0,o.jsx)(c.code,{children:"install.yaml"}),"\u8fdb\u884c\u914d\u7f6e\uff0c\u914d\u7f6e\u65b9\u5f0f\u548c\u7cfb\u7edf\u5176\u4ed6\u90e8\u5206\u76f8\u540c"]}),"\n",(0,o.jsx)(c.li,{children:"\u53ef\u81ea\u7531\u4f7f\u7528\u7b2c\u4e09\u65b9\u5305\uff0c\u529f\u80fd\u6269\u5c55\u8d77\u6765\u66f4\u52a0\u65b9\u4fbf"}),"\n",(0,o.jsx)(c.li,{children:"\u6b64\u5de5\u5177\u91c7\u7528\u548c\u7cfb\u7edf\u5176\u4ed6\u90e8\u5206\u76f8\u540c\u7684\u6280\u672f\u6808\u7f16\u5199\uff0c\u65b9\u4fbf\u540e\u7eed\u529f\u80fd\u5f00\u53d1\u548c\u7ef4\u62a4"}),"\n",(0,o.jsx)(c.li,{children:"\u6253\u5305\u4e3a\u4e00\u4e2a\u53ef\u4ee5\u76f4\u63a5\u6267\u884c\u7684\u53ef\u6267\u884c\u6587\u4ef6\uff0c\u540c\u6837\u65e0\u9700\u5b89\u88c5\u4efb\u4f55\u4f9d\u8d56\u5373\u53ef\u4f7f\u7528"}),"\n"]}),"\n",(0,o.jsxs)(c.p,{children:[(0,o.jsx)(c.code,{children:"scow-cli"}),"\u662f\u540e\u7eed\u589e\u52a0\u66f4\u591a\u547d\u4ee4\u884c\u7ef4\u62a4\u529f\u80fd\u7684\u57fa\u7840\uff0c\u5efa\u8bae\u5927\u5bb6\u5c3d\u5feb\u4ece",(0,o.jsx)(c.code,{children:"scow-deployment"}),"\u8fc1\u79fb\u5230",(0,o.jsx)(c.code,{children:"scow-cli"}),"\u3002"]}),"\n",(0,o.jsxs)(c.p,{children:["\u8bf7\u53c2\u8003",(0,o.jsx)(c.a,{href:"https://PKUHPC.github.io/SCOW/pr-preview/pr-1098/docs/deploy/install/scow-cli",children:"scow-cli"}),"\u6587\u6863\u4ee5\u4e0b\u8f7dscow-cli\uff0c\u4ee5\u53ca\u4e86\u89e3\u5982\u4f55\u4ece",(0,o.jsx)(c.code,{children:"scow-deployment"}),"\u8fc1\u79fb\u5230",(0,o.jsx)(c.code,{children:"scow-cli"}),"\u3002"]})]})}function p(e={}){const{wrapper:c}={...(0,t.a)(),...e.components};return c?(0,o.jsx)(c,{...e,children:(0,o.jsx)(a,{...e})}):a(e)}},57766:(e,c,s)=>{s.d(c,{Z:()=>r,a:()=>l});var o=s(70079);const t={},n=o.createContext(t);function l(e){const c=o.useContext(n);return o.useMemo((function(){return"function"==typeof e?e(c):{...c,...e}}),[c,e])}function r(e){let c;return c=e.disableParentContext?"function"==typeof e.components?e.components(t):e.components||t:l(e.components),o.createElement(n.Provider,{value:c},e.children)}}}]);