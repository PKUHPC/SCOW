"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[2455],{78933:(e,n,r)=>{r.r(n),r.d(n,{assets:()=>t,contentTitle:()=>s,default:()=>h,frontMatter:()=>i,metadata:()=>o,toc:()=>l});var d=r(49214),c=r(5409);const i={sidebar_position:2,title:"\u914d\u7f6eWeb\u7c7b\u5e94\u7528"},s="\u914d\u7f6eWeb\u7c7b\u5e94\u7528",o={id:"deploy/config/ai/apps/configure-web-app",title:"\u914d\u7f6eWeb\u7c7b\u5e94\u7528",description:"\u524d\u63d0\u6761\u4ef6",source:"@site/docs/deploy/config/ai/apps/configure-web-app.md",sourceDirName:"deploy/config/ai/apps",slug:"/deploy/config/ai/apps/configure-web-app",permalink:"/SCOW/pr-preview/pr-1388/docs/deploy/config/ai/apps/configure-web-app",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/ai/apps/configure-web-app.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2,title:"\u914d\u7f6eWeb\u7c7b\u5e94\u7528"},sidebar:"deploy",previous:{title:"\u4ea4\u4e92\u5f0f\u4f5c\u4e1a",permalink:"/SCOW/pr-preview/pr-1388/docs/deploy/config/ai/apps/intro"},next:{title:"\u914d\u7f6e\u684c\u9762\u7c7b\u5e94\u7528",permalink:"/SCOW/pr-preview/pr-1388/docs/deploy/config/ai/apps/configure-vnc-app"}},t={},l=[{value:"\u524d\u63d0\u6761\u4ef6",id:"\u524d\u63d0\u6761\u4ef6",level:2},{value:"\u914d\u7f6e\u793a\u4f8b",id:"\u914d\u7f6e\u793a\u4f8b",level:2},{value:"\u914d\u7f6e\u89e3\u91ca",id:"\u914d\u7f6e\u89e3\u91ca",level:2},{value:"<code>proxyType</code>",id:"proxytype",level:3},{value:"<code>image</code>",id:"image",level:3},{value:"<code>logoPath</code>",id:"logopath",level:3},{value:"<code>appComment</code>",id:"appcomment",level:3},{value:"<code>beforeScript</code>\uff0c<code>startCommand</code> \u548c<code>script</code>",id:"beforescriptstartcommand-\u548cscript",level:3},{value:"<code>attributes</code>",id:"attributes",level:3}];function p(e){const n={a:"a",code:"code",h1:"h1",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,c.R)(),...e.components};return(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)(n.h1,{id:"\u914d\u7f6eweb\u7c7b\u5e94\u7528",children:"\u914d\u7f6eWeb\u7c7b\u5e94\u7528"}),"\n",(0,d.jsx)(n.h2,{id:"\u524d\u63d0\u6761\u4ef6",children:"\u524d\u63d0\u6761\u4ef6"}),"\n",(0,d.jsx)(n.p,{children:"\u8bf7\u786e\u4fdd\u8ba1\u7b97\u8282\u70b9\u53ef\u4ee5\u62c9\u53d6\u6216\u8005\u5df2\u7ecf\u5b58\u5728\u914d\u7f6e\u4e2d\u5e94\u7528\u7684\u955c\u50cf\u3002"}),"\n",(0,d.jsx)(n.h2,{id:"\u914d\u7f6e\u793a\u4f8b",children:"\u914d\u7f6e\u793a\u4f8b"}),"\n",(0,d.jsxs)(n.p,{children:["\u4e0b\u9762\u4ee5\u4f7f\u7528",(0,d.jsx)(n.a,{href:"https://github.com/coder/code-server",children:"coder/code-server"}),"\u542f\u52a8VSCode\u7684\u914d\u7f6e\u4e3a\u4f8b\u6765\u8bb2\u89e3\u5982\u4f55\u914d\u7f6e\u4e00\u4e2a\u670d\u52a1\u5668\u7c7b\u5e94\u7528\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:["\u521b\u5efa",(0,d.jsx)(n.code,{children:"config/ai/apps"}),"\u76ee\u5f55\uff0c\u5728\u91cc\u9762\u521b\u5efa",(0,d.jsx)(n.code,{children:"vscode/config.yml"}),"\u6216",(0,d.jsx)(n.code,{children:"vscode.yml"}),"\u6587\u4ef6\uff0c\u5176\u5185\u5bb9\u5982\u4e0b\uff1a"]}),"\n",(0,d.jsx)(n.pre,{children:(0,d.jsx)(n.code,{className:"language-yaml",metastring:'title="config/ai/apps/vscode/config.yml"',children:'# \u8fd9\u4e2a\u5e94\u7528\u7684ID\nid: vscode\n\n# \u8fd9\u4e2a\u5e94\u7528\u7684\u540d\u5b57\nname: VSCode\n\n# \u6307\u5b9a\u5e94\u7528\u7c7b\u578b\u4e3aweb\ntype: web\n\nimage:\n  # \u955c\u50cf\u540d\u79f0\n  name: codercom/code-server\n  # \u955c\u50cf\u7248\u672c\n  tag: 4.20.0\n\n# Web\u5e94\u7528\u7684\u914d\u7f6e\nweb:\n\n  # \u6307\u5b9a\u53cd\u5411\u4ee3\u7406\u7c7b\u578b\n  proxyType: relative\n\n  # \u51c6\u5907\u811a\u672c\n  beforeScript: |\n    export PASSWORD=$(get_password 12)\n\n # \u6307\u660e\u8fd0\u884c\u4efb\u52a1\u7684\u811a\u672c\u4e2d\u7684\u542f\u52a8\u547d\u4ee4\uff0c\u7528\u6237\u5728\u521b\u5efa\u5e94\u7528\u9875\u9762\u53ef\u4ee5\u5728\u811a\u672c\u4e2d\u66ff\u6362\u8be5\u547d\u4ee4\n  startCommand:\n    code-server\n  # \u8fd0\u884c\u4efb\u52a1\u7684\u811a\u672c\u3002\u53ef\u4ee5\u4f7f\u7528\u51c6\u5907\u811a\u672c\u5b9a\u4e49\u7684\u53d8\u91cf\n  script: |\n    PASSWORD=$PASSWORD code-server -vvv --bind-addr 0.0.0.0:$PORT --auth password\n\n  # \u5982\u4f55\u8fde\u63a5\u5e94\u7528\n  connect:\n    method: POST\n    path: /login\n    formData:\n      password: "{{ PASSWORD }}"\n\n'})}),"\n",(0,d.jsx)(n.p,{children:"\u589e\u52a0\u4e86\u6b64\u6587\u4ef6\u540e\uff0c\u5237\u65b0\u5373\u53ef\u3002"}),"\n",(0,d.jsx)(n.h2,{id:"\u914d\u7f6e\u89e3\u91ca",children:"\u914d\u7f6e\u89e3\u91ca"}),"\n",(0,d.jsx)(n.h3,{id:"proxytype",children:(0,d.jsx)(n.code,{children:"proxyType"})}),"\n",(0,d.jsx)(n.p,{children:(0,d.jsx)(n.a,{href:"/SCOW/pr-preview/pr-1388/docs/deploy/config/portal/apps/configure-web-app#proxytype",children:"\u53c2\u8003\u95e8\u6237\u7cfb\u7edf"})}),"\n",(0,d.jsx)(n.h3,{id:"image",children:(0,d.jsx)(n.code,{children:"image"})}),"\n",(0,d.jsxs)(n.p,{children:["\u8be5\u955c\u50cf\u5c06\u4f1a\u88ab\u7528\u6765\u542f\u52a8\u5e94\u7528\u3002",(0,d.jsx)(n.code,{children:"name"}),"\u548c",(0,d.jsx)(n.code,{children:"tag"}),"\u5206\u522b\u6307\u5b9a\u955c\u50cf\u7684\u540d\u79f0\u548c\u7248\u672c\u3002\u5982\u679c\u672c\u5730\u6ca1\u6709\u8be5\u955c\u50cf\uff0c\u5c06\u4f1a\u5c1d\u8bd5\u4ece\u955c\u50cf\u4ed3\u5e93\u62c9\u53d6\u3002"]}),"\n",(0,d.jsx)(n.h3,{id:"logopath",children:(0,d.jsx)(n.code,{children:"logoPath"})}),"\n",(0,d.jsx)(n.p,{children:(0,d.jsx)(n.a,{href:"/SCOW/pr-preview/pr-1388/docs/deploy/config/portal/apps/configure-app-logo",children:"\u53c2\u8003\u95e8\u6237\u7cfb\u7edf"})}),"\n",(0,d.jsx)(n.h3,{id:"appcomment",children:(0,d.jsx)(n.code,{children:"appComment"})}),"\n",(0,d.jsx)(n.p,{children:(0,d.jsx)(n.a,{href:"/SCOW/pr-preview/pr-1388/docs/deploy/config/portal/apps/configure-app-comment",children:"\u53c2\u8003\u95e8\u6237\u7cfb\u7edf"})}),"\n",(0,d.jsxs)(n.h3,{id:"beforescriptstartcommand-\u548cscript",children:[(0,d.jsx)(n.code,{children:"beforeScript"}),"\uff0c",(0,d.jsx)(n.code,{children:"startCommand"})," \u548c",(0,d.jsx)(n.code,{children:"script"})]}),"\n",(0,d.jsxs)(n.p,{children:[(0,d.jsx)(n.code,{children:"beforeScript"}),"\u90e8\u5206\u4e3a\u51c6\u5907\u811a\u672c\u3002\u8fd9\u4e2a\u811a\u672c\u7528\u6765\u51c6\u5907\u8fd0\u884c\u4efb\u52a1\u7684\u73af\u5883\u3002\u8fd9\u4e2a\u811a\u672c\u8981\u6c42\u5fc5\u987bexport\u4e00\u4e2a\u53d8\u91cf\uff1a"]}),"\n",(0,d.jsxs)(n.ul,{children:["\n",(0,d.jsxs)(n.li,{children:[(0,d.jsx)(n.code,{children:"PASSWORD"}),": \u8fde\u63a5\u7a0b\u5e8f\u7528\u7684\u5bc6\u7801"]}),"\n"]}),"\n",(0,d.jsxs)(n.p,{children:[(0,d.jsx)(n.code,{children:"connect"}),"\u7684",(0,d.jsx)(n.code,{children:"formData"}),"\u9879\u9700\u8981\u4f7f\u7528\u7684\u53d8\u91cf\u4e5f\u9700\u8981\u5728\u6b64\u5904export\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:["\u51c6\u5907\u811a\u672c\u4e2d\u7684",(0,d.jsx)(n.code,{children:"export"}),"\u7684\u53d8\u91cf\u53ef\u4ee5\u5728",(0,d.jsx)(n.code,{children:"script"}),"\u4e2d\u4f7f\u7528\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:[(0,d.jsx)(n.code,{children:"script"}),"\u90e8\u5206\u4e3a\u5982\u4f55\u542f\u52a8\u8fd9\u4e2a\u5e94\u7528\u7684\u811a\u672c\u3002"]}),"\n",(0,d.jsxs)(n.p,{children:[(0,d.jsx)(n.code,{children:"startCommand"})," \u9700\u8981\u6307\u660e",(0,d.jsx)(n.code,{children:"scipt"}),"\u4e2d\u542f\u52a8\u5e94\u7528\u7684\u547d\u4ee4\uff0c\u53ef\u4f9b\u7528\u6237\u5728\u4f7f\u7528\u81ea\u5b9a\u4e49\u955c\u50cf\u65f6\u6307\u5b9a\u542f\u52a8\u7684\u547d\u4ee4\uff0c\u5728\u9ed8\u8ba4\u60c5\u51b5\u4e0b\u4e3a",(0,d.jsx)(n.code,{children:"code-server"})]}),"\n",(0,d.jsxs)(n.p,{children:[(0,d.jsx)(n.code,{children:"beforeScript"}),"\u548c",(0,d.jsx)(n.code,{children:"script"}),"\u4e2d\u53ef\u4ee5\u4f7f\u7528\u4ee5\u4e0b\u8f85\u52a9\u51fd\u6570\uff1a"]}),"\n",(0,d.jsxs)(n.table,{children:[(0,d.jsx)(n.thead,{children:(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.th,{children:"\u51fd\u6570\u540d"}),(0,d.jsx)(n.th,{children:"\u4f5c\u7528"}),(0,d.jsx)(n.th,{children:"\u53c2\u6570"}),(0,d.jsx)(n.th,{children:"\u8fd4\u56de\u503c"})]})}),(0,d.jsx)(n.tbody,{children:(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"get_password"})}),(0,d.jsx)(n.td,{children:"\u751f\u6210\u4e00\u4e2a\u5305\u542bA-Za-z0-9\u7684\u968f\u673a\u5bc6\u7801"}),(0,d.jsxs)(n.td,{children:[(0,d.jsx)(n.code,{children:"$1"}),": \u5bc6\u7801\u957f\u5ea6"]}),(0,d.jsx)(n.td,{children:"\u5bc6\u7801"})]})})]}),"\n",(0,d.jsx)(n.p,{children:"\u8fd8\u53ef\u4ee5\u4f7f\u7528\u4ee5\u4e0b\u53d8\u91cf\u3002"}),"\n",(0,d.jsxs)(n.table,{children:[(0,d.jsx)(n.thead,{children:(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.th,{children:"\u53d8\u91cf\u540d"}),(0,d.jsx)(n.th,{children:"\u503c"})]})}),(0,d.jsxs)(n.tbody,{children:[(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"PROXY_BASE_PATH"})}),(0,d.jsxs)(n.td,{children:["\u8fd9\u4e2a\u5e94\u7528\u5728\u88ab\u8bbf\u95ee\u65f6\uff0c\u5176URL\u4e2d\u4f4d\u4e8e",(0,d.jsx)(n.strong,{children:"\u8ba1\u7b97\u8282\u70b9IP"}),"\u4e4b\u524d\u7684\u5185\u5bb9\uff0c\u4e0d\u4ee5",(0,d.jsx)(n.code,{children:"/"}),"\u7ed3\u5c3e\u3002\u5bf9SCOW AI\u6765\u8bf4\uff0c\u4e3a",(0,d.jsx)(n.code,{children:"${SCOW AI\u7684base path}/api/proxy/${\u96c6\u7fa4ID}/${\u6b64\u5e94\u7528\u7684proxyType}"}),"\uff0c \u5982\u679c",(0,d.jsx)(n.a,{href:"/SCOW/pr-preview/pr-1388/docs/deploy/config/portal/apps/configure-attributes",children:"\u81ea\u5b9a\u4e49\u5c5e\u6027"}),"\u4e2d\u51fa\u73b0\u4e86\u540c\u540d\u7684\u53d8\u91cf\uff0c\u8be5\u503c\u5c06\u4f1a\u88ab\u8986\u76d6\u3002"]})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"PORT"})}),(0,d.jsx)(n.td,{children:"\u8fd9\u4e2a\u5e94\u7528\u542f\u52a8\u65f6\u5bb9\u5668\u5185\u7684\u7aef\u53e3"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"HOST"})}),(0,d.jsx)(n.td,{children:"\u8fd9\u4e2a\u5e94\u7528\u542f\u52a8\u65f6\u5bb9\u5668\u6620\u5c04\u7684\u4e3b\u673a\u540d"})]}),(0,d.jsxs)(n.tr,{children:[(0,d.jsx)(n.td,{children:(0,d.jsx)(n.code,{children:"SVCPORT"})}),(0,d.jsxs)(n.td,{children:["\u8fd9\u4e2a\u5e94\u7528\u542f\u52a8\u540e\uff0cSCOW AI \u8282\u70b9\u53ef\u901a\u8fc7",(0,d.jsx)(n.code,{children:"HOST"}),":",(0,d.jsx)(n.code,{children:"SVCPORT"}),"\u8bbf\u95ee\u8be5\u5e94\u7528"]})]})]})]}),"\n",(0,d.jsx)(n.p,{children:"\u8fd9\u4e9b\u811a\u672c\u4f1a\u88ab\u63d0\u4ea4\u7ed9\u8c03\u5ea6\u7cfb\u7edf\uff0c\u5e76\u6700\u7ec8\u8fd0\u884c\u540e\u5728\u8ba1\u7b97\u8282\u70b9\u4e0a\u542f\u52a8\u5e94\u7528\u3002"}),"\n",(0,d.jsx)(n.h3,{id:"attributes",children:(0,d.jsx)(n.code,{children:"attributes"})}),"\n",(0,d.jsx)(n.p,{children:(0,d.jsx)(n.a,{href:"/SCOW/pr-preview/pr-1388/docs/deploy/config/portal/apps/configure-attributes",children:"\u53c2\u8003\u95e8\u6237\u7cfb\u7edf"})})]})}function h(e={}){const{wrapper:n}={...(0,c.R)(),...e.components};return n?(0,d.jsx)(n,{...e,children:(0,d.jsx)(p,{...e})}):p(e)}},5409:(e,n,r)=>{r.d(n,{R:()=>s,x:()=>o});var d=r(48318);const c={},i=d.createContext(c);function s(e){const n=d.useContext(i);return d.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(c):e.components||c:s(e.components),d.createElement(i.Provider,{value:n},e.children)}}}]);