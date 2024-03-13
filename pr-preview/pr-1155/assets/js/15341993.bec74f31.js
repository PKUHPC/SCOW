"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[28],{61273:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>r,contentTitle:()=>i,default:()=>d,frontMatter:()=>t,metadata:()=>o,toc:()=>p});var c=s(35250),a=s(57766);const t={sidebar_position:1},i="Emacs",o={id:"deploy/config/portal/apps/apps/emacs/index",title:"Emacs",description:"\u8f6f\u4ef6\u7b80\u4ecb",source:"@site/docs/deploy/config/portal/apps/apps/emacs/index.md",sourceDirName:"deploy/config/portal/apps/apps/emacs",slug:"/deploy/config/portal/apps/apps/emacs/",permalink:"/SCOW/pr-preview/pr-1155/docs/deploy/config/portal/apps/apps/emacs/",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/portal/apps/apps/emacs/index.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"deploy",previous:{title:"Desktop",permalink:"/SCOW/pr-preview/pr-1155/docs/deploy/config/portal/apps/apps/desktop/"},next:{title:"IGV",permalink:"/SCOW/pr-preview/pr-1155/docs/deploy/config/portal/apps/apps/igv/"}},r={},p=[{value:"\u8f6f\u4ef6\u7b80\u4ecb",id:"\u8f6f\u4ef6\u7b80\u4ecb",level:2},{value:"\u524d\u63d0\u6761\u4ef6",id:"\u524d\u63d0\u6761\u4ef6",level:2},{value:"1\u3001TurboVNC\u5b89\u88c5",id:"1turbovnc\u5b89\u88c5",level:3},{value:"2\u3001Emacs\u5b89\u88c5",id:"2emacs\u5b89\u88c5",level:3},{value:"\u914d\u7f6e\u6587\u4ef6",id:"\u914d\u7f6e\u6587\u4ef6",level:2}];function l(e){const n={code:"code",h1:"h1",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",ul:"ul",...(0,a.a)(),...e.components};return(0,c.jsxs)(c.Fragment,{children:[(0,c.jsx)(n.h1,{id:"emacs",children:"Emacs"}),"\n",(0,c.jsx)(n.h2,{id:"\u8f6f\u4ef6\u7b80\u4ecb",children:"\u8f6f\u4ef6\u7b80\u4ecb"}),"\n",(0,c.jsx)(n.p,{children:"Emacs\u662f\u4e00\u4e2a\u975e\u5e38\u5f3a\u5927\u7684\u6587\u672c\u7f16\u8f91\u5668\u548c\u5f00\u53d1\u73af\u5883\uff0c\u5b83\u6709\u4e00\u4e2a\u5f3a\u5927\u7684\u547d\u4ee4\u884c\u754c\u9762\u548c\u4e00\u7cfb\u5217\u56fe\u5f62\u7528\u6237\u754c\u9762\uff0c\u5b83\u652f\u6301\u591a\u4e2a\u64cd\u4f5c\u7cfb\u7edf\uff0c\u5305\u62ecUnix\u3001Linux\u3001Windows\u548cmacOS\u3002"}),"\n",(0,c.jsx)(n.h2,{id:"\u524d\u63d0\u6761\u4ef6",children:"\u524d\u63d0\u6761\u4ef6"}),"\n",(0,c.jsx)(n.p,{children:"\u8bf7\u786e\u4fdd\u5728\u9700\u8981\u8fd0\u884c\u684c\u9762\u7c7b\u5e94\u7528\u7684\u673a\u5668\u4e0a\u5b89\u88c5\u6709\uff1a"}),"\n",(0,c.jsxs)(n.ul,{children:["\n",(0,c.jsxs)(n.li,{children:["\n",(0,c.jsx)(n.p,{children:"TurboVNC 3.0\u7248\u672c\u53ca\u4ee5\u4e0a"}),"\n"]}),"\n",(0,c.jsxs)(n.li,{children:["\n",(0,c.jsx)(n.p,{children:"\u60a8\u9700\u8981\u8fd0\u884c\u7684Emacs"}),"\n"]}),"\n"]}),"\n",(0,c.jsx)(n.h3,{id:"1turbovnc\u5b89\u88c5",children:"1\u3001TurboVNC\u5b89\u88c5"}),"\n",(0,c.jsx)(n.pre,{children:(0,c.jsx)(n.code,{className:"language-bash",children:"wget https://turbovnc.org/pmwiki/uploads/Downloads/TurboVNC.repo --no-check-certificate\nmv TurboVNC.repo /etc/yum.repos.d\n# \u5b89\u88c5\u6700\u65b0\u7248\u672c\nyum install turbovnc -y\n"})}),"\n",(0,c.jsx)(n.h3,{id:"2emacs\u5b89\u88c5",children:"2\u3001Emacs\u5b89\u88c5"}),"\n",(0,c.jsx)(n.pre,{children:(0,c.jsx)(n.code,{className:"language-bash",children:"yum install emacs -y\n"})}),"\n",(0,c.jsx)(n.p,{children:"\u4e0b\u9762\u8bb2\u89e3\u5982\u4f55\u914d\u7f6e\u4f7f\u7528Emacs\u3002"}),"\n",(0,c.jsx)(n.h2,{id:"\u914d\u7f6e\u6587\u4ef6",children:"\u914d\u7f6e\u6587\u4ef6"}),"\n",(0,c.jsxs)(n.p,{children:["\u521b\u5efa",(0,c.jsx)(n.code,{children:"config/apps"}),"\u76ee\u5f55\uff0c\u5728\u91cc\u9762\u521b\u5efa",(0,c.jsx)(n.code,{children:"emacs.yml"}),"\u6587\u4ef6\uff0c\u5176\u5185\u5bb9\u5982\u4e0b\uff1a"]}),"\n",(0,c.jsx)(n.pre,{children:(0,c.jsx)(n.code,{className:"language-yaml",metastring:'title="config/apps/emacs.yml"',children:'# \u8fd9\u4e2a\u5e94\u7528\u7684ID\nid: emacs\n\n# \u8fd9\u4e2a\u5e94\u7528\u7684\u540d\u5b57\nname: emacs\n\n# \u6307\u5b9a\u5e94\u7528\u7c7b\u578b\u4e3avnc\ntype: vnc\n\n# VNC\u5e94\u7528\u7684\u914d\u7f6e\nvnc:\n  # \u6b64X Session\u7684xstartup\u811a\u672c\n  xstartup: |\n    emacs -mm\n      \n# \u914d\u7f6eHTML\u8868\u5355   \nattributes:\n  - type: text\n    name: sbatchOptions\n    label: \u5176\u4ed6sbatch\u53c2\u6570\n    required: false\n    placeholder: "\u6bd4\u5982\uff1a--gpus gres:2 --time 10"\n'})})]})}function d(e={}){const{wrapper:n}={...(0,a.a)(),...e.components};return n?(0,c.jsx)(n,{...e,children:(0,c.jsx)(l,{...e})}):l(e)}},57766:(e,n,s)=>{s.d(n,{Z:()=>o,a:()=>i});var c=s(70079);const a={},t=c.createContext(a);function i(e){const n=c.useContext(t);return c.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(a):e.components||a:i(e.components),c.createElement(t.Provider,{value:n},e.children)}}}]);