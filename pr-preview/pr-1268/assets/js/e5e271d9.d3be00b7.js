"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[293],{17125:(e,d,n)=>{n.r(d),n.d(d,{assets:()=>c,contentTitle:()=>h,default:()=>j,frontMatter:()=>s,metadata:()=>r,toc:()=>t});var l=n(49214),i=n(5409);const s={sidebar_position:2,title:"\u5b9e\u73b0\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf"},h="\u5b9e\u73b0\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf",r={id:"integration/auth/impl",title:"\u5b9e\u73b0\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf",description:"\u5982\u679c\u7cfb\u7edf\u63d0\u4f9b\u7684\u8ba4\u8bc1\u7cfb\u7edf\u4e0d\u80fd\u6ee1\u8db3\u60a8\u7684\u9700\u6c42\uff0c\u60a8\u53ef\u4ee5\u81ea\u5df1\u5b9e\u73b0\u4e00\u4e2a\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u670d\u52a1\u3002",source:"@site/docs/integration/auth/impl.md",sourceDirName:"integration/auth",slug:"/integration/auth/impl",permalink:"/SCOW/pr-preview/pr-1268/docs/integration/auth/impl",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/integration/auth/impl.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2,title:"\u5b9e\u73b0\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf"},sidebar:"integration",previous:{title:"\u4f7f\u7528\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf",permalink:"/SCOW/pr-preview/pr-1268/docs/integration/auth/use"},next:{title:"SCOW API\u548cHook",permalink:"/SCOW/pr-preview/pr-1268/docs/category/scow-api\u548chook"}},c={},t=[{value:"\u57fa\u672c\u6982\u5ff5",id:"\u57fa\u672c\u6982\u5ff5",level:2},{value:"\u5fc5\u987b\u5b9e\u73b0\u7684API",id:"\u5fc5\u987b\u5b9e\u73b0\u7684api",level:2},{value:"GET /public/auth",id:"get-publicauth",level:3},{value:"\u8bf7\u6c42",id:"\u8bf7\u6c42",level:4},{value:"\u671f\u671b\u7684\u54cd\u5e94",id:"\u671f\u671b\u7684\u54cd\u5e94",level:4},{value:"\u89e3\u91ca",id:"\u89e3\u91ca",level:4},{value:"GET /public/validateToken",id:"get-publicvalidatetoken",level:3},{value:"\u8bf7\u6c42",id:"\u8bf7\u6c42-1",level:4},{value:"\u671f\u671b\u7684\u54cd\u5e94",id:"\u671f\u671b\u7684\u54cd\u5e94-1",level:4},{value:"200 OK",id:"200-ok",level:5},{value:"400 Bad Request",id:"400-bad-request",level:5},{value:"DELETE /token",id:"delete-token",level:3},{value:"\u8bf7\u6c42",id:"\u8bf7\u6c42-2",level:4},{value:"\u54cd\u5e94",id:"\u54cd\u5e94",level:4},{value:"\u89e3\u91ca",id:"\u89e3\u91ca-1",level:4},{value:"GET /capabilities",id:"get-capabilities",level:3},{value:"\u8bf7\u6c42",id:"\u8bf7\u6c42-3",level:4},{value:"\u671f\u671b\u7684\u54cd\u5e94",id:"\u671f\u671b\u7684\u54cd\u5e94-2",level:4},{value:"200 OK",id:"200-ok-1",level:5},{value:"\u89e3\u91ca",id:"\u89e3\u91ca-2",level:4},{value:"\u521b\u5efa\u7528\u6237\u529f\u80fd\u76f8\u5173API",id:"\u521b\u5efa\u7528\u6237\u529f\u80fd\u76f8\u5173api",level:2},{value:"POST /user",id:"post-user",level:3},{value:"\u8bf7\u6c42",id:"\u8bf7\u6c42-4",level:4},{value:"\u54cd\u5e94",id:"\u54cd\u5e94-1",level:4},{value:"\u89e3\u91ca",id:"\u89e3\u91ca-3",level:4},{value:"\u67e5\u8be2\u7528\u6237\u529f\u80fd\u76f8\u5173API",id:"\u67e5\u8be2\u7528\u6237\u529f\u80fd\u76f8\u5173api",level:2},{value:"GET /user",id:"get-user",level:3},{value:"\u8bf7\u6c42",id:"\u8bf7\u6c42-5",level:4},{value:"200 OK",id:"200-ok-2",level:5},{value:"404 Not Found",id:"404-not-found",level:5},{value:"\u89e3\u91ca",id:"\u89e3\u91ca-4",level:4},{value:"\u4fee\u6539\u90ae\u7bb1\u76f8\u5173API",id:"\u4fee\u6539\u90ae\u7bb1\u76f8\u5173api",level:2},{value:"PATCH /user/email",id:"patch-useremail",level:3},{value:"\u8bf7\u6c42",id:"\u8bf7\u6c42-6",level:4},{value:"\u671f\u671b\u7684\u54cd\u5e94",id:"\u671f\u671b\u7684\u54cd\u5e94-3",level:4},{value:"\u89e3\u91ca",id:"\u89e3\u91ca-5",level:4},{value:"\u9a8c\u8bc1\u5bc6\u7801\u76f8\u5173API",id:"\u9a8c\u8bc1\u5bc6\u7801\u76f8\u5173api",level:2},{value:"GET /checkPassword",id:"get-checkpassword",level:3},{value:"\u8bf7\u6c42",id:"\u8bf7\u6c42-7",level:4},{value:"200 OK",id:"200-ok-3",level:5},{value:"404 Not Found",id:"404-not-found-1",level:5},{value:"501",id:"501",level:5},{value:"\u4fee\u6539\u5bc6\u7801\u76f8\u5173API",id:"\u4fee\u6539\u5bc6\u7801\u76f8\u5173api",level:2},{value:"PATCH /password",id:"patch-password",level:3},{value:"\u8bf7\u6c42",id:"\u8bf7\u6c42-8",level:4},{value:"\u671f\u671b\u7684\u54cd\u5e94",id:"\u671f\u671b\u7684\u54cd\u5e94-4",level:4},{value:"\u89e3\u91ca",id:"\u89e3\u91ca-6",level:4},{value:"\u7528\u6237\u8d26\u6237\u5173\u7cfb\u76f8\u5173API",id:"\u7528\u6237\u8d26\u6237\u5173\u7cfb\u76f8\u5173api",level:2},{value:"POST /account",id:"post-account",level:3},{value:"\u8bf7\u6c42",id:"\u8bf7\u6c42-9",level:4},{value:"\u671f\u671b\u7684\u54cd\u5e94",id:"\u671f\u671b\u7684\u54cd\u5e94-5",level:4},{value:"POST /account/${accountName}/user",id:"post-accountaccountnameuser",level:3},{value:"\u8bf7\u6c42",id:"\u8bf7\u6c42-10",level:4},{value:"\u671f\u671b\u7684\u54cd\u5e94",id:"\u671f\u671b\u7684\u54cd\u5e94-6",level:4},{value:"DELETE /account/${accountName}/user/${userId}",id:"delete-accountaccountnameuseruserid",level:3},{value:"\u8bf7\u6c42",id:"\u8bf7\u6c42-11",level:4},{value:"\u671f\u671b\u7684\u54cd\u5e94",id:"\u671f\u671b\u7684\u54cd\u5e94-7",level:4}];function x(e){const d={code:"code",h1:"h1",h2:"h2",h3:"h3",h4:"h4",h5:"h5",li:"li",p:"p",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,i.R)(),...e.components};return(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(d.h1,{id:"\u5b9e\u73b0\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf",children:"\u5b9e\u73b0\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u7cfb\u7edf"}),"\n",(0,l.jsx)(d.p,{children:"\u5982\u679c\u7cfb\u7edf\u63d0\u4f9b\u7684\u8ba4\u8bc1\u7cfb\u7edf\u4e0d\u80fd\u6ee1\u8db3\u60a8\u7684\u9700\u6c42\uff0c\u60a8\u53ef\u4ee5\u81ea\u5df1\u5b9e\u73b0\u4e00\u4e2a\u81ea\u5b9a\u4e49\u8ba4\u8bc1\u670d\u52a1\u3002"}),"\n",(0,l.jsx)(d.h2,{id:"\u57fa\u672c\u6982\u5ff5",children:"\u57fa\u672c\u6982\u5ff5"}),"\n",(0,l.jsxs)(d.p,{children:["SCOW\u4e2d\u4f7f\u7528",(0,l.jsx)(d.code,{children:"identityId"}),"\u6807\u8bc6\u4e00\u4e2a\u7528\u6237\uff0c\u5e76\u540c\u65f6\u4f7f\u7528\u6b64",(0,l.jsx)(d.code,{children:"identityId"}),"\u4f5c\u4e3a\u7528\u6237\u5728\u96c6\u7fa4\u4e0a\u7684\u767b\u5f55\u540d\u3002"]}),"\n",(0,l.jsx)(d.p,{children:"\u7528\u6237\u767b\u5f55\u540e\uff0c\u8ba4\u8bc1\u7cfb\u7edf\u5e94\u8d1f\u8d23\u7ed9\u5f53\u524d\u767b\u5f55\u7528\u6237\u7684\u5f53\u524d\u4f1a\u8bdd\u8d4b\u4e88\u4e00\u4e2aToken\uff0cSCOW\u5c06\u4f1a\u5728\u6bcf\u6b21\u9700\u8981\u8ba4\u8bc1\u7684\u8bf7\u6c42\u65f6\u4f7f\u7528token\u8bf7\u6c42\u8ba4\u8bc1\u7cfb\u7edf\u4ee5\u83b7\u53d6\u7528\u6237\u7684\u8eab\u4efd\u3002"}),"\n",(0,l.jsx)(d.p,{children:"\u4e00\u4e2a\u8ba4\u8bc1\u670d\u52a1\u672c\u8d28\u662f\u4e00\u4e2a\u5b9e\u73b0\u4e86\u4ee5\u4e0bHTTP API\u7684HTTP\u670d\u52a1\u5668\u3002"}),"\n",(0,l.jsx)(d.p,{children:"\u8bf7\u6ce8\u610f"}),"\n",(0,l.jsxs)(d.ul,{children:["\n",(0,l.jsxs)(d.li,{children:["\u4ee5",(0,l.jsx)(d.code,{children:"/public"}),"\u5f00\u5934\u7684API\u5c06\u4f1a\u662f\u7528\u6237\u53ef\u4ee5\u76f4\u63a5\u8bbf\u95ee\u7684\uff0c\u5176\u4ed6\u7684\u7528\u6237\u4e0d\u53ef\u76f4\u63a5\u8bbf\u95ee"]}),"\n",(0,l.jsxs)(d.li,{children:["\u6240\u6709\u54cd\u5e94\u548c\u5904\u4e8e",(0,l.jsx)(d.code,{children:"body"}),"\u4f4d\u7f6e\u7684\u53c2\u6570\u5747\u4e3ajson\u683c\u5f0f"]}),"\n"]}),"\n",(0,l.jsx)(d.h2,{id:"\u5fc5\u987b\u5b9e\u73b0\u7684api",children:"\u5fc5\u987b\u5b9e\u73b0\u7684API"}),"\n",(0,l.jsx)(d.h3,{id:"get-publicauth",children:"GET /public/auth"}),"\n",(0,l.jsx)(d.p,{children:"\u53d1\u8d77\u767b\u5f55\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u8bf7\u6c42",children:"\u8bf7\u6c42"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u53c2\u6570"}),(0,l.jsx)(d.th,{children:"\u4f4d\u7f6e"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"callbackUrl"})}),(0,l.jsx)(d.td,{children:"querystring"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u767b\u5f55\u5b8c\u6210\u540e\u7684\u56de\u8c03\u5730\u5740\u3002\u5fc5\u987b\u662f\u4e00\u4e2a\u5408\u6cd5\u7684URL\u3002"})]})})]}),"\n",(0,l.jsx)(d.h4,{id:"\u671f\u671b\u7684\u54cd\u5e94",children:"\u671f\u671b\u7684\u54cd\u5e94"}),"\n",(0,l.jsx)(d.p,{children:"\u8fd4\u56de\u767b\u5f55HTML\u6216\u8005\u91cd\u5b9a\u5411\u5230\u5b9e\u9645\u7684\u767b\u5f55\u754c\u9762\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u89e3\u91ca",children:"\u89e3\u91ca"}),"\n",(0,l.jsx)(d.p,{children:"\u6b64API\u7528\u4e8e\u8fdb\u884c\u5b9e\u9645\u7684\u767b\u5f55\u64cd\u4f5c\u3002\u7528\u6237\u70b9\u51fb\u767b\u5f55\u540e\uff0c\u7cfb\u7edf\u5c06\u4f1a\u91cd\u5b9a\u5411\u5230\u8fd9\u4e2aURL\u3002\u60a8\u53ef\u4ee5\u9009\u62e9\u81ea\u5df1\u5b9e\u73b0\u4e00\u4e2a\u767b\u5f55\u9875\u9762\uff0c\u6216\u8005\u91cd\u5b9a\u5411\u5230\u7b2c\u4e09\u65b9\u767b\u5f55\u8ba4\u8bc1\u7684\u9875\u9762\u3002"}),"\n",(0,l.jsxs)(d.p,{children:["\u767b\u5f55\u5b8c\u6210\u540e\uff0c\u8bf7\u8fd4\u56de\u4e00\u4e2a\u91cd\u5b9a\u5411\u7684\u8bf7\u6c42\u5230",(0,l.jsx)(d.code,{children:"callbackUrl"}),"\u6307\u5b9a\u7684URL\uff0c\u5e76\u9644\u4e0aquerystring",(0,l.jsx)(d.code,{children:"?token={\u60a8\u7528\u6765\u8ddf\u8e2a\u672c\u7528\u6237\u7684\u72b6\u6001\u7684token}"}),"\u3002\u8fd9\u4e9btoken\u7684\u751f\u6210\u548c\u4fdd\u5b58\u60a8\u9700\u8981\u81ea\u5df1\u5b9e\u73b0\u3002\u540e\u7eed\u7684\u7528\u6237\u5c06\u4f1a\u5e26\u7740\u6b64token\u7528\u4e8e\u9274\u6743\u3002"]}),"\n",(0,l.jsxs)(d.p,{children:["\u5982\u679c\u60a8\u5728\u540e\u7aef\u4f7f\u7528\u7c7b\u4f3cOAuth2\u7684\u8ba4\u8bc1\u7cfb\u7edf\uff0c\u8fd9\u4e9b\u8ba4\u8bc1\u7cfb\u7edf\u767b\u5f55\u5b8c\u6210\u540e\u4f1a\u7ed9\u4e00\u4e2atoken\u7528\u4e8e\u8ddf\u8e2a\u7528\u6237\u72b6\u6001\u5e76\u91cd\u5b9a\u5411\u5230\u60a8\u6307\u5b9a\u7684\u56de\u8c03\u5730\u5740\u3002\u5bf9\u4e8e\u8fd9\u4e9b\u7cfb\u7edf\uff0c\u60a8\u5e94\u8be5\u81ea\u5df1\u5b9e\u73b0\u4e00\u4e2a\u5355\u72ec\u7684\u56de\u8c03\u5730\u5740\uff08\u4e14\u8fd9\u4e9b\u56de\u8c03\u5730\u5740\u7684URL\u5fc5\u987b\u4ee5",(0,l.jsx)(d.code,{children:"/public"}),"\u4e3a\u524d\u7f00\u4ee5\u4f7f\u7528\u6237\u53ef\u4ee5\u76f4\u63a5\u8bbf\u95ee\uff09\uff0c\u5728\u8fd9\u4e9b\u5730\u5740\u7684\u5904\u7406\u51fd\u6570\u4e2d\u83b7\u53d6\u8ba4\u8bc1\u7cfb\u7edf\u7ed9\u4e88\u7684token\uff0c\u5e76\u4f7f\u7528token\u8fdb\u884c\u540e\u7eed\u7684\u5904\u7406\uff08\u4f8b\u5982\u751f\u6210\u81ea\u5df1\u7684token\uff0c\u5c06\u8fd9\u4e9btoken\u6620\u5c04\u5230\u7528\u6237\u7b49\uff09\u3002\u5904\u7406\u5b8c\u6210\u540e\uff0c\u518d\u56de\u8c03\u5230",(0,l.jsx)(d.code,{children:"callbackUrl"}),"\u6307\u5b9a\u7684URL\u3002"]}),"\n",(0,l.jsx)(d.h3,{id:"get-publicvalidatetoken",children:"GET /public/validateToken"}),"\n",(0,l.jsx)(d.p,{children:"\u9a8c\u8bc1token\uff0c\u8fd4\u56de\u5bf9\u5e94\u7684\u7528\u6237ID\u3002SCOW\u5c06\u4f1a\u5728\u6bcf\u6b21\u9700\u8981\u9a8c\u8bc1\u7684\u8bf7\u6c42\u53d1\u751f\u65f6\uff0c\u4f7f\u7528\u767b\u5f55\u65f6\u83b7\u53d6\u7684token\u8bf7\u6c42\u6b64API\uff0c\u6240\u4ee5\u8bf7\u4fdd\u8bc1\u6b64API\u7684\u6027\u80fd\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u8bf7\u6c42-1",children:"\u8bf7\u6c42"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u53c2\u6570"}),(0,l.jsx)(d.th,{children:"\u4f4d\u7f6e"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"token"})}),(0,l.jsx)(d.td,{children:"querystring"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u7528\u6237\u7684token"})]})})]}),"\n",(0,l.jsx)(d.h4,{id:"\u671f\u671b\u7684\u54cd\u5e94-1",children:"\u671f\u671b\u7684\u54cd\u5e94"}),"\n",(0,l.jsx)(d.h5,{id:"200-ok",children:"200 OK"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u5b57\u6bb5"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"identityId"})}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u6b64token\u5bf9\u5e94\u7684\u7528\u6237\u7684\u7528\u6237ID"})]})})]}),"\n",(0,l.jsx)(d.h5,{id:"400-bad-request",children:"400 Bad Request"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u5b57\u6bb5"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"code"})}),(0,l.jsxs)(d.td,{children:["\u5b57\u7b26\u4e32\u5e38\u91cf",(0,l.jsx)(d.code,{children:"INVALID_TOKEN"})]}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsxs)(d.td,{children:[(0,l.jsx)(d.code,{children:"INVALID_TOKEN"}),"\uff1atoken\u65e0\u6548"]})]})})]}),"\n",(0,l.jsx)(d.h3,{id:"delete-token",children:"DELETE /token"}),"\n",(0,l.jsx)(d.p,{children:"\u65e0\u6548\u5316\u4e00\u4e2atoken\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u8bf7\u6c42-2",children:"\u8bf7\u6c42"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u53c2\u6570"}),(0,l.jsx)(d.th,{children:"\u4f4d\u7f6e"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"token"})}),(0,l.jsx)(d.td,{children:"query"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"token"})]})})]}),"\n",(0,l.jsx)(d.h4,{id:"\u54cd\u5e94",children:"\u54cd\u5e94"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u72b6\u6001\u7801"}),(0,l.jsx)(d.th,{children:"\u5185\u5bb9"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"204"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u64cd\u4f5c\u5b8c\u6210\u3002\u5982\u679ctoken\u4e0d\u5b58\u5728\u4e5f\u5e94\u8be5\u8fd4\u56de\u8fd9\u4e2a\u72b6\u6001\u7801\u3002"})]})})]}),"\n",(0,l.jsx)(d.h4,{id:"\u89e3\u91ca-1",children:"\u89e3\u91ca"}),"\n",(0,l.jsxs)(d.p,{children:["\u6b64API\u7528\u4e8e\u65e0\u6548\u5316\u4e00\u4e2atoken\u3002\u8c03\u7528\u8fd9\u4e2a\u8bf7\u6c42\u540e\uff0c\u8fd9\u4e2atoken\u5c06\u4e0d\u5e94\u8be5\u7ee7\u7eed\u80fd\u591f\u901a\u8fc7",(0,l.jsx)(d.code,{children:"GET /validateToken"}),"\u83b7\u5f97\u7528\u6237\u7684\u4fe1\u606f\u3002"]}),"\n",(0,l.jsx)(d.h3,{id:"get-capabilities",children:"GET /capabilities"}),"\n",(0,l.jsx)(d.p,{children:"\u8fd4\u56de\u8ba4\u8bc1\u7cfb\u7edf\u652f\u6301\u7684\u80fd\u529b\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u8bf7\u6c42-3",children:"\u8bf7\u6c42"}),"\n",(0,l.jsx)(d.p,{children:"\u65e0\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u671f\u671b\u7684\u54cd\u5e94-2",children:"\u671f\u671b\u7684\u54cd\u5e94"}),"\n",(0,l.jsx)(d.h5,{id:"200-ok-1",children:"200 OK"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u5b57\u6bb5"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsxs)(d.tbody,{children:[(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"createUser"})}),(0,l.jsx)(d.td,{children:"boolean"}),(0,l.jsx)(d.td,{children:"\u5426"}),(0,l.jsx)(d.td,{children:"\u6b64\u8ba4\u8bc1\u7cfb\u7edf\u662f\u5426\u652f\u6301\u521b\u5efa\u7528\u6237"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"getUser"})}),(0,l.jsx)(d.td,{children:"boolean"}),(0,l.jsx)(d.td,{children:"\u5426"}),(0,l.jsx)(d.td,{children:"\u6b64\u8ba4\u8bc1\u7cfb\u7edf\u662f\u5426\u652f\u6301\u67e5\u8be2\u7528\u6237"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"checkPassword"})}),(0,l.jsx)(d.td,{children:"boolean"}),(0,l.jsx)(d.td,{children:"\u5426"}),(0,l.jsx)(d.td,{children:"\u6b64\u8ba4\u8bc1\u7cfb\u7edf\u662f\u5426\u652f\u6301\u9a8c\u8bc1\u7528\u6237\u5bc6\u7801"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"changePassword"})}),(0,l.jsx)(d.td,{children:"boolean"}),(0,l.jsx)(d.td,{children:"\u5426"}),(0,l.jsx)(d.td,{children:"\u6b64\u8ba4\u8bc1\u7cfb\u7edf\u662f\u5426\u652f\u6301\u4fee\u6539\u7528\u6237\u5bc6\u7801"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"accountUserRelation"})}),(0,l.jsx)(d.td,{children:"boolean"}),(0,l.jsx)(d.td,{children:"\u5426"}),(0,l.jsx)(d.td,{children:"\u6b64\u8ba4\u8bc1\u7cfb\u7edf\u662f\u5426\u652f\u6301\u7ba1\u7406\u7528\u6237\u8d26\u6237\u5173\u7cfb"})]})]})]}),"\n",(0,l.jsx)(d.h4,{id:"\u89e3\u91ca-2",children:"\u89e3\u91ca"}),"\n",(0,l.jsxs)(d.p,{children:["\u6b64API\u7528\u4e8e\u8ba4\u8bc1\u7cfb\u7edf\u58f0\u660e\u81ea\u5df1\u7684\u652f\u6301\u7684\u80fd\u529b\u3002\u7cfb\u7edf\u7684\u5176\u4ed6\u90e8\u5206\u5c06\u4f1a\u6839\u636e\u6b64API\u7684\u8fd4\u56de\u503c\u9009\u62e9\u6027\u5730\u9009\u62e9\u662f\u5426\u663e\u793a\u67d0\u4e9b\u529f\u80fd\u3002\u4f8b\u5982\uff0c\u5982\u679c",(0,l.jsx)(d.code,{children:"changePassword"}),"\u4e3a",(0,l.jsx)(d.code,{children:"false"}),"\u6216\u8005\u4e3a",(0,l.jsx)(d.code,{children:"undefined"}),"\uff0c\u90a3\u4e48\u524d\u7aef\u7cfb\u7edf\u5c06\u4f1a\u4e0d\u663e\u793a\u4fee\u6539\u5bc6\u7801\u7684\u529f\u80fd\u3002"]}),"\n",(0,l.jsx)(d.h2,{id:"\u521b\u5efa\u7528\u6237\u529f\u80fd\u76f8\u5173api",children:"\u521b\u5efa\u7528\u6237\u529f\u80fd\u76f8\u5173API"}),"\n",(0,l.jsx)(d.p,{children:"\u8ba4\u8bc1\u7cfb\u7edf\u5982\u679c\u58f0\u660e\u652f\u6301\u521b\u5efa\u7528\u6237\uff0c\u5219\u5fc5\u987b\u5b9e\u73b0\u6b64\u90e8\u5206\u7684API\u3002"}),"\n",(0,l.jsx)(d.h3,{id:"post-user",children:"POST /user"}),"\n",(0,l.jsx)(d.p,{children:"\u521b\u5efa\u7528\u6237\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u8bf7\u6c42-4",children:"\u8bf7\u6c42"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u53c2\u6570"}),(0,l.jsx)(d.th,{children:"\u4f4d\u7f6e"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsxs)(d.tbody,{children:[(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"identityId"})}),(0,l.jsx)(d.td,{children:"body"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u7528\u6237ID"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"password"})}),(0,l.jsx)(d.td,{children:"body"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u5bc6\u7801"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"id"})}),(0,l.jsx)(d.td,{children:"body"}),(0,l.jsx)(d.td,{children:"\u6574\u6570"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u7528\u6237\u5728\u6570\u636e\u5e93\u4e2d\u7684ID"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"name"})}),(0,l.jsx)(d.td,{children:"body"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u7528\u6237\u59d3\u540d"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"mail"})}),(0,l.jsx)(d.td,{children:"body"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u7528\u6237\u90ae\u7bb1"})]})]})]}),"\n",(0,l.jsx)(d.h4,{id:"\u54cd\u5e94-1",children:"\u54cd\u5e94"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u72b6\u6001\u7801"}),(0,l.jsx)(d.th,{children:"\u5185\u5bb9"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsxs)(d.tbody,{children:[(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"204"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u521b\u5efa\u5b8c\u6210"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"409"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u7528\u6237ID\u5df2\u7ecf\u5b58\u5728"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"501"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u4e0d\u652f\u6301\u521b\u5efa\u7528\u6237\u529f\u80fd"})]})]})]}),"\n",(0,l.jsx)(d.h4,{id:"\u89e3\u91ca-3",children:"\u89e3\u91ca"}),"\n",(0,l.jsxs)(d.p,{children:["\u6b64API\u7528\u4e8e\u5728\u8ba4\u8bc1\u7cfb\u7edf\u4e2d\u521b\u5efa\u7528\u6237\u3002\u5f53\u524d\uff0c\u7cfb\u7edf\u53ea\u652f\u6301\u901a\u8fc7\u7ba1\u7406\u7cfb\u7edf\u521b\u5efa\u7528\u6237\u3002\u7ba1\u7406\u7cfb\u7edf\u9996\u5148\u5728\u81ea\u5df1\u7684\u6570\u636e\u5e93\u4e2d\u521b\u5efa\u7528\u6237\uff0c\u7136\u540e\u8bf7\u6c42\u8ba4\u8bc1\u7cfb\u7edf\u521b\u5efa\u7528\u6237\u3002\u8bf7\u6c42\u53c2\u6570\u4e2d\u7684",(0,l.jsx)(d.code,{children:"id"}),"\u5373\u662f\u6570\u636e\u5e93\u4e2d\u8fd9\u4e2a\u65b0\u7684\u7528\u6237\u7684\u81ea\u589eID\u3002\u5982\u679c\u8ba4\u8bc1\u7cfb\u7edf\u8fd4\u56de\u975e\u6210\u529f\u7684\u8fd4\u56de\u503c\uff0c\u7ba1\u7406\u7cfb\u7edf\u5c06\u4f1a\u64a4\u56de\u5728\u6570\u636e\u5e93\u4e2d\u7684\u9879\u3002"]}),"\n",(0,l.jsx)(d.h2,{id:"\u67e5\u8be2\u7528\u6237\u529f\u80fd\u76f8\u5173api",children:"\u67e5\u8be2\u7528\u6237\u529f\u80fd\u76f8\u5173API"}),"\n",(0,l.jsx)(d.h3,{id:"get-user",children:"GET /user"}),"\n",(0,l.jsx)(d.p,{children:"\u83b7\u53d6\u5df2\u7ecf\u5b58\u5728\u7684\u7528\u6237\u4fe1\u606f\u3002\u76ee\u524d\u53ea\u9700\u8981\u8fd4\u56de\u7528\u6237\u7684ID\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u8bf7\u6c42-5",children:"\u8bf7\u6c42"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u53c2\u6570"}),(0,l.jsx)(d.th,{children:"\u4f4d\u7f6e"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"identityId"})}),(0,l.jsx)(d.td,{children:"querystring"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u7528\u6237\u7684ID"})]})})]}),"\n",(0,l.jsx)(d.h5,{id:"200-ok-2",children:"200 OK"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u5b57\u6bb5"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsxs)(d.tbody,{children:[(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"user.identityId"})}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u7528\u6237\u7684ID\u3002\u548c\u8bf7\u6c42\u7684identityId\u4e00\u81f4"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"user.name"})}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u5426"}),(0,l.jsx)(d.td,{children:"\u7528\u6237\u7684\u59d3\u540d\u3002\u5982\u679c\u8ba4\u8bc1\u7cfb\u7edf\u53ef\u4ee5\u83b7\u53d6\u7528\u6237\u7684\u59d3\u540d\uff0c\u5219\u8fd4\u56de\u3002\u5982\u679c\u4e0d\u80fd\u83b7\u53d6\uff0c\u5c31\u4e0d\u8bbe\u7f6e"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"user.mail"})}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u5426"}),(0,l.jsx)(d.td,{children:"\u7528\u6237\u7684\u90ae\u7bb1\u3002\u5982\u679c\u8ba4\u8bc1\u7cfb\u7edf\u53ef\u4ee5\u83b7\u53d6\u7528\u6237\u7684\u90ae\u7bb1\uff0c\u5219\u8fd4\u56de\u3002\u5982\u679c\u4e0d\u80fd\u83b7\u53d6\uff0c\u5c31\u4e0d\u8bbe\u7f6e"})]})]})]}),"\n",(0,l.jsx)(d.h5,{id:"404-not-found",children:"404 Not Found"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u5b57\u6bb5"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"code"})}),(0,l.jsxs)(d.td,{children:["\u5b57\u7b26\u4e32\u5e38\u91cf",(0,l.jsx)(d.code,{children:"USER_NOT_FOUND"})]}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsxs)(d.td,{children:[(0,l.jsx)(d.code,{children:"USER_NOT_FOUND"}),"\uff1a\u7528\u6237\u4e0d\u5b58\u5728"]})]})})]}),"\n",(0,l.jsx)(d.h4,{id:"\u89e3\u91ca-4",children:"\u89e3\u91ca"}),"\n",(0,l.jsx)(d.p,{children:"\u6b64API\u53ef\u4ee5\u83b7\u53d6\u7528\u6237\u7684\u4fe1\u606f\u3002\u6b64API\u4e5f\u53ef\u4ee5\u7528\u4e8e\u83b7\u53d6\u7528\u6237\u662f\u5426\u5b58\u5728\u3002"}),"\n",(0,l.jsx)(d.h2,{id:"\u4fee\u6539\u90ae\u7bb1\u76f8\u5173api",children:"\u4fee\u6539\u90ae\u7bb1\u76f8\u5173API"}),"\n",(0,l.jsx)(d.p,{children:"\u8ba4\u8bc1\u7cfb\u7edf\u5982\u679c\u58f0\u660e\u652f\u6301\u4fee\u6539\u90ae\u7bb1\uff0c\u5219\u5fc5\u987b\u5b9e\u73b0\u6b64\u90e8\u5206\u7684API\u3002"}),"\n",(0,l.jsx)(d.h3,{id:"patch-useremail",children:"PATCH /user/email"}),"\n",(0,l.jsx)(d.p,{children:"\u4fee\u6539\u90ae\u7bb1\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u8bf7\u6c42-6",children:"\u8bf7\u6c42"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u53c2\u6570"}),(0,l.jsx)(d.th,{children:"\u4f4d\u7f6e"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsxs)(d.tbody,{children:[(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"identityId"})}),(0,l.jsx)(d.td,{children:"body"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u7528\u6237ID"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"newEmail"})}),(0,l.jsx)(d.td,{children:"body"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u65b0\u90ae\u7bb1"})]})]})]}),"\n",(0,l.jsx)(d.h4,{id:"\u671f\u671b\u7684\u54cd\u5e94-3",children:"\u671f\u671b\u7684\u54cd\u5e94"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u72b6\u6001\u7801"}),(0,l.jsx)(d.th,{children:"\u5185\u5bb9"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsxs)(d.tbody,{children:[(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"204"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u4fee\u6539\u5b8c\u6210"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"404"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u7528\u6237\u672a\u627e\u5230"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"501"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u4e0d\u652f\u6301\u4fee\u6539\u90ae\u7bb1\u529f\u80fd"})]})]})]}),"\n",(0,l.jsx)(d.h4,{id:"\u89e3\u91ca-5",children:"\u89e3\u91ca"}),"\n",(0,l.jsx)(d.p,{children:"\u6b64API\u7528\u4e8e\u5b8c\u6210\u4fee\u6539\u90ae\u7bb1\u7684\u529f\u80fd\u3002"}),"\n",(0,l.jsx)(d.h2,{id:"\u9a8c\u8bc1\u5bc6\u7801\u76f8\u5173api",children:"\u9a8c\u8bc1\u5bc6\u7801\u76f8\u5173API"}),"\n",(0,l.jsx)(d.h3,{id:"get-checkpassword",children:"GET /checkPassword"}),"\n",(0,l.jsx)(d.p,{children:"\u9a8c\u8bc1\u5bc6\u7801\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u8bf7\u6c42-7",children:"\u8bf7\u6c42"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u53c2\u6570"}),(0,l.jsx)(d.th,{children:"\u4f4d\u7f6e"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsxs)(d.tbody,{children:[(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"identityId"})}),(0,l.jsx)(d.td,{children:"query"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u7528\u6237ID"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"password"})}),(0,l.jsx)(d.td,{children:"query"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u5bc6\u7801"})]})]})]}),"\n",(0,l.jsx)(d.h5,{id:"200-ok-3",children:"200 OK"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u5b57\u6bb5"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"success"})}),(0,l.jsx)(d.td,{children:"\u5e03\u5c14\u503c"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u9a8c\u8bc1\u7ed3\u679c"})]})})]}),"\n",(0,l.jsx)(d.h5,{id:"404-not-found-1",children:"404 Not Found"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u5b57\u6bb5"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"code"})}),(0,l.jsxs)(d.td,{children:["\u5b57\u7b26\u4e32\u5e38\u91cf",(0,l.jsx)(d.code,{children:"USER_NOT_FOUND"})]}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsxs)(d.td,{children:[(0,l.jsx)(d.code,{children:"USER_NOT_FOUND"}),"\uff1a\u7528\u6237\u4e0d\u5b58\u5728"]})]})})]}),"\n",(0,l.jsx)(d.h5,{id:"501",children:"501"}),"\n",(0,l.jsx)(d.p,{children:"\u8868\u793a\u6b64\u529f\u80fd\u5728\u5f53\u524d\u670d\u52a1\u5668\u914d\u7f6e\u4e0b\u4e0d\u53ef\u7528\uff0c\u8fd4\u56denull\u3002"}),"\n",(0,l.jsx)(d.h2,{id:"\u4fee\u6539\u5bc6\u7801\u76f8\u5173api",children:"\u4fee\u6539\u5bc6\u7801\u76f8\u5173API"}),"\n",(0,l.jsx)(d.p,{children:"\u8ba4\u8bc1\u7cfb\u7edf\u5982\u679c\u58f0\u660e\u652f\u6301\u4fee\u6539\u5bc6\u7801\uff0c\u5219\u5fc5\u987b\u5b9e\u73b0\u6b64\u90e8\u5206\u7684API\u3002"}),"\n",(0,l.jsx)(d.h3,{id:"patch-password",children:"PATCH /password"}),"\n",(0,l.jsx)(d.p,{children:"\u4fee\u6539\u5bc6\u7801\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u8bf7\u6c42-8",children:"\u8bf7\u6c42"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u53c2\u6570"}),(0,l.jsx)(d.th,{children:"\u4f4d\u7f6e"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsxs)(d.tbody,{children:[(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"identityId"})}),(0,l.jsx)(d.td,{children:"body"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u7528\u6237ID"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"newPassword"})}),(0,l.jsx)(d.td,{children:"body"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u65b0\u5bc6\u7801"})]})]})]}),"\n",(0,l.jsx)(d.h4,{id:"\u671f\u671b\u7684\u54cd\u5e94-4",children:"\u671f\u671b\u7684\u54cd\u5e94"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u72b6\u6001\u7801"}),(0,l.jsx)(d.th,{children:"\u5185\u5bb9"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsxs)(d.tbody,{children:[(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"204"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u4fee\u6539\u5b8c\u6210"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"404"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u7528\u6237\u672a\u627e\u5230"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"501"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u4e0d\u652f\u6301\u4fee\u6539\u5bc6\u7801\u529f\u80fd"})]})]})]}),"\n",(0,l.jsx)(d.h4,{id:"\u89e3\u91ca-6",children:"\u89e3\u91ca"}),"\n",(0,l.jsx)(d.p,{children:"\u6b64API\u7528\u4e8e\u5b8c\u6210\u4fee\u6539\u5bc6\u7801\u7684\u529f\u80fd\u3002"}),"\n",(0,l.jsx)(d.h2,{id:"\u7528\u6237\u8d26\u6237\u5173\u7cfb\u76f8\u5173api",children:"\u7528\u6237\u8d26\u6237\u5173\u7cfb\u76f8\u5173API"}),"\n",(0,l.jsx)(d.p,{children:"\u8ba4\u8bc1\u7cfb\u7edf\u5982\u679c\u58f0\u660e\u652f\u6301\u7ba1\u7406\u7528\u6237\u8d26\u6237\u5173\u7cfb\uff0c\u5219\u5fc5\u987b\u5b9e\u73b0\u6b64\u90e8\u5206API\u3002"}),"\n",(0,l.jsx)(d.h3,{id:"post-account",children:"POST /account"}),"\n",(0,l.jsx)(d.p,{children:"\u5728\u8ba4\u8bc1\u7cfb\u7edf\u4e2d\u521b\u5efa\u8d26\u6237\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u8bf7\u6c42-9",children:"\u8bf7\u6c42"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u53c2\u6570"}),(0,l.jsx)(d.th,{children:"\u4f4d\u7f6e"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsxs)(d.tbody,{children:[(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"accountName"})}),(0,l.jsx)(d.td,{children:"body"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u8d26\u6237\u540d"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"ownerUserId"})}),(0,l.jsx)(d.td,{children:"body"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u62e5\u6709\u8005\u7528\u6237ID"})]})]})]}),"\n",(0,l.jsx)(d.h4,{id:"\u671f\u671b\u7684\u54cd\u5e94-5",children:"\u671f\u671b\u7684\u54cd\u5e94"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u72b6\u6001\u7801"}),(0,l.jsx)(d.th,{children:"\u5185\u5bb9"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"204"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u521b\u5efa\u6210\u529f"})]})})]}),"\n",(0,l.jsx)(d.h3,{id:"post-accountaccountnameuser",children:"POST /account/${accountName}/user"}),"\n",(0,l.jsx)(d.p,{children:"\u628a\u7528\u6237\u52a0\u5165\u8d26\u6237\u4e2d\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u8bf7\u6c42-10",children:"\u8bf7\u6c42"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u53c2\u6570"}),(0,l.jsx)(d.th,{children:"\u4f4d\u7f6e"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsxs)(d.tbody,{children:[(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"accountName"})}),(0,l.jsx)(d.td,{children:"path"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u8d26\u6237\u540d"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"userId"})}),(0,l.jsx)(d.td,{children:"body"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u7528\u6237ID"})]})]})]}),"\n",(0,l.jsx)(d.h4,{id:"\u671f\u671b\u7684\u54cd\u5e94-6",children:"\u671f\u671b\u7684\u54cd\u5e94"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u72b6\u6001\u7801"}),(0,l.jsx)(d.th,{children:"\u5185\u5bb9"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"204"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u628a\u7528\u6237\u52a0\u5165\u8d26\u6237\u6210\u529f"})]})})]}),"\n",(0,l.jsx)(d.h3,{id:"delete-accountaccountnameuseruserid",children:"DELETE /account/${accountName}/user/${userId}"}),"\n",(0,l.jsx)(d.p,{children:"\u628a\u7528\u6237\u4ece\u8d26\u6237\u4e2d\u5220\u9664\u3002"}),"\n",(0,l.jsx)(d.h4,{id:"\u8bf7\u6c42-11",children:"\u8bf7\u6c42"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u53c2\u6570"}),(0,l.jsx)(d.th,{children:"\u4f4d\u7f6e"}),(0,l.jsx)(d.th,{children:"\u7c7b\u578b"}),(0,l.jsx)(d.th,{children:"\u662f\u5426\u5fc5\u987b"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsxs)(d.tbody,{children:[(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"accountName"})}),(0,l.jsx)(d.td,{children:"path"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u8d26\u6237\u540d"})]}),(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"userId"})}),(0,l.jsx)(d.td,{children:"path"}),(0,l.jsx)(d.td,{children:"\u5b57\u7b26\u4e32"}),(0,l.jsx)(d.td,{children:"\u662f"}),(0,l.jsx)(d.td,{children:"\u7528\u6237ID"})]})]})]}),"\n",(0,l.jsx)(d.h4,{id:"\u671f\u671b\u7684\u54cd\u5e94-7",children:"\u671f\u671b\u7684\u54cd\u5e94"}),"\n",(0,l.jsxs)(d.table,{children:[(0,l.jsx)(d.thead,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.th,{children:"\u72b6\u6001\u7801"}),(0,l.jsx)(d.th,{children:"\u5185\u5bb9"}),(0,l.jsx)(d.th,{children:"\u89e3\u91ca"})]})}),(0,l.jsx)(d.tbody,{children:(0,l.jsxs)(d.tr,{children:[(0,l.jsx)(d.td,{children:(0,l.jsx)(d.code,{children:"204"})}),(0,l.jsx)(d.td,{children:"\u65e0"}),(0,l.jsx)(d.td,{children:"\u5220\u9664\u7528\u6237\u6210\u529f"})]})})]})]})}function j(e={}){const{wrapper:d}={...(0,i.R)(),...e.components};return d?(0,l.jsx)(d,{...e,children:(0,l.jsx)(x,{...e})}):x(e)}},5409:(e,d,n)=>{n.d(d,{R:()=>h,x:()=>r});var l=n(48318);const i={},s=l.createContext(i);function h(e){const d=l.useContext(s);return l.useMemo((function(){return"function"==typeof e?e(d):{...d,...e}}),[d,e])}function r(e){let d;return d=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:h(e.components),l.createElement(s.Provider,{value:d},e.children)}}}]);