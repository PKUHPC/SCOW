"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[9410],{86548:(e,n,c)=>{c.r(n),c.d(n,{assets:()=>l,contentTitle:()=>i,default:()=>p,frontMatter:()=>s,metadata:()=>t,toc:()=>o});var d=c(35250),r=c(57766);const s={sidebar_position:2,title:"\u914d\u7f6eWeb\u7c7b\u5e94\u7528"},i="\u914d\u7f6eWeb\u7c7b\u5e94\u7528",t={id:"deploy/config/portal/apps/configure-web-app",title:"\u914d\u7f6eWeb\u7c7b\u5e94\u7528",description:"\u524d\u63d0\u6761\u4ef6",source:"@site/docs/deploy/config/portal/apps/configure-web-app.md",sourceDirName:"deploy/config/portal/apps",slug:"/deploy/config/portal/apps/configure-web-app",permalink:"/SCOW/pr-preview/pr-987/docs/deploy/config/portal/apps/configure-web-app",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/portal/apps/configure-web-app.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2,title:"\u914d\u7f6eWeb\u7c7b\u5e94\u7528"},sidebar:"deploy",previous:{title:"\u4ea4\u4e92\u5f0f\u4f5c\u4e1a",permalink:"/SCOW/pr-preview/pr-987/docs/deploy/config/portal/apps/intro"},next:{title:"\u914d\u7f6e\u684c\u9762\u7c7b\u5e94\u7528",permalink:"/SCOW/pr-preview/pr-987/docs/deploy/config/portal/apps/configure-vnc-app"}},l={},o=[{value:"\u524d\u63d0\u6761\u4ef6",id:"\u524d\u63d0\u6761\u4ef6",level:2},{value:"\u914d\u7f6e\u793a\u4f8b",id:"\u914d\u7f6e\u793a\u4f8b",level:2},{value:"\u914d\u7f6e\u89e3\u91ca",id:"\u914d\u7f6e\u89e3\u91ca",level:2},{value:"<code>proxyType</code>",id:"proxytype",level:3},{value:"<code>beforeScript</code>\u548c<code>script</code>",id:"beforescript\u548cscript",level:3},{value:"<code>connect</code>",id:"connect",level:3},{value:"<code>attributes</code>",id:"attributes",level:3}];function h(e){const n={a:"a",blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,r.a)(),...e.components};return(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)(n.h1,{id:"\u914d\u7f6eweb\u7c7b\u5e94\u7528",children:"\u914d\u7f6eWeb\u7c7b\u5e94\u7528"}),"\n",(0,d.jsx)(n.h2,{id:"\u524d\u63d0\u6761\u4ef6",children:"\u524d\u63d0\u6761\u4ef6"}),"\n",(0,d.jsx)(n.p,{children:"\u8bf7\u786e\u4fdd\u5728\u9700\u8981\u8fd0\u884c\u5e94\u7528\u7684\u8ba1\u7b97\u8282\u70b9\u4e0a\u5b89\u88c5\u6709\u9700\u8981\u7684\u8f6f\u4ef6\u5305\u3002"}),"\n",(0,d.jsx)(n.h2,{id:"\u914d\u7f6e\u793a\u4f8b",children:"\u914d\u7f6e\u793a\u4f8b"}),"\n",(0,d.jsxs)(n.p,{children:["\u4e0b\u9762\u4ee5\u4f7f\u7528",(0,d.jsx)(n.a,{href:"https://github.com/coder/code-server",children:"coder/code-server"}),"\u542f\u52a8VSCode\u7684\u914d\u7f6e\u4e3a\u4f8b\u6765\u8bb2\u89e3\u5982\u4f55\u914d\u7f6e\u4e00\u4e2a\u670d\u52a1\u5668\u7c7b\u5e94\u7528\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:["\u521b\u5efa",(0,d.jsx)(n.code,{children:"config/apps"}),"\u76ee\u5f55\uff0c\u5728\u91cc\u9762\u521b\u5efa",(0,d.jsx)(n.code,{children:"vscode/config.yml"}),"\u6216",(0,d.jsx)(n.code,{children:"vscode.yml"}),"\u6587\u4ef6\uff0c\u5176\u5185\u5bb9\u5982\u4e0b\uff1a"]}),"\n",(0,d.jsx)(n.pre,{children:(0,d.jsx)(n.code,{className:"language-yaml",metastring:'title="config/apps/vscode/config.yml"',children:'# \u8fd9\u4e2a\u5e94\u7528\u7684ID\nid: vscode\n\n# \u8fd9\u4e2a\u5e94\u7528\u7684\u540d\u5b57\nname: VSCode\n\n# \u6307\u5b9a\u5e94\u7528\u7c7b\u578b\u4e3aweb\ntype: web\n\n# Web\u5e94\u7528\u7684\u914d\u7f6e\nweb:\n\n  # \u6307\u5b9a\u53cd\u5411\u4ee3\u7406\u7c7b\u578b\n  proxyType: relative\n\n  # \u51c6\u5907\u811a\u672c\n  beforeScript: |\n    export PORT=$(get_port)\n    export PASSWORD=$(get_password 12)\n\n  # \u8fd0\u884c\u4efb\u52a1\u7684\u811a\u672c\u3002\u53ef\u4ee5\u4f7f\u7528\u51c6\u5907\u811a\u672c\u5b9a\u4e49\u7684\u53d8\u91cf\n  script: |\n    PASSWORD=$PASSWORD code-server -vvv --bind-addr 0.0.0.0:$PORT --auth password\n\n  # \u5982\u4f55\u8fde\u63a5\u5e94\u7528\n  connect:\n    method: POST\n    path: /login\n    formData:\n      password: "{{ PASSWORD }}"\n\n'})}),"\n",(0,d.jsx)(n.p,{children:"\u589e\u52a0\u4e86\u6b64\u6587\u4ef6\u540e\uff0c\u5237\u65b0\u5373\u53ef\u3002"}),"\n",(0,d.jsx)(n.h2,{id:"\u914d\u7f6e\u89e3\u91ca",children:"\u914d\u7f6e\u89e3\u91ca"}),"\n",(0,d.jsx)(n.h3,{id:"proxytype",children:(0,d.jsx)(n.code,{children:"proxyType"})}),"\n",(0,d.jsx)(n.p,{children:"\u7528\u6237\u901a\u8fc7\u4ee5\u4e0b\u683c\u5f0f\u7684URL\u8bbf\u95eeWeb\u7c7b\u7684\u4ea4\u4e92\u5f0f\u5e94\u7528"}),"\n",(0,d.jsxs)(n.blockquote,{children:["\n",(0,d.jsxs)(n.p,{children:["http[s]://",(0,d.jsx)(n.code,{children:"${\u57df\u540d\u6216\u8005IP}"}),"/",(0,d.jsx)(n.code,{children:"${SCOW\u7cfb\u7edf\u7684base path}"}),"/api/proxy/",(0,d.jsx)(n.code,{children:"${\u8fd0\u884c\u5e94\u7528\u7684\u96c6\u7fa4ID}"}),"/",(0,d.jsx)(n.code,{children:"${\u8fd9\u4e2a\u5e94\u7528\u7684proxyType}"}),"/",(0,d.jsx)(n.code,{children:"${\u8ba1\u7b97\u8282\u70b9\u7684IP\u6216\u8005\u4e3b\u673a\u540d}"}),"/",(0,d.jsx)(n.code,{children:"${\u5e94\u7528\u6240\u5728\u7684\u7aef\u53e3\u53f7}"}),"/",(0,d.jsx)(n.code,{children:"${...\u5e94\u7528\u6240\u9700\u8981\u7684path}"})]}),"\n"]}),"\n",(0,d.jsxs)(n.p,{children:["\u5bf9\u4e8eweb\u7c7b\u578b\u7684\u5e94\u7528\uff0c\u9700\u8981\u914d\u7f6e",(0,d.jsx)(n.code,{children:"proxyType"}),"\u3002\u4e0d\u540c\u7684\u4ea4\u4e92\u5f0f\u5e94\u7528\u4f7f\u7528\u4e86\u4e0d\u540c\u7684nginx proxy\u65b9\u5f0f\uff0c\u901a\u8fc7\u914d\u7f6e",(0,d.jsx)(n.code,{children:"proxyType"}),"\uff0c\u53ef\u4ee5\u5141\u8bb8\u5e94\u7528\u643a\u5e26\u4e0d\u540c\u7c7b\u578b\u7684uri\u5230\u540e\u7aef\u8ba1\u7b97\u8282\u70b9\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:[(0,d.jsx)(n.code,{children:"proxyType"}),"\u53ef\u4ee5\u914d\u7f6e\u4e3a",(0,d.jsx)(n.code,{children:"relative"}),"\u6216\u8005",(0,d.jsx)(n.code,{children:"absolute"}),"\uff0c\u5982\u679c\u4e0d\u914d\u7f6e\u9ed8\u8ba4\u662f",(0,d.jsx)(n.code,{children:"relative"}),"\u3002"]}),"\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsxs)(n.li,{children:["\n",(0,d.jsxs)(n.p,{children:["\u5982\u679c\u8bbe\u7f6e\u6210",(0,d.jsx)(n.code,{children:"absolute"}),"\uff0c\u4f1a\u628a\u5b8c\u6574URL\u8bf7\u6c42\u8def\u5f84\u53cd\u5411\u4ee3\u7406\u5230\u7ed9\u5b9a\u7684\u4e3b\u673a\u548c\u7aef\u53e3\u3002\u6bd4\u5982\u8bbf\u95ee\u4ee5\u4e0b\u5730\u5740\uff1a"]}),"\n",(0,d.jsxs)(n.blockquote,{children:["\n",(0,d.jsx)(n.p,{children:(0,d.jsx)(n.a,{href:"https://hpc.pku.edu.cn/demo/scow/api/proxy/hpc01/absolute/192.168.220.133/7383/index.html",children:"https://hpc.pku.edu.cn/demo/scow/api/proxy/hpc01/absolute/192.168.220.133/7383/index.html"})}),"\n"]}),"\n",(0,d.jsxs)(n.p,{children:["\u4ee5\u4e0bURL\u8bf7\u6c42\u5c06\u4f1a\u88ab\u53d1\u9001\u7ed9\u8ba1\u7b97\u8282\u70b9",(0,d.jsx)(n.code,{children:"192.168.220.133"}),"\u7684",(0,d.jsx)(n.code,{children:"7383"}),"\u7aef\u53e3\u3002"]}),"\n",(0,d.jsxs)(n.blockquote,{children:["\n",(0,d.jsx)(n.p,{children:"/demo/scow/api/proxy/hpc01/absolute/192.168.220.133/7383/index.html"}),"\n"]}),"\n"]}),"\n",(0,d.jsxs)(n.li,{children:["\n",(0,d.jsxs)(n.p,{children:["\u5982\u679c\u8bbe\u7f6e\u6210",(0,d.jsx)(n.code,{children:"relative"}),"\uff0c\u53ea\u4f7f\u7528URL\u8bf7\u6c42\u8def\u5f84\u7684\u8def\u5f84\u90e8\u5206\u5c06\u8bf7\u6c42\u53cd\u5411\u4ee3\u7406\u5230\u7ed9\u5b9a\u7684\u4e3b\u673a\u548c\u7aef\u53e3\u3002\u6bd4\u5982\u8bbf\u95ee\u4ee5\u4e0b\u5730\u5740\uff1a"]}),"\n",(0,d.jsxs)(n.blockquote,{children:["\n",(0,d.jsx)(n.p,{children:(0,d.jsx)(n.a,{href:"https://hpc.pku.edu.cn/demo/scow/api/proxy/hpc01/relative/192.168.220.133/4253/index.html",children:"https://hpc.pku.edu.cn/demo/scow/api/proxy/hpc01/relative/192.168.220.133/4253/index.html"})}),"\n"]}),"\n",(0,d.jsxs)(n.p,{children:["\u4ee5\u4e0bURL\u8bf7\u6c42\u5c06\u4f1a\u88ab\u53d1\u9001\u7ed9\u8ba1\u7b97\u8282\u70b9",(0,d.jsx)(n.code,{children:"192.168.220.133"}),"\u7684",(0,d.jsx)(n.code,{children:"4253"}),"\u7aef\u53e3\u3002"]}),"\n",(0,d.jsxs)(n.blockquote,{children:["\n",(0,d.jsx)(n.p,{children:"/index.html"}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,d.jsxs)(n.h3,{id:"beforescript\u548cscript",children:[(0,d.jsx)(n.code,{children:"beforeScript"}),"\u548c",(0,d.jsx)(n.code,{children:"script"})]}),"\n",(0,d.jsxs)(n.p,{children:[(0,d.jsx)(n.code,{children:"beforeScript"}),"\u90e8\u5206\u4e3a\u51c6\u5907\u811a\u672c\u3002\u8fd9\u4e2a\u811a\u672c\u7528\u6765\u51c6\u5907\u8fd0\u884c\u4efb\u52a1\u7684\u73af\u5883\u3002\u8fd9\u4e2a\u811a\u672c\u8981\u6c42\u5fc5\u987bexport\u4e24\u4e2a\u53d8\u91cf\uff1a"]}),"\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsxs)(n.li,{children:[(0,d.jsx)(n.code,{children:"PORT"}),"\uff1a\u7a0b\u5e8f\u5c06\u4f1a\u8fd0\u884c\u5728\u7684\u7aef\u53e3"]}),"\n",(0,d.jsxs)(n.li,{children:[(0,d.jsx)(n.code,{children:"PASSWORD"}),": \u8fde\u63a5\u7a0b\u5e8f\u7528\u7684\u5bc6\u7801"]}),"\n"]}),"\n",(0,d.jsxs)(n.p,{children:[(0,d.jsx)(n.code,{children:"connect"}),"\u7684",(0,d.jsx)(n.code,{children:"formData"}),"\u9879\u9700\u8981\u4f7f\u7528\u7684\u53d8\u91cf\u4e5f\u9700\u8981\u5728\u6b64\u5904export\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:["\u51c6\u5907\u811a\u672c\u4e2d\u7684",(0,d.jsx)(n.code,{children:"export"}),"\u7684\u53d8\u91cf\u53ef\u4ee5\u5728",(0,d.jsx)(n.code,{children:"script"}),"\u4e2d\u4f7f\u7528\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:[(0,d.jsx)(n.code,{children:"script"}),"\u90e8\u5206\u4e3a\u5982\u4f55\u542f\u52a8\u8fd9\u4e2a\u5e94\u7528\u7684\u811a\u672c\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:[(0,d.jsx)(n.code,{children:"beforeScript"}),"\u548c",(0,d.jsx)(n.code,{children:"script"}),"\u4e2d\u53ef\u4ee5\u4f7f\u7528\u4ee5\u4e0b\u8f85\u52a9\u51fd\u6570\uff1a"]}),"\n",(0,d.jsxs)(n.table,{children:[(0,d.jsx)(n.thead,{children:(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.th,{children:"\u51fd\u6570\u540d"}),(0,d.jsx)(n.th,{children:"\u4f5c\u7528"}),(0,d.jsx)(n.th,{children:"\u53c2\u6570"}),(0,d.jsx)(n.th,{children:"\u8fd4\u56de\u503c"})]})}),(0,d.jsxs)(n.tbody,{children:[(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"get_port"})}),(0,d.jsx)(n.td,{children:"\u83b7\u5f97\u4e00\u4e2a\u53ef\u7528\u7684TCP\u7aef\u53e3"}),(0,d.jsx)(n.td,{children:"\u65e0"}),(0,d.jsx)(n.td,{children:"\u4e00\u4e2a\u8c03\u7528\u65f6\u53ef\u7528\u7684TCP\u7aef\u53e3"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"get_password"})}),(0,d.jsx)(n.td,{children:"\u751f\u6210\u4e00\u4e2a\u5305\u542bA-Za-z0-9\u7684\u968f\u673a\u5bc6\u7801"}),(0,d.jsxs)(n.td,{children:[(0,d.jsx)(n.code,{children:"$1"}),": \u5bc6\u7801\u957f\u5ea6"]}),(0,d.jsx)(n.td,{children:"\u5bc6\u7801"})]})]})]}),"\n",(0,d.jsxs)(n.p,{children:["\u8fd8\u53ef\u4ee5\u4f7f\u7528\u4ee5\u4e0b\u53d8\u91cf\u3002\u5982\u679c",(0,d.jsx)(n.a,{href:"/SCOW/pr-preview/pr-987/docs/deploy/config/portal/apps/configure-attributes",children:"\u81ea\u5b9a\u4e49\u5c5e\u6027"}),"\u4e2d\u51fa\u73b0\u4e86\u548c\u8fd9\u91cc\u540c\u540d\u7684\u53d8\u91cf\uff0c\u8fd9\u91cc\u7684\u53d8\u91cf\u5c06\u4f1a\u88ab\u8986\u76d6\u3002"]}),"\n",(0,d.jsxs)(n.table,{children:[(0,d.jsx)(n.thead,{children:(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.th,{children:"\u53d8\u91cf\u540d"}),(0,d.jsx)(n.th,{children:"\u503c"})]})}),(0,d.jsx)(n.tbody,{children:(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"PROXY_BASE_PATH"})}),(0,d.jsxs)(n.td,{children:["\u8fd9\u4e2a\u5e94\u7528\u5728\u88ab\u8bbf\u95ee\u65f6\uff0c\u5176URL\u4e2d\u4f4d\u4e8e",(0,d.jsx)(n.strong,{children:"\u8ba1\u7b97\u8282\u70b9IP"}),"\u4e4b\u524d\u7684\u5185\u5bb9\uff0c\u4e0d\u4ee5",(0,d.jsx)(n.code,{children:"/"}),"\u7ed3\u5c3e\u3002\u5bf9SCOW\u6765\u8bf4\uff0c\u4e3a",(0,d.jsx)(n.code,{children:"${SCOW\u7684base path}/api/proxy/${\u96c6\u7fa4ID}/${\u6b64\u5e94\u7528\u7684proxyType}"})]})]})})]}),"\n",(0,d.jsx)(n.p,{children:"\u8fd9\u4e9b\u811a\u672c\uff0c\u4ee5\u53ca\u4e00\u4e9b\u8f85\u52a9\u7684\u811a\u672c\u5c06\u4f1a\u88ab\u4f5c\u4e3a\u4e00\u4e2a\u4f5c\u4e1a\u63d0\u4ea4\u7ed9\u8c03\u5ea6\u7cfb\u7edf\uff0c\u5e76\u6700\u7ec8\u5728\u67d0\u4e2a\u8ba1\u7b97\u8282\u70b9\u4e0a\u8fd0\u884c\u3002"}),"\n",(0,d.jsx)(n.h3,{id:"connect",children:(0,d.jsx)(n.code,{children:"connect"})}),"\n",(0,d.jsxs)(n.p,{children:[(0,d.jsx)(n.code,{children:"connect"}),"\u90e8\u5206\u5b9a\u4e49\u5982\u4f55\u8fde\u63a5\u5230\u5e94\u7528\u3002\u7cfb\u7edf\u5c06\u4f1a\u7ed9\u53ef\u4ee5\u8fde\u63a5\u7684\u5e94\u7528\u521b\u5efa\u4e00\u4e2a\u7528\u4e8e\u8fde\u63a5\u5e94\u7528\u7684a\u6807\u7b7e\u3002\u70b9\u51fba\u6807\u7b7e\u4e4b\u540e\uff0c\u7cfb\u7edf\u5c06\u4f1a\u6253\u5f00\u4e00\u4e2a\u65b0\u6807\u7b7e\u9875\uff0c\u6253\u5f00\u65b0\u6807\u7b7e\u9875\u65f6\u5b9e\u9645\u8fdb\u884c\u7684\u52a8\u4f5c\u5c06\u53ef\u4ee5\u5728\u8fd9\u91cc\u81ea\u5b9a\u4e49\u3002"]}),"\n",(0,d.jsx)(n.p,{children:"\u914d\u7f6e\u5982\u4e0b\uff1a"}),"\n",(0,d.jsxs)(n.table,{children:[(0,d.jsx)(n.thead,{children:(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.th,{children:"\u5c5e\u6027"}),(0,d.jsx)(n.th,{children:"\u7c7b\u578b"}),(0,d.jsx)(n.th,{children:"\u662f\u5426\u5fc5\u586b"}),(0,d.jsx)(n.th,{children:"\u89e3\u91ca"})]})}),(0,d.jsxs)(n.tbody,{children:[(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"path"})}),(0,d.jsx)(n.td,{children:"\u5b57\u7b26\u4e32"}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u65b0\u6807\u7b7e\u9875\u6240\u8bbf\u95ee\u7684\u76f8\u5bf9\u8def\u5f84"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"method"})}),(0,d.jsx)(n.td,{children:'"GET" \u6216\u8005 "POST"'}),(0,d.jsx)(n.td,{children:"\u662f"}),(0,d.jsx)(n.td,{children:"\u53d1\u8d77\u4e00\u4e2a\u4ec0\u4e48\u7684HTTP\u8bf7\u6c42"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"query"})}),(0,d.jsx)(n.td,{children:"\u5b57\u7b26\u4e32\u5230\u5b57\u7b26\u4e32\u7684\u5b57\u5178"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsx)(n.td,{children:"\u8fde\u63a5\u65f6\u9644\u5e26\u7684query"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"formData"})}),(0,d.jsx)(n.td,{children:"\u5b57\u7b26\u4e32\u5230\u5b57\u7b26\u4e32\u7684\u5b57\u5178"}),(0,d.jsx)(n.td,{children:"\u5426"}),(0,d.jsxs)(n.td,{children:["\u5982\u679c",(0,d.jsx)(n.code,{children:"method"}),"\u662fPOST\uff0c\u8fd9\u4e2a\u8bf7\u6c42\u5c06\u4f1a\u5e26\u7684form data"]})]})]})]}),"\n",(0,d.jsxs)(n.p,{children:["\u6211\u4eec\u63a8\u8350\u5c06\u5e94\u7528\u4f7f\u7528\u5bc6\u7801\u65b9\u5f0f\u8fdb\u884c\u52a0\u5bc6\uff0c\u6240\u4ee5\u4e00\u822c\u5728\u8fde\u63a5\u65f6\u9700\u8981\u5c06\u5bc6\u7801\u8f93\u5165\u7ed9\u5e94\u7528\u3002",(0,d.jsx)(n.code,{children:"path"}),", ",(0,d.jsx)(n.code,{children:"query"}),"\u7684\u503c\u548c",(0,d.jsx)(n.code,{children:"formData"}),"\u7684\u503c\u90e8\u5206\u53ef\u4ee5\u4f7f\u7528",(0,d.jsx)(n.code,{children:"{{ PASSWORD }}"}),"\u4ee3\u66ff\u5e94\u7528\u5728\u521b\u5efa\u65f6\u751f\u6210\u7684\u5bc6\u7801\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:["\u6b64\u5916\uff0c\u5982\u679c",(0,d.jsx)(n.code,{children:"formData"}),"\u9700\u8981\u4f7f\u7528\u5176\u4ed6\u53d8\u91cf\uff0c\u53ef\u4ee5\u5728\u51c6\u5907\u811a\u672c",(0,d.jsx)(n.code,{children:"beforeScript"}),"\u4e2dexport\u9700\u8981\u7684\u53d8\u91cf\uff0c\u7136\u540e\u4ee5",(0,d.jsx)(n.code,{children:"{{ \u53d8\u91cf\u540d }}"}),"\u7684\u5f62\u5f0f\u4f7f\u7528\u3002"]}),"\n",(0,d.jsx)(n.h3,{id:"attributes",children:(0,d.jsx)(n.code,{children:"attributes"})}),"\n",(0,d.jsxs)(n.p,{children:["\u5982\u679c\u9700\u8981\u6307\u5b9a\u5e94\u7528\u7248\u672c\uff0c\u53ef\u4ee5\u901a\u8fc7",(0,d.jsx)(n.code,{children:"attributes"}),"\u914d\u7f6e\u9879\u6dfb\u52a0\u81ea\u5b9a\u4e49HTML\u8868\u5355\uff0c\u5177\u4f53\u914d\u7f6e\u793a\u4f8b\u8bf7\u53c2\u8003",(0,d.jsx)(n.a,{href:"/SCOW/pr-preview/pr-987/docs/deploy/config/portal/apps/configure-attributes",children:"attributes\u914d\u7f6e"}),"\u3002"]})]})}function p(e={}){const{wrapper:n}={...(0,r.a)(),...e.components};return n?(0,d.jsx)(n,{...e,children:(0,d.jsx)(h,{...e})}):h(e)}},57766:(e,n,c)=>{c.d(n,{Z:()=>t,a:()=>i});var d=c(70079);const r={},s=d.createContext(r);function i(e){const n=d.useContext(s);return d.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function t(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:i(e.components),d.createElement(s.Provider,{value:n},e.children)}}}]);