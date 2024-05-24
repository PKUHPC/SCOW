"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[2334],{38323:(e,n,r)=>{r.r(n),r.d(n,{assets:()=>p,contentTitle:()=>c,default:()=>d,frontMatter:()=>s,metadata:()=>o,toc:()=>l});var t=r(49214),i=r(5409);const s={sidebar_position:3,title:"\u914d\u7f6e\u684c\u9762\u7c7b\u5e94\u7528"},c="\u914d\u7f6e\u684c\u9762\u7c7b\u5e94\u7528",o={id:"deploy/config/portal/apps/configure-vnc-app",title:"\u914d\u7f6e\u684c\u9762\u7c7b\u5e94\u7528",description:"\u524d\u63d0\u6761\u4ef6",source:"@site/docs/deploy/config/portal/apps/configure-vnc-app.md",sourceDirName:"deploy/config/portal/apps",slug:"/deploy/config/portal/apps/configure-vnc-app",permalink:"/SCOW/pr-preview/pr-1264/docs/deploy/config/portal/apps/configure-vnc-app",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/portal/apps/configure-vnc-app.md",tags:[],version:"current",sidebarPosition:3,frontMatter:{sidebar_position:3,title:"\u914d\u7f6e\u684c\u9762\u7c7b\u5e94\u7528"},sidebar:"deploy",previous:{title:"\u914d\u7f6eWeb\u7c7b\u5e94\u7528",permalink:"/SCOW/pr-preview/pr-1264/docs/deploy/config/portal/apps/configure-web-app"},next:{title:"\u5e94\u7528\u914d\u7f6e\u793a\u4f8b",permalink:"/SCOW/pr-preview/pr-1264/docs/category/\u5e94\u7528\u914d\u7f6e\u793a\u4f8b"}},p={},l=[{value:"\u524d\u63d0\u6761\u4ef6",id:"\u524d\u63d0\u6761\u4ef6",level:2},{value:"\u914d\u7f6e\u793a\u4f8b",id:"\u914d\u7f6e\u793a\u4f8b",level:2},{value:"\u914d\u7f6e\u89e3\u91ca",id:"\u914d\u7f6e\u89e3\u91ca",level:2},{value:"beforeScript",id:"beforescript",level:3},{value:"xstartup",id:"xstartup",level:3},{value:"<code>attributes</code>",id:"attributes",level:3}];function a(e){const n={a:"a",code:"code",h1:"h1",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",ul:"ul",...(0,i.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:"\u914d\u7f6e\u684c\u9762\u7c7b\u5e94\u7528",children:"\u914d\u7f6e\u684c\u9762\u7c7b\u5e94\u7528"}),"\n",(0,t.jsx)(n.h2,{id:"\u524d\u63d0\u6761\u4ef6",children:"\u524d\u63d0\u6761\u4ef6"}),"\n",(0,t.jsx)(n.p,{children:"\u8bf7\u786e\u4fdd\u5728\u9700\u8981\u8fd0\u884c\u684c\u9762\u7c7b\u5e94\u7528\u7684\u673a\u5668\u4e0a\u5b89\u88c5\u6709\uff1a"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.a,{href:"https://turbovnc.org/",children:"TurboVNC"})," 3.0\u7248\u672c\u53ca\u4ee5\u4e0a"]}),"\n",(0,t.jsx)(n.li,{children:"\u60a8\u9700\u8981\u8fd0\u884c\u7684\u684c\u9762\u7c7b\u5e94\u7528"}),"\n"]}),"\n",(0,t.jsx)(n.h2,{id:"\u914d\u7f6e\u793a\u4f8b",children:"\u914d\u7f6e\u793a\u4f8b"}),"\n",(0,t.jsx)(n.p,{children:"\u4e0b\u9762\u4ee5\u4f7f\u7528emacs\u4e3a\u793a\u4f8b\u4ecb\u7ecd\u5982\u4f55\u914d\u7f6e\u684c\u9762\u7c7b\u5e94\u7528\u3002"}),"\n",(0,t.jsxs)(n.p,{children:["\u521b\u5efa",(0,t.jsx)(n.code,{children:"config/apps"}),"\u76ee\u5f55\uff0c\u5728\u91cc\u9762\u521b\u5efa",(0,t.jsx)(n.code,{children:"emacs/config.yml"}),"\u6216\u8005",(0,t.jsx)(n.code,{children:"emacs.yml"}),"\u6587\u4ef6\uff0c\u5176\u5185\u5bb9\u5982\u4e0b\uff1a"]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-yaml",metastring:'title="config/apps/emacs/config.yml"',children:"# \u8fd9\u4e2a\u5e94\u7528\u7684ID\nid: emacs\n\n# \u8fd9\u4e2a\u5e94\u7528\u7684\u540d\u5b57\nname: emacs\n\n# \u6307\u5b9a\u5e94\u7528\u7c7b\u578b\u4e3avnc\ntype: vnc\n\n# VNC\u5e94\u7528\u7684\u914d\u7f6e\nvnc: \n\n  # \u53ef\u4ee5\u4f7f\u7528\u51c6\u5907\u811a\u672c\u6765\u51c6\u5907\u8fd0\u884c\u4efb\u52a1\u7684\u73af\u5883\n  # beforeScript:\n  #   export VERSION=1.0\n  \n  # \u6b64X Session\u7684xstartup\u811a\u672c\n  xstartup: |\n    emacs -mm\n\n"})}),"\n",(0,t.jsx)(n.p,{children:"\u589e\u52a0\u4e86\u6b64\u6587\u4ef6\u540e\uff0c\u5237\u65b0\u5373\u53ef\u3002"}),"\n",(0,t.jsx)(n.h2,{id:"\u914d\u7f6e\u89e3\u91ca",children:"\u914d\u7f6e\u89e3\u91ca"}),"\n",(0,t.jsx)(n.h3,{id:"beforescript",children:"beforeScript"}),"\n",(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:"beforeScript"}),"\u4e3a\u51c6\u5907\u811a\u672c,\u5982\u679c\u6709\u9700\u8981\u4f7f\u7528\u7684\u53d8\u91cf\uff0c\u53ef\u4ee5\u9009\u62e9\u4f7f\u7528\u8fd9\u4e2a\u811a\u672c\u7528\u6765\u51c6\u5907\u8fd0\u884c\u4efb\u52a1\u7684\u73af\u5883\u3002"]}),"\n",(0,t.jsx)(n.h3,{id:"xstartup",children:"xstartup"}),"\n",(0,t.jsxs)(n.p,{children:["\u5bf9\u4e8e\u684c\u9762\u7c7b\u5e94\u7528\uff0c\u7cfb\u7edf\u63d0\u4ea4\u4e00\u4e2a\u8ba1\u7b97\u4efb\u52a1\u3002\u6b64\u4efb\u52a1\u5c06\u4f1a\u5728\u8ba1\u7b97\u8282\u70b9\u4e0a\u542f\u52a8\u4e00\u4e2aTurboVNC\u5b9e\u4f8b\uff0c\u6b64TurboVNC\u5b9e\u4f8b\u5c06\u4f1a\u4ee5\u914d\u7f6e\u4e2d\u7684",(0,t.jsx)(n.code,{children:"xstartup"}),"\u811a\u672c\u4f5c\u4e3a\u5176\u542f\u52a8\u811a\u672c\u3002"]}),"\n",(0,t.jsx)(n.p,{children:"\u6240\u4ee5\u5bf9\u4e8e\u684c\u9762\u7c7b\u5e94\u7528\u800c\u8a00\uff0c\u60a8\u53ea\u9700\u8981\u586b\u5199\u6b63\u786e\u7684xstartup\u811a\u672c\u5373\u53ef\u3002"}),"\n",(0,t.jsx)(n.h3,{id:"attributes",children:(0,t.jsx)(n.code,{children:"attributes"})}),"\n",(0,t.jsxs)(n.p,{children:["\u5982\u679c\u9700\u8981\u6307\u5b9a\u5e94\u7528\u7248\u672c\uff0c\u53ef\u4ee5\u901a\u8fc7",(0,t.jsx)(n.code,{children:"attributes"}),"\u914d\u7f6e\u9879\u6dfb\u52a0\u81ea\u5b9a\u4e49HTML\u8868\u5355\uff0c\u5177\u4f53\u914d\u7f6e\u793a\u4f8b\u8bf7\u53c2\u8003",(0,t.jsx)(n.a,{href:"/SCOW/pr-preview/pr-1264/docs/deploy/config/portal/apps/configure-attributes",children:"attributes\u914d\u7f6e"}),"\u3002"]})]})}function d(e={}){const{wrapper:n}={...(0,i.R)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(a,{...e})}):a(e)}},5409:(e,n,r)=>{r.d(n,{R:()=>c,x:()=>o});var t=r(48318);const i={},s=t.createContext(i);function c(e){const n=t.useContext(s);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:c(e.components),t.createElement(s.Provider,{value:n},e.children)}}}]);