"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[5797],{38817:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>o,contentTitle:()=>d,default:()=>a,frontMatter:()=>i,metadata:()=>c,toc:()=>l});var s=n(35250),r=n(57766);const i={sidebar_position:2,title:"SSH"},d="SSH\u8ba4\u8bc1\u7cfb\u7edf",c={id:"deploy/config/auth/ssh",title:"SSH",description:"\u672c\u8282\u4ecb\u7ecd\u5185\u7f6e\u8ba4\u8bc1\u7cfb\u7edf\u5e76\u91c7\u7528SSH\u8fdb\u884c\u7528\u6237\u8ba4\u8bc1\u7684\u8ba4\u8bc1\u7cfb\u7edf\u3002",source:"@site/docs/deploy/config/auth/ssh.md",sourceDirName:"deploy/config/auth",slug:"/deploy/config/auth/ssh",permalink:"/SCOW/pr-preview/pr-983/docs/deploy/config/auth/ssh",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/auth/ssh.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2,title:"SSH"},sidebar:"deploy",previous:{title:"\u7b80\u4ecb",permalink:"/SCOW/pr-preview/pr-983/docs/deploy/config/auth/intro"},next:{title:"LDAP",permalink:"/SCOW/pr-preview/pr-983/docs/deploy/config/auth/ldap"}},o={},l=[{value:"\u914d\u7f6eSSH\u8ba4\u8bc1\u670d\u52a1",id:"\u914d\u7f6essh\u8ba4\u8bc1\u670d\u52a1",level:2}];function h(e){const t={a:"a",code:"code",h1:"h1",h2:"h2",p:"p",pre:"pre",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,r.a)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(t.h1,{id:"ssh\u8ba4\u8bc1\u7cfb\u7edf",children:"SSH\u8ba4\u8bc1\u7cfb\u7edf"}),"\n",(0,s.jsx)(t.p,{children:"\u672c\u8282\u4ecb\u7ecd\u5185\u7f6e\u8ba4\u8bc1\u7cfb\u7edf\u5e76\u91c7\u7528SSH\u8fdb\u884c\u7528\u6237\u8ba4\u8bc1\u7684\u8ba4\u8bc1\u7cfb\u7edf\u3002"}),"\n",(0,s.jsx)(t.p,{children:"SSH\u8ba4\u8bc1\u662f\u975e\u5e38\u7b80\u5355\u7684\u8ba4\u8bc1\u65b9\u5f0f\u3002\u7528\u6237\u53ef\u4ee5\u76f4\u63a5\u4f7f\u7528\u548cSSH\u767b\u5f55\u96c6\u7fa4\u76f8\u540c\u7684\u7528\u6237\u540d\u548c\u5bc6\u7801\u6765\u767b\u5f55\u7cfb\u7edf\u3002"}),"\n",(0,s.jsxs)(t.p,{children:["\u5728\u6b64\u8ba4\u8bc1\u65b9\u5f0f\u4e2d\uff0c\u7528\u6237\u7684\u7528\u6237ID\u4e3a\u5176\u5bf9\u5e94\u7684Linux\u7528\u6237\u540d\uff0c\u7528\u6237\u7684\u59d3\u540d\u4e3a\u5176\u5bf9\u5e94\u7684Linux\u7528\u6237\u7684",(0,s.jsx)(t.a,{href:"https://en.wikipedia.org/wiki/Gecos_field",children:"Gecos Field"}),"\u7684full name\u5b57\u6bb5\u3002"]}),"\n",(0,s.jsx)(t.p,{children:"SSH\u8ba4\u8bc1\u65b9\u5f0f\u6240\u652f\u6301\u7684\u529f\u80fd\u5982\u4e0b\u8868\uff1a"}),"\n",(0,s.jsxs)(t.table,{children:[(0,s.jsx)(t.thead,{children:(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.th,{children:"\u529f\u80fd"}),(0,s.jsx)(t.th,{children:"\u662f\u5426\u652f\u6301"})]})}),(0,s.jsxs)(t.tbody,{children:[(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"\u7528\u6237\u767b\u5f55"}),(0,s.jsx)(t.td,{children:"\u662f"})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"\u83b7\u53d6\u7528\u6237\u4fe1\u606f"}),(0,s.jsx)(t.td,{children:"\u662f"})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"\u7528\u6237\u521b\u5efa"}),(0,s.jsx)(t.td,{children:"\u5426"})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"\u7528\u6237\u540d\u548c\u59d3\u540d\u9a8c\u8bc1"}),(0,s.jsx)(t.td,{children:"\u5426"})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"\u4fee\u6539\u5bc6\u7801"}),(0,s.jsx)(t.td,{children:"\u5426"})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"\u7ba1\u7406\u7528\u6237\u8d26\u6237\u5173\u7cfb"}),(0,s.jsx)(t.td,{children:"\u5426"})]})]})]}),"\n",(0,s.jsx)(t.h2,{id:"\u914d\u7f6essh\u8ba4\u8bc1\u670d\u52a1",children:"\u914d\u7f6eSSH\u8ba4\u8bc1\u670d\u52a1"}),"\n",(0,s.jsxs)(t.p,{children:["SSH\u8ba4\u8bc1\u65b9\u5f0f\u8981\u6c42\u7f16\u5199\u597d",(0,s.jsx)(t.a,{href:"/SCOW/pr-preview/pr-983/docs/deploy/config/cluster-config",children:"\u96c6\u7fa4\u914d\u7f6e\u6587\u4ef6"}),"\uff0c\u5e76\u4e14\u786e\u4fdd\u5176\u4e2d\u7b2c\u4e00\u4e2a\u96c6\u7fa4\u6709\u81f3\u5c11\u4e00\u4e2a\u767b\u5f55\u8282\u70b9\u3002"]}),"\n",(0,s.jsxs)(t.p,{children:["\u5728",(0,s.jsx)(t.code,{children:"config/auth.yml"}),"\u4e2d\u8f93\u5165\u4ee5\u4e0b\u5185\u5bb9\uff1a"]}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-yaml",metastring:'title="config/auth.yml"',children:"# \u6307\u5b9a\u4f7f\u7528\u8ba4\u8bc1\u7c7b\u578b\u4e3aSSH\nauthType: ssh\n"})}),"\n",(0,s.jsxs)(t.p,{children:["\u589e\u52a0\u597d\u914d\u7f6e\u540e\uff0c\u8fd0\u884c",(0,s.jsx)(t.code,{children:"./cli compose restart"}),"\u91cd\u542f\u7cfb\u7edf\u5373\u53ef\u3002"]})]})}function a(e={}){const{wrapper:t}={...(0,r.a)(),...e.components};return t?(0,s.jsx)(t,{...e,children:(0,s.jsx)(h,{...e})}):h(e)}},57766:(e,t,n)=>{n.d(t,{Z:()=>c,a:()=>d});var s=n(70079);const r={},i=s.createContext(r);function d(e){const t=s.useContext(i);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function c(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:d(e.components),s.createElement(i.Provider,{value:t},e.children)}}}]);