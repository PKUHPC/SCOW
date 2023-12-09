"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[9041],{52211:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>s,default:()=>p,frontMatter:()=>r,metadata:()=>d,toc:()=>a});var i=t(35250),o=t(57766);const r={sidebar_position:3,title:"\u914d\u7f6e\u5ba1\u8ba1\u7cfb\u7edf"},s="\u914d\u7f6e\u5ba1\u8ba1\u7cfb\u7edf",d={id:"deploy/config/audit/intro",title:"\u914d\u7f6e\u5ba1\u8ba1\u7cfb\u7edf",description:"\u672c\u8282\u4ecb\u7ecd\u5982\u4f55\u914d\u7f6e\u5ba1\u8ba1\u7cfb\u7edf\u3002",source:"@site/docs/deploy/config/audit/intro.md",sourceDirName:"deploy/config/audit",slug:"/deploy/config/audit/intro",permalink:"/SCOW/pr-preview/pr-1028/docs/deploy/config/audit/intro",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/audit/intro.md",tags:[],version:"current",sidebarPosition:3,frontMatter:{sidebar_position:3,title:"\u914d\u7f6e\u5ba1\u8ba1\u7cfb\u7edf"},sidebar:"deploy",previous:{title:"\u5ba1\u8ba1\u7cfb\u7edf",permalink:"/SCOW/pr-preview/pr-1028/docs/category/\u5ba1\u8ba1\u7cfb\u7edf"},next:{title:"CLI",permalink:"/SCOW/pr-preview/pr-1028/docs/category/cli"}},c={},a=[{value:"\u4fee\u6539\u5b89\u88c5\u914d\u7f6e\u6587\u4ef6",id:"\u4fee\u6539\u5b89\u88c5\u914d\u7f6e\u6587\u4ef6",level:2},{value:"\u7f16\u5199\u540e\u7aef\u670d\u52a1\u914d\u7f6e",id:"\u7f16\u5199\u540e\u7aef\u670d\u52a1\u914d\u7f6e",level:2},{value:"\u542f\u52a8\u670d\u52a1",id:"\u542f\u52a8\u670d\u52a1",level:2}];function l(e){const n={code:"code",h1:"h1",h2:"h2",p:"p",pre:"pre",...(0,o.a)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.h1,{id:"\u914d\u7f6e\u5ba1\u8ba1\u7cfb\u7edf",children:"\u914d\u7f6e\u5ba1\u8ba1\u7cfb\u7edf"}),"\n",(0,i.jsx)(n.p,{children:"\u672c\u8282\u4ecb\u7ecd\u5982\u4f55\u914d\u7f6e\u5ba1\u8ba1\u7cfb\u7edf\u3002"}),"\n",(0,i.jsx)(n.h2,{id:"\u4fee\u6539\u5b89\u88c5\u914d\u7f6e\u6587\u4ef6",children:"\u4fee\u6539\u5b89\u88c5\u914d\u7f6e\u6587\u4ef6"}),"\n",(0,i.jsx)(n.p,{children:"\u4fee\u6539\u5b89\u88c5\u914d\u7f6e\u6587\u4ef6"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{className:"language-yaml",metastring:'title="install.yaml"',children:'# \u786e\u4fdd\u5ba1\u8ba1\u7cfb\u7edf\u4f1a\u90e8\u7f72\naudit:\n\n  # dbPassword\u4e3a\u5ba1\u8ba1\u7cfb\u7edf\u6570\u636e\u5e93\u5bc6\u7801\n  # \u5728\u7cfb\u7edf\u7b2c\u4e00\u6b21\u542f\u52a8\u524d\u53ef\u81ea\u7531\u8bbe\u7f6e\uff0c\u4f7f\u7528\u6b64\u5bc6\u7801\u53ef\u4ee5\u4ee5root\u8eab\u4efd\u767b\u5f55\u6570\u636e\u5e93\n  # \u4e00\u65e6\u6570\u636e\u5e93\u542f\u52a8\u540e\u5373\u4e0d\u53ef\u4fee\u6539\n  # \u5fc5\u987b\u957f\u4e8e8\u4e2a\u5b57\u7b26\uff0c\u5e76\u540c\u65f6\u5305\u62ec\u5b57\u6bcd\u3001\u6570\u5b57\u548c\u7b26\u53f7\n  dbPassword: "must!chang3this"\n'})}),"\n",(0,i.jsx)(n.h2,{id:"\u7f16\u5199\u540e\u7aef\u670d\u52a1\u914d\u7f6e",children:"\u7f16\u5199\u540e\u7aef\u670d\u52a1\u914d\u7f6e"}),"\n",(0,i.jsxs)(n.p,{children:["\u5728",(0,i.jsx)(n.code,{children:"config/audit.yaml"}),"\u6587\u4ef6\u4e2d\uff0c\u6839\u636e\u5907\u6ce8\u4fee\u6539\u6240\u9700\u8981\u7684\u914d\u7f6e"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{className:"language-yaml",metastring:'title="config/audit.yaml"',children:"\n# \u5ba1\u8ba1\u670d\u52a1\u7684url\uff0c\u9ed8\u8ba4\u4e0d\u4fee\u6539\nurl: audit-server:5000\n# \u5ba1\u8ba1\u7cfb\u7edf\u6570\u636e\u5e93\u7684\u4fe1\u606f\u3002\u53ef\u4ee5\u4e0d\u4fee\u6539\ndb:\n  host: audit-db\n  port: 3306\n  user: root\n  password: mysqlrootpassword\n  dbName: scow_audit\n"})}),"\n",(0,i.jsx)(n.h2,{id:"\u542f\u52a8\u670d\u52a1",children:"\u542f\u52a8\u670d\u52a1"}),"\n",(0,i.jsxs)(n.p,{children:["\u8fd0\u884c",(0,i.jsx)(n.code,{children:"./cli compose up -d"}),"\u542f\u52a8\u5ba1\u8ba1\u670d\u52a1\u3002"]})]})}function p(e={}){const{wrapper:n}={...(0,o.a)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},57766:(e,n,t)=>{t.d(n,{Z:()=>d,a:()=>s});var i=t(70079);const o={},r=i.createContext(o);function s(e){const n=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function d(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(o):e.components||o:s(e.components),i.createElement(r.Provider,{value:n},e.children)}}}]);