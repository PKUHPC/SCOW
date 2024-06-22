"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[834],{26961:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>t,contentTitle:()=>c,default:()=>j,frontMatter:()=>r,metadata:()=>l,toc:()=>h});var d=s(49214),i=s(5409);const r={sidebar_position:2,title:"\u5f00\u53d1UI\u6269\u5c55"},c="\u5f00\u53d1UI\u6269\u5c55",l={id:"integration/ui-extension/develop",title:"\u5f00\u53d1UI\u6269\u5c55",description:"\u8981\u4f7f\u7528UI\u6269\u5c55\uff0c\u60a8\u9996\u5148\u9700\u8981\u5f00\u53d1\u5e76\u6784\u5efa\u4e00\u4e2a\u4ece\u5916\u754c\u53ef\u4ee5\u8bbf\u95ee\u7684\u7f51\u7ad9\uff08\u79f0\u4e3a\u6269\u5c55\u7ad9\uff09\u3002\u60a8\u53ef\u4ee5\u4f7f\u7528\u4efb\u4f55\u6280\u672f\u5f00\u53d1\u3001\u7ef4\u62a4\u548c\u90e8\u7f72\u6b64\u7f51\u7ad9\uff0c\u53ea\u9700\u8981\u6ee1\u8db3\u60a8\u7684\u7528\u6237\u53ef\u4ee5\u901a\u8fc7\u76f4\u63a5\u516c\u7f51\u8bbf\u95ee\u5373\u53ef\u3002",source:"@site/docs/integration/ui-extension/develop.md",sourceDirName:"integration/ui-extension",slug:"/integration/ui-extension/develop",permalink:"/SCOW/pr-preview/pr-1311/docs/integration/ui-extension/develop",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/integration/ui-extension/develop.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2,title:"\u5f00\u53d1UI\u6269\u5c55"},sidebar:"integration",previous:{title:"UI\u6269\u5c55 (Beta)",permalink:"/SCOW/pr-preview/pr-1311/docs/integration/ui-extension/"}},t={},h=[{value:"\u4e0a\u4e0b\u6587\u53c2\u6570",id:"\u4e0a\u4e0b\u6587\u53c2\u6570",level:2},{value:"\u6269\u5c55\u9875",id:"\u6269\u5c55\u9875",level:2},{value:"\u914d\u7f6e\u63a5\u53e3",id:"\u914d\u7f6e\u63a5\u53e3",level:2},{value:"\u83b7\u53d6\u6e05\u5355\uff1aGET /api/manifests",id:"\u83b7\u53d6\u6e05\u5355get-apimanifests",level:4},{value:"\u91cd\u5199\u5bfc\u822a\u9879\uff1aPOST /api/{portal,mis}/rewriteNavigations",id:"\u91cd\u5199\u5bfc\u822a\u9879post-apiportalmisrewritenavigations",level:3},{value:"\u589e\u52a0\u5bfc\u822a\u680f\u94fe\u63a5\uff1aPOST /api/{portal,mis}/navbarLinks",id:"\u589e\u52a0\u5bfc\u822a\u680f\u94fe\u63a5post-apiportalmisnavbarlinks",level:3},{value:"\u6ce8\u610f\u4e8b\u9879",id:"\u6ce8\u610f\u4e8b\u9879",level:2}];function x(e){const n={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",h4:"h4",li:"li",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,i.R)(),...e.components};return(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)(n.h1,{id:"\u5f00\u53d1ui\u6269\u5c55",children:"\u5f00\u53d1UI\u6269\u5c55"}),"\n",(0,d.jsxs)(n.p,{children:["\u8981\u4f7f\u7528UI\u6269\u5c55\uff0c\u60a8\u9996\u5148\u9700\u8981\u5f00\u53d1\u5e76\u6784\u5efa\u4e00\u4e2a\u4ece\u5916\u754c\u53ef\u4ee5\u8bbf\u95ee\u7684\u7f51\u7ad9\uff08\u79f0\u4e3a",(0,d.jsx)(n.strong,{children:"\u6269\u5c55\u7ad9"}),"\uff09\u3002\u60a8\u53ef\u4ee5\u4f7f\u7528\u4efb\u4f55\u6280\u672f\u5f00\u53d1\u3001\u7ef4\u62a4\u548c\u90e8\u7f72\u6b64\u7f51\u7ad9\uff0c\u53ea\u9700\u8981\u6ee1\u8db3\u60a8\u7684\u7528\u6237\u53ef\u4ee5\u901a\u8fc7\u76f4\u63a5\u516c\u7f51\u8bbf\u95ee\u5373\u53ef\u3002"]}),"\n",(0,d.jsx)(n.h2,{id:"\u4e0a\u4e0b\u6587\u53c2\u6570",children:"\u4e0a\u4e0b\u6587\u53c2\u6570"}),"\n",(0,d.jsx)(n.p,{children:"SCOW\u4f1a\u5728\u8bbf\u95ee\u6269\u5c55\u9875\u548c\u8c03\u7528\u67d0\u4e9b\u914d\u7f6e\u63a5\u53e3\u65f6\uff0c\u5c06\u4ee5\u4e0b\u53c2\u6570\u4f5c\u4e3a\u67e5\u8be2\u5b57\u7b26\u4e32\uff08querystring\uff09\u52a0\u5165\u8bbf\u95ee\u7684URL\uff0cUI\u6269\u5c55\u53ef\u4ee5\u901a\u8fc7\u8fd9\u4e9b\u53c2\u6570\u83b7\u53d6\u5f53\u524dSCOW\u7cfb\u7edf\u7684\u4fe1\u606f\u3002\u5177\u4f53\u54ea\u4e9b\u9875\u9762/API\u4f1a\u4f20\u9012\u8fd9\u4e9b\u53c2\u6570\u4f1a\u5728\u5177\u4f53\u7ae0\u8282\u91cc\u63d0\u5230\u3002"}),"\n",(0,d.jsxs)(n.table,{children:[(0,d.jsx)(n.thead,{children:(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.th,{children:"\u53c2\u6570"}),(0,d.jsx)(n.th,{children:"\u53d6\u503c"}),(0,d.jsx)(n.th,{children:"\u89e3\u91ca"})]})}),(0,d.jsxs)(n.tbody,{children:[(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"scowDark"})}),(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:'"true" | "false"'})}),(0,d.jsx)(n.td,{children:"\u5f53\u524dSCOW\u662f\u5426\u4ee5\u9ed1\u6697\u4e3b\u9898\u663e\u793a"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"scowUserToken"})}),(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"string | undefined"})}),(0,d.jsx)(n.td,{children:"\u5f53\u524dSCOW\u7684\u767b\u5f55\u7528\u6237\u7684token\u3002\u53ef\u901a\u8fc7SCOW\u8ba4\u8bc1\u7cfb\u7edf\u63a5\u53e3\u67e5\u8be2\u767b\u5f55\u7528\u6237"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"scowLangId"})}),(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"string"})}),(0,d.jsx)(n.td,{children:"\u5f53\u524dSCOW\u663e\u793a\u6240\u4f7f\u7528\u7684\u8bed\u8a00ID"})]})]})]}),"\n",(0,d.jsx)(n.h2,{id:"\u6269\u5c55\u9875",children:"\u6269\u5c55\u9875"}),"\n",(0,d.jsxs)(n.p,{children:["UI\u6269\u5c55\u7684\u529f\u80fd\u5e94\u5b9e\u73b0\u4e3a\u6807\u51c6\u7684\u7f51\u9875\u3002\u5f53\u8bbf\u95eeSCOW\u7684\u6269\u5c55\u8def\u5f84\u65f6\uff0cSCOW\u5c06\u4f1a\u5728\u5916\u5c42\u663e\u793aSCOW\u7684\u57fa\u7840\u5bfc\u822a\u7ed3\u6784\uff0c\u5e76\u5728\u9875\u9762\u4e3b\u8981\u90e8\u5206\u4f7f\u7528\u4e00\u4e2a",(0,d.jsx)(n.code,{children:"<iframe>"}),"\u7ec4\u4ef6\u5c06\u6269\u5c55\u9875\u7684\u5185\u5bb9\u663e\u793a\u51fa\u6765\u3002",(0,d.jsx)(n.a,{href:"#%E4%B8%8A%E4%B8%8B%E6%96%87%E5%8F%82%E6%95%B0",children:"\u4e0a\u4e0b\u6587\u53c2\u6570"}),"\u4e2d\u7684\u53c2\u6570\u4e5f\u5c06\u4f1a\u4f20\u9012\u7ed9",(0,d.jsx)(n.code,{children:"<iframe>"}),"\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:["\u82e5\u53ea\u8bbe\u7f6e\u4e86\u4e00\u4e2aUI\u6269\u5c55\uff0c\u5f53\u7528\u6237\u8bbf\u95eeSCOW\u90e8\u7f72\u8def\u5f84\u7684",(0,d.jsx)(n.code,{children:"/extensions/*"}),"\u7684\u8def\u5f84\u65f6\uff0c",(0,d.jsx)(n.code,{children:"<iframe>"}),"\u5c06\u4f1a\u663e\u793aUI\u6269\u5c55",(0,d.jsx)(n.code,{children:"/extensions/*"}),"\u4e0b\u7684\u5185\u5bb9\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:["\u82e5\u8bbe\u7f6e\u4e86\u591a\u4e2aUI\u6269\u5c55\uff0c\u5f53\u7528\u6237\u8bbf\u95eeSCOW\u90e8\u7f72\u8def\u5f84\u7684",(0,d.jsx)(n.code,{children:"/extensions/{name}/*"}),"\u7684\u8def\u5f84\u65f6\uff0c",(0,d.jsx)(n.code,{children:"<iframe>"}),"\u5c06\u4f1a\u663e\u793a",(0,d.jsx)(n.code,{children:"{name}"}),"\u90e8\u5206\u5bf9\u5e94\u7684UI\u6269\u5c55\u7684",(0,d.jsx)(n.code,{children:"/extensions/*"}),"\u4e0b\u7684\u5185\u5bb9\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:["\u4f8b\u5982\uff0c\u5047\u8bbeSCOW\u90e8\u7f72\u4e8e",(0,d.jsx)(n.code,{children:"https://myscow.com/scow"}),"\uff0c\u60a8\u7684\u6269\u5c55\u7ad91\u90e8\u7f72\u4e8e",(0,d.jsx)(n.code,{children:"https://myscowext1.com/ext1"}),"\uff0c\u6269\u5c55\u7ad92\u90e8\u7f72\u4e8e",(0,d.jsx)(n.code,{children:"https://myscowext2.com/ext2"}),"\u3002"]}),"\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsxs)(n.li,{children:["\u82e5\u7528\u6237\u5728\u914d\u7f6e\u4e2d\u4f7f\u7528\u5355\u4e2aUI\u6269\u5c55\u914d\u7f6e\u8bed\u6cd5\u65f6\uff0c\u5f53\u7528\u6237\u8bbf\u95ee",(0,d.jsx)(n.code,{children:"https://myscow/scow/extensions/parent/child?test=123"}),"\u65f6\uff0cSCOW\u5c06\u4f1a\u663e\u793a\u4e00\u4e2aiframe\uff0c\u5176URL\u4e3a",(0,d.jsx)(n.code,{children:"https://myscowext1.com/ext1/extensions/parent/child?test=123&scowDark={\u5f53\u524dSCOW\u662f\u5426\u4ee5\u9ed1\u6697\u6a21\u5f0f\u663e\u793a}&scowUserToken={\u7528\u6237token}&scowLangId={\u5f53\u524dSCOW\u663e\u793a\u8bed\u8a00ID}"}),"\u3002"]}),"\n",(0,d.jsxs)(n.li,{children:["\u82e5\u7528\u6237\u5728\u914d\u7f6e\u4e2d\u4f7f\u7528\u591a\u4e2aUI\u6269\u5c55\u914d\u7f6e\u8bed\u6cd5\uff0c\u4f46\u662f\u53ea\u914d\u7f6e\u4e86\u6269\u5c55\u7ad91\u65f6\uff0c\u8d77\u540d\u79f0\u4e3a",(0,d.jsx)(n.code,{children:"extname1"}),"\uff0c\u5f53\u7528\u6237\u8bbf\u95ee",(0,d.jsx)(n.code,{children:"https://myscow/scow/extensions/extname1/parent/child?test=123"}),"\u65f6\uff0cSCOW\u5c06\u4f1a\u663e\u793a\u4e00\u4e2aiframe\uff0c\u5176URL\u4e3a",(0,d.jsx)(n.code,{children:"https://myscowext1.com/ext1/extensions/parent/child?test=123&scowDark={\u5f53\u524dSCOW\u662f\u5426\u4ee5\u9ed1\u6697\u6a21\u5f0f\u663e\u793a}&scowUserToken={\u7528\u6237token}&scowLangId={\u5f53\u524dSCOW\u663e\u793a\u8bed\u8a00ID}"}),"\u3002"]}),"\n",(0,d.jsxs)(n.li,{children:["\u82e5\u7528\u6237\u5728\u914d\u7f6e\u4e2d\u4f7f\u7528\u591a\u4e2aUI\u6269\u5c55\u914d\u7f6e\u8bed\u6cd5\uff0c\u914d\u7f6e\u4e86\u6269\u5c55\u7ad91\u548c2\uff0c\u540d\u79f0\u5206\u522b\u4e3a",(0,d.jsx)(n.code,{children:"extname1"}),"\u548c",(0,d.jsx)(n.code,{children:"extname2"}),"\uff0c\u5f53\u7528\u6237\u8bbf\u95ee",(0,d.jsx)(n.code,{children:"https://myscow/scow/extensions/extname1/parent/child?test=123"}),"\u65f6\uff0cSCOW\u5c06\u4f1a\u663e\u793a\u4e00\u4e2aiframe\uff0c\u5176URL\u4e3a",(0,d.jsx)(n.code,{children:"https://myscowext1.com/ext1/extensions/parent/child?test=123&scowDark={\u5f53\u524dSCOW\u662f\u5426\u4ee5\u9ed1\u6697\u6a21\u5f0f\u663e\u793a}&scowUserToken={\u7528\u6237token}&scowLangId={\u5f53\u524dSCOW\u663e\u793a\u8bed\u8a00ID}"}),"\u3002"]}),"\n"]}),"\n",(0,d.jsx)(n.h2,{id:"\u914d\u7f6e\u63a5\u53e3",children:"\u914d\u7f6e\u63a5\u53e3"}),"\n",(0,d.jsxs)(n.p,{children:["\u9664\u6b64\u4e4b\u5916\uff0cUI\u6269\u5c55\u7ad9\u9700\u8981\u5b9e\u73b0\u4ee5\u4e0b\u7684\u914d\u7f6e\u63a5\u53e3\u3002SCOW\u4f1a\u5728\u9700\u8981\u7684\u4f7f\u7528\u8c03\u7528\u4ee5\u4e0b\u63a5\u53e3\u83b7\u53d6\u54cd\u5e94\u914d\u7f6e\u3002\u6240\u6709\u914d\u7f6e\u63a5\u53e3\u4ee5",(0,d.jsx)(n.code,{children:"/api"}),"\u5f00\u5934\u3002"]}),"\n",(0,d.jsx)(n.h4,{id:"\u83b7\u53d6\u6e05\u5355get-apimanifests",children:"\u83b7\u53d6\u6e05\u5355\uff1aGET /api/manifests"}),"\n",(0,d.jsx)(n.p,{children:"\u83b7\u53d6UI\u6269\u5c55\u914d\u7f6e\u6e05\u5355\u3002SCOW\u901a\u8fc7\u6b64\u63a5\u53e3\u83b7\u53d6\u60a8\u7684UI\u6269\u5c55\u7684\u4e00\u4e9b\u914d\u7f6e\u53c2\u6570\u3002"}),"\n",(0,d.jsx)(n.p,{children:"\u5bf9\u4e8e\u6b64\u63a5\u53e3\uff0c\u60a8\u9700\u8981\u8fd4\u56de\u5982\u4e0b\u7c7b\u578b\u7684JSON\u5185\u5bb9\uff1a"}),"\n",(0,d.jsxs)(n.table,{children:[(0,d.jsx)(n.thead,{children:(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.th,{children:"JSON\u5c5e\u6027\u8def\u5f84"}),(0,d.jsx)(n.th,{children:"\u7c7b\u578b"}),(0,d.jsx)(n.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,d.jsx)(n.th,{children:"\u89e3\u91ca"})]})}),(0,d.jsxs)(n.tbody,{children:[(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"portal"})}),(0,d.jsx)(n.td,{children:"\u5bf9\u8c61"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsx)(n.td,{children:"\u5173\u4e8e\u95e8\u6237\u7cfb\u7edf\u7684\u914d\u7f6e"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"portal.rewriteNavigations"})}),(0,d.jsx)(n.td,{children:"\u5e03\u5c14\u503c"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsxs)(n.td,{children:["\u662f\u5426\u91cd\u5199\u95e8\u6237\u7cfb\u7edf\u7684\u5bfc\u822a\u9879\u3002\u9ed8\u8ba4\u4e3a",(0,d.jsx)(n.code,{children:"false"})]})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"portal.navbarLinks"})}),(0,d.jsx)(n.td,{children:"\u5e03\u5c14\u503c"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsxs)(n.td,{children:["\u662f\u5426\u5728\u95e8\u6237\u7cfb\u7edf\u4e2d\u589e\u52a0\u5bfc\u822a\u680f\u53f3\u4fa7\u7684\u94fe\u63a5\u3002\u9ed8\u8ba4\u4e3a",(0,d.jsx)(n.code,{children:"false"})]})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"mis"})}),(0,d.jsx)(n.td,{children:"\u5bf9\u8c61"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsx)(n.td,{children:"\u5173\u4e8e\u7ba1\u7406\u7cfb\u7edf\u7684\u914d\u7f6e"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"mis.rewriteNavigations"})}),(0,d.jsx)(n.td,{children:"\u5e03\u5c14\u503c"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsxs)(n.td,{children:["\u662f\u5426\u91cd\u5199\u7ba1\u7406\u7cfb\u7edf\u7684\u5bfc\u822a\u9879\u3002\u9ed8\u8ba4\u4e3a",(0,d.jsx)(n.code,{children:"false"})]})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"mis.navbarLinks"})}),(0,d.jsx)(n.td,{children:"\u5e03\u5c14\u503c"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsxs)(n.td,{children:["\u662f\u5426\u5728\u7ba1\u7406\u7cfb\u7edf\u4e2d\u589e\u52a0\u5bfc\u822a\u680f\u53f3\u4fa7\u7684\u94fe\u63a5\u3002\u9ed8\u8ba4\u4e3a",(0,d.jsx)(n.code,{children:"false"})]})]})]})]}),"\n",(0,d.jsx)(n.p,{children:"\u4f8b\u5982\uff0c\u60a8\u53ef\u4ee5\u8fd4\u56de\u5982\u4e0b\u7c7b\u578b\u7684JSON\uff0c\u8868\u793a\u5728\u95e8\u6237\u7cfb\u7edf\u4e2d\u91cd\u5199\u5bfc\u822a\u9879\u5e76\u589e\u52a0\u5bfc\u822a\u680f\u53f3\u4fa7\u7684\u94fe\u63a5\uff0c\u5728\u7ba1\u7406\u7cfb\u7edf\u4e2d\u4e0d\u91cd\u5199\u7ba1\u7406\u7cfb\u7edf\u7684\u5bfc\u822a\u9879\uff0c\u4e5f\u4e0d\u589e\u52a0\u5bfc\u822a\u680f\u53f3\u4fa7\u7684\u94fe\u63a5\u3002"}),"\n",(0,d.jsx)(n.pre,{children:(0,d.jsx)(n.code,{className:"language-json",children:'{\n  "portal": {\n    "rewriteNavigations": true,\n    "navbarLinks": true\n  },\n  "mis": {\n    "rewriteNavigations": false,\n  }\n}\n'})}),"\n",(0,d.jsx)(n.h3,{id:"\u91cd\u5199\u5bfc\u822a\u9879post-apiportalmisrewritenavigations",children:"\u91cd\u5199\u5bfc\u822a\u9879\uff1aPOST /api/{portal,mis}/rewriteNavigations"}),"\n",(0,d.jsxs)(n.p,{children:["\u91cd\u5199\u95e8\u6237(portal)\u6216\u8005\u7ba1\u7406\u7cfb\u7edf(mis)\u7684\u5bfc\u822a\u9879\u3002\u82e5\u60a8\u5728",(0,d.jsx)(n.code,{children:"GET /api/manifests"}),"\u4e2d\u8fd4\u56de\u7684",(0,d.jsx)(n.code,{children:"{portal/mis}.rewriteNavigations"}),"\u4e3a",(0,d.jsx)(n.code,{children:"true"}),"\uff0c\u5219\u5fc5\u987b\u5b9e\u73b0\u5bf9\u5e94\u7684\u63a5\u53e3\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:["SCOW\u5c06\u4f1a\u5728body\u4e2d\u4f20\u5165\u9ed8\u8ba4\u60c5\u51b5\u4e0bSCOW\u5c06\u4f1a\u663e\u793a\u7684\u5bfc\u822a\u9879\u3002\u4e0b\u8868\u4e3a\u4f20\u5165\u7684JSON\u53c2\u6570\u7684\u5c5e\u6027\u3002\u9664\u6b64\u8868\u4e4b\u5916\uff0c",(0,d.jsx)(n.a,{href:"#%E4%B8%8A%E4%B8%8B%E6%96%87%E5%8F%82%E6%95%B0",children:"\u4e0a\u4e0b\u6587\u53c2\u6570"}),"\u540c\u6837\u4e5f\u4f1a\u88ab\u4f5c\u4e3a\u67e5\u8be2\u5b57\u7b26\u4e32\u4f20\u5165\u3002"]}),"\n",(0,d.jsxs)(n.table,{children:[(0,d.jsx)(n.thead,{children:(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.th,{children:"JSON\u5c5e\u6027\u8def\u5f84"}),(0,d.jsx)(n.th,{children:"\u7c7b\u578b"}),(0,d.jsx)(n.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,d.jsx)(n.th,{children:"\u89e3\u91ca"})]})}),(0,d.jsxs)(n.tbody,{children:[(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs"})}),(0,d.jsx)(n.td,{children:"\u5bf9\u8c61\u6570\u7ec4"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u5bfc\u822a\u9879"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].path"})}),(0,d.jsx)(n.td,{children:"\u5b57\u7b26\u4e32"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u6b64\u5bfc\u822a\u9879\u7684\u8def\u5f84\u3002\u6b64\u8def\u5f84\u4e0d\u5305\u62ecbase path\u3002\u82e5\u5f53\u524d\u6d4f\u89c8\u5668\u7684pathname\u4ee5\u6b64\u5f00\u5934\uff0c\u5219\u6b64\u5bfc\u822a\u9879\u5c06\u4f1a\u9ad8\u4eae"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].clickToPath"})}),(0,d.jsx)(n.td,{children:"\u5b57\u7b26\u4e32"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsxs)(n.td,{children:["\u70b9\u51fb\u6b64\u5bfc\u822a\u9879\u5c06\u4f1a\u5bfc\u822a\u81f3\u7684\u8def\u5f84\u3002\u5982\u679c\u4e0d\u586b\uff0c\u5219\u4f7f\u7528",(0,d.jsx)(n.code,{children:"path"}),"\u5c5e\u6027"]})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].text"})}),(0,d.jsx)(n.td,{children:"\u5b57\u7b26\u4e32"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u5bfc\u822a\u9879\u7684\u6587\u672c"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].openInNewPage"})}),(0,d.jsx)(n.td,{children:"\u5e03\u5c14\u503c"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u6b64\u5bfc\u822a\u9879\u7684\u9875\u9762\u662f\u5426\u5728\u65b0\u7a97\u53e3\u4e2d\u6253\u5f00"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].children"})}),(0,d.jsxs)(n.td,{children:["\u5bf9\u8c61\u6570\u7ec4\uff0c\u7c7b\u578b\u4e0e",(0,d.jsx)(n.code,{children:"navs"}),"\u6570\u7ec4\u7684\u6bcf\u4e00\u9879\u76f8\u540c"]}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsx)(n.td,{children:"\u6b64\u5bfc\u822a\u9879\u7684\u5b50\u9879\u3002"})]})]})]}),"\n",(0,d.jsx)(n.p,{children:"\u60a8\u9700\u8981\u8fd4\u56de\u4ee5\u4e0b\u7c7b\u578b\u7684JSON\uff0c\u8868\u793a\u91cd\u5199\u540e\u7684\u5bfc\u822a\u9879\u3002\u60a8\u53ef\u4ee5\u91cd\u5199\u7cfb\u7edf\u9ed8\u8ba4\u5bfc\u822a\u9879\u7684\u5c5e\u6027\u3002"}),"\n",(0,d.jsxs)(n.table,{children:[(0,d.jsx)(n.thead,{children:(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.th,{children:"JSON\u5c5e\u6027\u8def\u5f84"}),(0,d.jsx)(n.th,{children:"\u7c7b\u578b"}),(0,d.jsx)(n.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,d.jsx)(n.th,{children:"\u89e3\u91ca"})]})}),(0,d.jsxs)(n.tbody,{children:[(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs"})}),(0,d.jsx)(n.td,{children:"\u5bf9\u8c61\u6570\u7ec4"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u5bfc\u822a\u9879"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].path"})}),(0,d.jsx)(n.td,{children:"\u5b57\u7b26\u4e32"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsxs)(n.td,{children:["\u6b64\u5bfc\u822a\u9879\u7684\u8def\u5f84\uff0c\u8bf7\u53c2\u8003\u8868\u683c\u4e0b",(0,d.jsx)(n.strong,{children:"\u5173\u4e8e\u8fd4\u56de\u7684\u8def\u5f84\u7684\u7684\u8bf4\u660e"}),"\u3002"]})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].clickToPath"})}),(0,d.jsx)(n.td,{children:"\u5b57\u7b26\u4e32"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsxs)(n.td,{children:["\u70b9\u51fb\u6b64\u5bfc\u822a\u9879\u5c06\u4f1a\u5bfc\u822a\u81f3\u7684\u8def\u5f84\uff0c\u89c4\u5219\u540c\u4e0a\u3002\u5982\u679c\u4e0d\u586b\uff0c\u5219\u4f7f\u7528",(0,d.jsx)(n.code,{children:"path"}),"\u5c5e\u6027"]})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].text"})}),(0,d.jsx)(n.td,{children:"\u5b57\u7b26\u4e32"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u5bfc\u822a\u9879\u7684\u6587\u672c"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].icon"})}),(0,d.jsx)(n.td,{children:"\u5bf9\u8c61"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsxs)(n.td,{children:["\u5bfc\u822a\u9879\u7684\u56fe\u6807\u4fe1\u606f\u3002\u5982\u679c\u4e0d\u586b\uff0c\u5c06\u663e\u793a\u9ed8\u8ba4\u5bfc\u822a\u9879\u4e2d\u5177\u6709\u76f8\u540c\u7684path\u7684\u5bfc\u822a\u9879\u7684\u56fe\u6807\u3002\u5982\u679c\u4e0d\u5b58\u5728\u5177\u6709\u76f8\u540cpath\u7684\u5bfc\u822a\u9879\uff0c\u5c06\u663e\u793a",(0,d.jsx)(n.a,{href:"https://ant.design/components/icon-cn",children:"Ant Design Icon"}),"\u7684",(0,d.jsx)(n.code,{children:"LinkOutlined"})]})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].icon.src"})}),(0,d.jsx)(n.td,{children:"\u56fe\u6807URL"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u5bfc\u822a\u9879\u7684\u56fe\u6807\u5730\u5740\u3002\u5fc5\u987b\u662f\u5b8c\u6574\u7684\u3001\u53ef\u516c\u5f00\u8bbf\u95ee\u7684URL"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].icon.alt"})}),(0,d.jsx)(n.td,{children:"\u5e03\u5c14\u503c"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsx)(n.td,{children:"\u5bfc\u822a\u9879\u7684\u56fe\u6807alt\u5c5e\u6027\u3002\u53ef\u4e0d\u586b"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].openInNewPage"})}),(0,d.jsx)(n.td,{children:"\u5e03\u5c14\u503c"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsxs)(n.td,{children:["\u6b64\u5bfc\u822a\u9879\u7684\u9875\u9762\u662f\u5426\u5728\u65b0\u7a97\u53e3\u4e2d\u6253\u5f00\uff0c\u9ed8\u8ba4",(0,d.jsx)(n.code,{children:"false"})]})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navs[].children"})}),(0,d.jsxs)(n.td,{children:["\u5bf9\u8c61\u6570\u7ec4\uff0c\u7c7b\u578b\u4e0e",(0,d.jsx)(n.code,{children:"navs"}),"\u6570\u7ec4\u7684\u6bcf\u4e00\u9879\u76f8\u540c"]}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsx)(n.td,{children:"\u6b64\u5bfc\u822a\u9879\u7684\u5b50\u9879\u3002"})]})]})]}),"\n",(0,d.jsx)(n.p,{children:"\u5173\u4e8e\u8fd4\u56de\u7684\u8def\u5f84\u7684\u8bf4\u660e\uff1a"}),"\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsxs)(n.li,{children:["\u5982\u679c","\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsx)(n.li,{children:"\u8fd4\u56de\u7684\u8def\u5f84\u5728\u8c03\u7528\u8fd9\u4e2a\u6269\u5c55\u7684\u6b64\u63a5\u53e3\u4e4b\u524d\u5df2\u7ecf\u5b58\u5728\uff08\u5373\u5728\u8c03\u7528\u6b64\u6269\u5c55\u7684\u6b64\u63a5\u53e3\u65f6\u7684\u67d0\u4e2a\u5df2\u6709\u7684\u5bfc\u822a\u9879\u5177\u6709\u548c\u8fd4\u56de\u7684\u8def\u5f84\u76f8\u540c\u7684\u8def\u5f84\uff09\uff0c\u6216\u8005"}),"\n",(0,d.jsxs)(n.li,{children:["\u6b64\u8def\u5f84\u662f\u4e00\u4e2a\u6709\u6548\u7684URL","\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsxs)(n.li,{children:["\u68c0\u67e5\u65b9\u6cd5\uff1a\u4f7f\u7528",(0,d.jsx)(n.code,{children:"new URL(\u8f93\u5165)"}),"\uff0c\u82e5\u4e0d\u629b\u51fa\u5f02\u5e38\u5219\u4e3a\u6709\u6548\u7684URL"]}),"\n"]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,d.jsxs)(n.li,{children:["\u5219","\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsxs)(n.li,{children:["\u8fd9\u4e2a\u8def\u5f84\u5c06\u4f1a\u4fdd\u7559\u539f\u72b6\uff0c\u76f4\u63a5\u5199\u5165\u4e3a",(0,d.jsx)(n.code,{children:"<a>"}),"\u6807\u7b7e\u7684",(0,d.jsx)(n.code,{children:"href"}),"\u5c5e\u6027"]}),"\n"]}),"\n"]}),"\n",(0,d.jsxs)(n.li,{children:["\u5426\u5219","\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsxs)(n.li,{children:["\u6b64\u8def\u5f84\u4e3a\u76f8\u5f53\u4e8e\u6269\u5c55UI\u7684",(0,d.jsx)(n.code,{children:"/extensions"}),"\u4e0b\u7684\u8def\u5f84\uff0c\u5373","\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsxs)(n.li,{children:["\u5f53\u7cfb\u7edf\u91c7\u7528\u5355\u4e2aUI\u6269\u5c55\u914d\u7f6e\u8bed\u6cd5\u65f6\uff0c\u5bf9\u5e94\u7684\u5bfc\u822a\u9879\u7684\u8def\u5f84\u4e3a\uff1a",(0,d.jsx)(n.code,{children:"{SCOW URL}/extensions/{path}"})]}),"\n",(0,d.jsxs)(n.li,{children:["\u5f53\u7cfb\u7edf\u91c7\u7528\u591a\u4e2a\u4e2aUI\u6269\u5c55\u914d\u7f6e\u8bed\u6cd5\u65f6\uff0c\u5bf9\u5e94\u7684\u5bfc\u822a\u9879\u7684\u8def\u5f84\u4e3a\uff1a",(0,d.jsx)(n.code,{children:"{SCOW URL}/extensions/{name}/{path}"})]}),"\n"]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,d.jsx)(n.li,{children:"\u82e5\u5f53\u524d\u6d4f\u89c8\u5668\u7684pathname\u4ee5\u6b64\u5f00\u5934\uff0c\u5219\u6b64\u5bfc\u822a\u9879\u5c06\u4f1a\u9ad8\u4eae"}),"\n"]}),"\n",(0,d.jsx)(n.p,{children:"\u5982\u679c\u914d\u7f6e\u4e86\u591a\u4e2aUI\u6269\u5c55\uff0c\u90a3\u4e48SCOW\u5c06\u4f1a\u6309\u7167\u914d\u7f6e\u4e2d\u7684\u987a\u5e8f\u4f9d\u6b21\u8c03\u7528\u6bcf\u4e2a\u9700\u8981\u91cd\u5199\u5bfc\u822a\u9879\u7684UI\u6269\u5c55\u7684\u6b64\u63a5\u53e3\uff0c\u5e76\u5c06\u4e0a\u4e00\u4e2aUI\u6269\u5c55\u7684\u8f93\u51fa\u4f5c\u4e3a\u4e0b\u4e00\u4e2aUI\u6269\u5c55\u7684\u8f93\u5165\uff0c\u5e76\u5c06\u6700\u7ec8\u7ed3\u679c\u4f5c\u4e3aSCOW\u7684\u5bfc\u822a\u9879\u3002"}),"\n",(0,d.jsx)(n.h3,{id:"\u589e\u52a0\u5bfc\u822a\u680f\u94fe\u63a5post-apiportalmisnavbarlinks",children:"\u589e\u52a0\u5bfc\u822a\u680f\u94fe\u63a5\uff1aPOST /api/{portal,mis}/navbarLinks"}),"\n",(0,d.jsx)(n.admonition,{type:"note",children:(0,d.jsx)(n.p,{children:"\u57281.6.1\u7248\u672c\u4e2d\u53ef\u7528\u3002"})}),"\n",(0,d.jsxs)(n.p,{children:["\u5728\u95e8\u6237(portal)\u6216\u8005\u7ba1\u7406\u7cfb\u7edf(mis)\u5bfc\u822a\u680f\u53f3\u4fa7\u4e0a\u90e8\u663e\u793a\u5176\u4ed6\u94fe\u63a5\u3002\u82e5\u60a8\u5728",(0,d.jsx)(n.code,{children:"GET /api/manifests"}),"\u4e2d\u8fd4\u56de\u7684",(0,d.jsx)(n.code,{children:"{portal/mis}.navbarLinks"}),"\u4e3a",(0,d.jsx)(n.code,{children:"true"}),"\uff0c\u5219\u5fc5\u987b\u5b9e\u73b0\u5bf9\u5e94\u7684\u63a5\u53e3\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:["SCOW\u5728\u8c03\u7528\u63a5\u53e3\u65f6\uff0c\u4f1a\u5c06",(0,d.jsx)(n.a,{href:"#%E4%B8%8A%E4%B8%8B%E6%96%87%E5%8F%82%E6%95%B0",children:"\u4e0a\u4e0b\u6587\u53c2\u6570"}),"\u4f5c\u4e3a\u67e5\u8be2\u5b57\u7b26\u4e32\u4f20\u5165\u3002"]}),"\n",(0,d.jsx)(n.p,{children:"\u60a8\u9700\u8981\u8fd4\u56de\u4ee5\u4e0b\u7c7b\u578b\u7684JSON\uff0c\u8868\u793a\u9700\u8981\u589e\u52a0\u7684\u5bfc\u822a\u680f\u7684\u94fe\u63a5\u3002"}),"\n",(0,d.jsxs)(n.table,{children:[(0,d.jsx)(n.thead,{children:(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.th,{children:"JSON\u5c5e\u6027\u8def\u5f84"}),(0,d.jsx)(n.th,{children:"\u7c7b\u578b"}),(0,d.jsx)(n.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,d.jsx)(n.th,{children:"\u89e3\u91ca"})]})}),(0,d.jsxs)(n.tbody,{children:[(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navbarLinks"})}),(0,d.jsx)(n.td,{children:"\u5bf9\u8c61\u6570\u7ec4"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u5bfc\u822a\u9879"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navbarLinks[].href"})}),(0,d.jsx)(n.td,{children:"\u5b57\u7b26\u4e32"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsxs)(n.td,{children:["\u70b9\u51fb\u6b64\u5bfc\u94fe\u63a5\u8df3\u8f6c\u7684href\uff0c\u5c06\u4f1a\u88ab\u76f4\u63a5\u586b\u5165",(0,d.jsx)(n.code,{children:"<a>"}),"\u5143\u7d20\u7684",(0,d.jsx)(n.code,{children:"href"}),"\u5c5e\u6027"]})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navbarLinks[].text"})}),(0,d.jsx)(n.td,{children:"\u5b57\u7b26\u4e32"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u5bfc\u822a\u9879\u7684\u6587\u672c"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navbarLinks[].icon"})}),(0,d.jsx)(n.td,{children:"\u5bf9\u8c61"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsxs)(n.td,{children:["\u5bfc\u822a\u9879\u7684\u56fe\u6807\u4fe1\u606f\u3002\u5982\u679c\u4e0d\u586b\uff0c\u5c06\u663e\u793a",(0,d.jsx)(n.a,{href:"https://ant.design/components/icon-cn",children:"Ant Design Icon"}),"\u7684",(0,d.jsx)(n.code,{children:"LinkOutlined"})]})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navbarLinks[].icon.src"})}),(0,d.jsx)(n.td,{children:"\u56fe\u6807URL"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u5bfc\u822a\u9879\u7684\u56fe\u6807\u5730\u5740\u3002\u5fc5\u987b\u662f\u5b8c\u6574\u7684\u3001\u53ef\u516c\u5f00\u8bbf\u95ee\u7684URL"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navbarLinks[].icon.alt"})}),(0,d.jsx)(n.td,{children:"\u5e03\u5c14\u503c"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsx)(n.td,{children:"\u5bfc\u822a\u9879\u7684\u56fe\u6807alt\u5c5e\u6027\u3002\u53ef\u4e0d\u586b"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navbarLinks[].openInNewPage"})}),(0,d.jsx)(n.td,{children:"\u5e03\u5c14\u503c"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsxs)(n.td,{children:["\u6b64\u5bfc\u822a\u9879\u7684\u9875\u9762\u662f\u5426\u5728\u65b0\u7a97\u53e3\u4e2d\u6253\u5f00\uff0c\u9ed8\u8ba4",(0,d.jsx)(n.code,{children:"true"})]})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"navbarLinks[].priority"})}),(0,d.jsx)(n.td,{children:"\u6570\u5b57"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u6b64\u94fe\u63a5\u7684\u4f18\u5148\u7ea7\u3002\u9ed8\u8ba4\u4e3a0."})]})]})]}),"\n",(0,d.jsxs)(n.p,{children:["\u5982\u679c\u914d\u7f6e\u4e86\u591a\u4e2aUI\u6269\u5c55\uff0c\u90a3\u4e48SCOW\u5c06\u4f1a\u6309\u7167\u914d\u7f6e\u4e2d\u7684\u987a\u5e8f\u4f9d\u6b21\u8c03\u7528\u6bcf\u4e2a\u9700\u8981\u589e\u52a0\u5bfc\u822a\u680f\u94fe\u63a5\u7684UI\u6269\u5c55\u7684\u6b64\u63a5\u53e3\uff0c\u5e76\u5c06\u83b7\u5f97\u7684\u6240\u6709\u94fe\u63a5\u6309\u4ee5\u4e0b\u89c4\u5219",(0,d.jsx)(n.strong,{children:"\u4ece\u5de6\u5230\u53f3"}),"\u6392\u5217\uff1a"]}),"\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsxs)(n.li,{children:["\u4f18\u5148\u7ea7(",(0,d.jsx)(n.code,{children:"priority"}),")\u5c5e\u6027\u4ece\u5927\u5230\u5c0f"]}),"\n",(0,d.jsxs)(n.li,{children:["\u5f53\u4f18\u5148\u7ea7\u76f8\u540c\u65f6\uff0c\u4f9d\u7167\u83b7\u53d6\u6b64\u94fe\u63a5\u7684\u987a\u5e8f\uff0c\u4e5f\u5373","\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsx)(n.li,{children:"\u8fd4\u56de\u94fe\u63a5\u7684UI\u6269\u5c55\u5728\u914d\u7f6e\u4e2d\u7684\u987a\u5e8f\u4ece\u524d\u5f80\u540e"}),"\n",(0,d.jsx)(n.li,{children:"\u540c\u4e00\u4e2aUI\u6269\u5c55\u8fd4\u56de\u7684\u94fe\u63a5\u5728\u54cd\u5e94\u4e2d\u7684\u5217\u8868\u7684\u987a\u5e8f\u4ece\u524d\u5f80\u540e"}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,d.jsxs)(n.p,{children:["\u6ce8\u610f\uff0c\u5f53\u53f3\u4e0a\u89d2\u5bfc\u822a\u680f\u94fe\u63a5\u6570\u91cf",(0,d.jsx)(n.strong,{children:"\u5927\u4e8e\u7b49\u4e8e5\u4e2a"}),"\uff0c\u6216\u8005\u5c4f\u5e55\u5bbd\u5ea6\u5c0f\u4e8e",(0,d.jsx)(n.strong,{children:"768px"}),"\u65f6\uff0c\u6240\u6709\u5bfc\u822a\u680f\u5c06\u4f1a\u4ec5\u663e\u793a\u56fe\u6807\u3002"]}),"\n",(0,d.jsx)(n.h2,{id:"\u6ce8\u610f\u4e8b\u9879",children:"\u6ce8\u610f\u4e8b\u9879"}),"\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsxs)(n.li,{children:["UI\u6269\u5c55\u793a\u4f8b\u9879\u76ee\uff1a",(0,d.jsx)(n.a,{href:"https://github.com/PKUHPC/scow-ui-extension-demo",children:"PKUHPC/scow-ui-extension-demo"})]}),"\n",(0,d.jsxs)(n.li,{children:["\u5982\u679c\u60a8\u7684\u6269\u5c55\u7ad9\u548cSCOW\u90e8\u7f72\u5730\u5740\u975e\u540c\u6e90\uff0c\u8bf7\u6ce8\u610f\u4f7f\u5f97\u60a8\u7684\u6269\u5c55\u7ad9\u7684\u6240\u6709\u8def\u5f84\u5747\u652f\u6301CORS\u8bbf\u95ee\u3002","\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsxs)(n.li,{children:["Next.js\u9879\u76ee\u53ef\u4ee5\u53c2\u8003",(0,d.jsxs)(n.a,{href:"https://github.com/PKUHPC/scow-ui-extension-demo/blob/main/src/middleware.ts",children:["\u793a\u4f8b\u9879\u76ee\u4e2d\u7684",(0,d.jsx)(n.code,{children:"src/middleware.ts"})]})]}),"\n"]}),"\n"]}),"\n"]})]})}function j(e={}){const{wrapper:n}={...(0,i.R)(),...e.components};return n?(0,d.jsx)(n,{...e,children:(0,d.jsx)(x,{...e})}):x(e)}},5409:(e,n,s)=>{s.d(n,{R:()=>c,x:()=>l});var d=s(48318);const i={},r=d.createContext(i);function c(e){const n=d.useContext(r);return d.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function l(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:c(e.components),d.createElement(r.Provider,{value:n},e.children)}}}]);