"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[4701],{25452:(e,n,i)=>{i.r(n),i.d(n,{assets:()=>l,contentTitle:()=>d,default:()=>x,frontMatter:()=>r,metadata:()=>o,toc:()=>t});var s=i(49214),c=i(5409);const r={sidebar_position:2,title:"\u6570\u636e\u7edf\u8ba1\u76f8\u5173API"},d="\u6570\u636e\u7edf\u8ba1\u76f8\u5173API",o={id:"integration/scow-api-hook/api/statistic",title:"\u6570\u636e\u7edf\u8ba1\u76f8\u5173API",description:"SCOW\u7cfb\u7edf\u63d0\u4f9b\u4e86\u4e00\u4e9b\u6570\u636e\u7edf\u8ba1\u76f8\u5173\u7684API\uff0c\u60a8\u53ef\u4ee5\u901a\u8fc7\u8fd9\u4e9bAPI\u83b7\u53d6SCOW\u7cfb\u7edf\u7684\u4e00\u4e9b\u7edf\u8ba1\u6570\u636e\u3002\u5176\u4e2d\u6709\u90e8\u5206API\u662f\u4ee5\u65e5\u671f\u4e3a\u7ef4\u5ea6\u8fdb\u884c\u7684\u7edf\u8ba1\uff0c\u60a8\u53ef\u4ee5\u901a\u8fc7\u8fd9\u4e9bAPI\u83b7\u53d6x\u5929\u5185\u6bcf\u4e00\u5929\u7684\u7edf\u8ba1\u6570\u636e\u3002\u4f46\u7531\u4e8e\u6570\u636e\u5e93\u91cc\u91c7\u7528\u7684\u662fUTC\u65f6\u95f4\uff0c\u5982\u679c\u5e0c\u671b\u7edf\u8ba1\u7684\u7ef4\u5ea6\u548c\u5ba2\u6237\u7aef\u4e00\u81f4\uff0c\u5728\u4f7f\u7528\u8fd9\u4e9bAPI\u65f6\uff0c\u60a8\u9700\u8981\u6ce8\u610f\u65f6\u533a\u7684\u95ee\u9898\u3002",source:"@site/docs/integration/scow-api-hook/api/statistic.md",sourceDirName:"integration/scow-api-hook/api",slug:"/integration/scow-api-hook/api/statistic",permalink:"/SCOW/pr-preview/pr-1311/docs/integration/scow-api-hook/api/statistic",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/integration/scow-api-hook/api/statistic.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2,title:"\u6570\u636e\u7edf\u8ba1\u76f8\u5173API"},sidebar:"integration",previous:{title:"SCOW API",permalink:"/SCOW/pr-preview/pr-1311/docs/integration/scow-api-hook/api/"},next:{title:"SCOW Protobuf\u6587\u4ef6",permalink:"/SCOW/pr-preview/pr-1311/docs/integration/scow-api-hook/proto"}},l={},t=[{value:"\u76f8\u5173API",id:"\u76f8\u5173api",level:2},{value:"\u53c2\u6570 TimeZone",id:"\u53c2\u6570-timezone",level:2},{value:"\u53ef\u7528\u65f6\u533a\u540d\u79f0\u53caUTC\u504f\u79fb\u91cf",id:"\u53ef\u7528\u65f6\u533a\u540d\u79f0\u53cautc\u504f\u79fb\u91cf",level:2}];function h(e){const n={code:"code",h1:"h1",h2:"h2",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...(0,c.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.h1,{id:"\u6570\u636e\u7edf\u8ba1\u76f8\u5173api",children:"\u6570\u636e\u7edf\u8ba1\u76f8\u5173API"}),"\n",(0,s.jsx)(n.p,{children:"SCOW\u7cfb\u7edf\u63d0\u4f9b\u4e86\u4e00\u4e9b\u6570\u636e\u7edf\u8ba1\u76f8\u5173\u7684API\uff0c\u60a8\u53ef\u4ee5\u901a\u8fc7\u8fd9\u4e9bAPI\u83b7\u53d6SCOW\u7cfb\u7edf\u7684\u4e00\u4e9b\u7edf\u8ba1\u6570\u636e\u3002\u5176\u4e2d\u6709\u90e8\u5206API\u662f\u4ee5\u65e5\u671f\u4e3a\u7ef4\u5ea6\u8fdb\u884c\u7684\u7edf\u8ba1\uff0c\u60a8\u53ef\u4ee5\u901a\u8fc7\u8fd9\u4e9bAPI\u83b7\u53d6x\u5929\u5185\u6bcf\u4e00\u5929\u7684\u7edf\u8ba1\u6570\u636e\u3002\u4f46\u7531\u4e8e\u6570\u636e\u5e93\u91cc\u91c7\u7528\u7684\u662fUTC\u65f6\u95f4\uff0c\u5982\u679c\u5e0c\u671b\u7edf\u8ba1\u7684\u7ef4\u5ea6\u548c\u5ba2\u6237\u7aef\u4e00\u81f4\uff0c\u5728\u4f7f\u7528\u8fd9\u4e9bAPI\u65f6\uff0c\u60a8\u9700\u8981\u6ce8\u610f\u65f6\u533a\u7684\u95ee\u9898\u3002"}),"\n",(0,s.jsx)(n.h2,{id:"\u76f8\u5173api",children:"\u76f8\u5173API"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"GetActiveUserCount"}),"\uff1a\u83b7\u53d6x\u5929\u5185\u6bcf\u4e00\u5929\u7684\u7528\u6237\u767b\u5f55\u6b21\u6570"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"GetNewUserCount"}),"\uff1a\u83b7\u53d6x\u5929\u5185\u6bcf\u4e00\u5929\u7684\u65b0\u7528\u6237\u6ce8\u518c\u6570"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"GetNewJobCount"}),"\uff1a\u83b7\u53d6x\u5929\u5185\u6bcf\u4e00\u5929\u7684\u65b0\u4f5c\u4e1a\u63d0\u4ea4\u6570"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"GetDailyCharge"}),"\uff1a\u83b7\u53d6x\u5929\u5185\u6bcf\u4e00\u5929\u7684\u7528\u6237\u6d88\u8d39\u91d1\u989d\u603b\u8ba1"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"GetDailyPay"}),": \u83b7\u53d6x\u5929\u5185\u6bcf\u4e00\u5929\u7684\u7528\u6237\u5145\u503c\u91d1\u989d\u603b\u8ba1"]}),"\n"]}),"\n",(0,s.jsx)(n.h2,{id:"\u53c2\u6570-timezone",children:"\u53c2\u6570 TimeZone"}),"\n",(0,s.jsx)(n.p,{children:"\u4ee5\u4e0aAPI\u5728\u8c03\u7528\u65f6\u90fd\u9700\u8981\u4f20timeZone\u53c2\u6570\uff0c\u8fd9\u4e2a\u53c2\u6570\u662f\u7528\u6765\u6307\u5b9a\u7edf\u8ba1\u7684\u65f6\u533a\u3002\u5982\u679c\u4e0d\u4f20timeZone\u53c2\u6570\uff0c\u7edf\u8ba1\u7684\u65f6\u533a\u9ed8\u8ba4\u4e3aUTC\u3002\u5982\u679c\u5e0c\u671b\u7edf\u8ba1\u7684\u7ef4\u5ea6\u548c\u5ba2\u6237\u7aef\u4e00\u81f4\uff0c\u60a8\u9700\u8981\u4f20\u5165timeZone\u53c2\u6570\u3002"}),"\n",(0,s.jsx)(n.p,{children:"timeZone\u53c2\u6570\u8bf7\u9075\u5faa\u4ee5\u4e0b\u683c\u5f0f\u6307\u5357\uff1a"}),"\n",(0,s.jsxs)(n.ol,{children:["\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"UTC\u504f\u79fb\u91cf"}),": \u4f7f\u7528\u683c\u5f0f+HH",":MM","\u6216-HH",":MM","\u8868\u793a\u76f8\u5bf9\u4e8eUTC\u7684\u504f\u79fb\u3002\u4f8b\u5982\uff0c+08:00\u8868\u793a\u4e1c\u516b\u533a\u3002"]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.strong,{children:"\u65f6\u533a\u540d\u79f0"}),": \u4f7f\u7528\u5177\u4f53\u7684\u5730\u7406\u65f6\u533a\u540d\u79f0\uff0c\u5982Asia/Shanghai\u6216Europe/London\u3002\u8fd9\u4e9b\u540d\u79f0\u4ee3\u8868\u7279\u5b9a\u5730\u533a\u7684\u6807\u51c6\u65f6\u95f4\u3002"]}),"\n"]}),"\n"]}),"\n",(0,s.jsx)(n.p,{children:"\u8bf7\u6839\u636e\u60a8\u7684\u9700\u6c42\u9009\u62e9\u4ee5\u4e0a\u4e00\u79cd\u683c\u5f0f\u6765\u6307\u5b9a\u65f6\u533a\u3002"}),"\n",(0,s.jsx)(n.h2,{id:"\u53ef\u7528\u65f6\u533a\u540d\u79f0\u53cautc\u504f\u79fb\u91cf",children:"\u53ef\u7528\u65f6\u533a\u540d\u79f0\u53caUTC\u504f\u79fb\u91cf"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC-12:00"})," ",(0,s.jsx)(n.code,{children:"Etc/GMT+12"})," - ",(0,s.jsx)(n.code,{children:"-12:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC-11:00"})," ",(0,s.jsx)(n.code,{children:"Pacific/Pago_Pago"})," - ",(0,s.jsx)(n.code,{children:"-11:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC-10:00"})," ",(0,s.jsx)(n.code,{children:"Pacific/Honolulu"})," - ",(0,s.jsx)(n.code,{children:"-10:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC-09:00"})," ",(0,s.jsx)(n.code,{children:"America/Anchorage"})," - ",(0,s.jsx)(n.code,{children:"-09:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC-08:00"})," ",(0,s.jsx)(n.code,{children:"America/Los_Angeles"})," - ",(0,s.jsx)(n.code,{children:"-08:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC-07:00"})," ",(0,s.jsx)(n.code,{children:"America/Denver"})," - ",(0,s.jsx)(n.code,{children:"-07:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC-06:00"})," ",(0,s.jsx)(n.code,{children:"America/Chicago"})," - ",(0,s.jsx)(n.code,{children:"-06:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC-05:00"})," ",(0,s.jsx)(n.code,{children:"America/New_York"})," - ",(0,s.jsx)(n.code,{children:"-05:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC-04:00"})," ",(0,s.jsx)(n.code,{children:"America/Caracas"})," - ",(0,s.jsx)(n.code,{children:"-04:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC-03:00"})," ",(0,s.jsx)(n.code,{children:"America/Argentina/Buenos_Aires"})," - ",(0,s.jsx)(n.code,{children:"-03:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC-02:00"})," ",(0,s.jsx)(n.code,{children:"Atlantic/South_Georgia"})," - ",(0,s.jsx)(n.code,{children:"-02:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC-01:00"})," ",(0,s.jsx)(n.code,{children:"Atlantic/Azores"})," - ",(0,s.jsx)(n.code,{children:"-01:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+00:00"})," ",(0,s.jsx)(n.code,{children:"UTC"})," - ",(0,s.jsx)(n.code,{children:"+00:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+01:00"})," ",(0,s.jsx)(n.code,{children:"Europe/Paris"})," - ",(0,s.jsx)(n.code,{children:"+01:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+02:00"})," ",(0,s.jsx)(n.code,{children:"Europe/Athens"})," - ",(0,s.jsx)(n.code,{children:"+02:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+03:00"})," ",(0,s.jsx)(n.code,{children:"Europe/Moscow"})," - ",(0,s.jsx)(n.code,{children:"+03:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+04:00"})," ",(0,s.jsx)(n.code,{children:"Asia/Dubai"})," - ",(0,s.jsx)(n.code,{children:"+04:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+05:00"})," ",(0,s.jsx)(n.code,{children:"Asia/Karachi"})," - ",(0,s.jsx)(n.code,{children:"+05:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+06:00"})," ",(0,s.jsx)(n.code,{children:"Asia/Dhaka"})," - ",(0,s.jsx)(n.code,{children:"+06:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+07:00"})," ",(0,s.jsx)(n.code,{children:"Asia/Bangkok"})," - ",(0,s.jsx)(n.code,{children:"+07:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+08:00"})," ",(0,s.jsx)(n.code,{children:"Asia/Shanghai"})," - ",(0,s.jsx)(n.code,{children:"+08:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+09:00"})," ",(0,s.jsx)(n.code,{children:"Asia/Tokyo"})," - ",(0,s.jsx)(n.code,{children:"+09:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+10:00"})," ",(0,s.jsx)(n.code,{children:"Australia/Sydney"})," - ",(0,s.jsx)(n.code,{children:"+10:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+11:00"})," ",(0,s.jsx)(n.code,{children:"Pacific/Noumea"})," - ",(0,s.jsx)(n.code,{children:"+11:00"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"UTC+12:00"})," ",(0,s.jsx)(n.code,{children:"Pacific/Fiji"})," - ",(0,s.jsx)(n.code,{children:"+12:00"})]}),"\n"]})]})}function x(e={}){const{wrapper:n}={...(0,c.R)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(h,{...e})}):h(e)}},5409:(e,n,i)=>{i.d(n,{R:()=>d,x:()=>o});var s=i(48318);const c={},r=s.createContext(c);function d(e){const n=s.useContext(r);return s.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(c):e.components||c:d(e.components),s.createElement(r.Provider,{value:n},e.children)}}}]);