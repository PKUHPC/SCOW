"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[506],{11314:(e,n,a)=>{a.r(n),a.d(n,{assets:()=>i,contentTitle:()=>p,default:()=>d,frontMatter:()=>s,metadata:()=>o,toc:()=>r});var t=a(49214),l=a(5409);const s={sidebar_position:1},p="Matlab",o={id:"deploy/config/portal/apps/apps/matlab/index",title:"Matlab",description:"\u8f6f\u4ef6\u7b80\u4ecb",source:"@site/docs/deploy/config/portal/apps/apps/matlab/index.md",sourceDirName:"deploy/config/portal/apps/apps/matlab",slug:"/deploy/config/portal/apps/apps/matlab/",permalink:"/SCOW/pr-preview/pr-1272/docs/deploy/config/portal/apps/apps/matlab/",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/portal/apps/apps/matlab/index.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"deploy",previous:{title:"JupyterLab",permalink:"/SCOW/pr-preview/pr-1272/docs/deploy/config/portal/apps/apps/jupyterlab/"},next:{title:"Octave",permalink:"/SCOW/pr-preview/pr-1272/docs/deploy/config/portal/apps/apps/octave/"}},i={},r=[{value:"\u8f6f\u4ef6\u7b80\u4ecb",id:"\u8f6f\u4ef6\u7b80\u4ecb",level:2},{value:"\u524d\u63d0\u6761\u4ef6",id:"\u524d\u63d0\u6761\u4ef6",level:2},{value:"\u914d\u7f6e\u6587\u4ef6",id:"\u914d\u7f6e\u6587\u4ef6",level:2}];function c(e){const n={code:"code",h1:"h1",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...(0,l.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:"matlab",children:"Matlab"}),"\n",(0,t.jsx)(n.h2,{id:"\u8f6f\u4ef6\u7b80\u4ecb",children:"\u8f6f\u4ef6\u7b80\u4ecb"}),"\n",(0,t.jsx)(n.p,{children:"MATLAB\u662f\u4e00\u79cd\u7531MathWorks\u516c\u53f8\u5f00\u53d1\u7684\u4e13\u4e1a\u6570\u5b66\u8f6f\u4ef6\uff0c\u5b83\u53ef\u4ee5\u7528\u4e8e\u6570\u503c\u8ba1\u7b97\u3001\u6570\u636e\u5206\u6790\u3001\u79d1\u5b66\u7ed8\u56fe\u3001\u673a\u5668\u5b66\u4e60\u3001\u4eba\u5de5\u667a\u80fd\u7b49\u9886\u57df\u3002MATLAB\u62e5\u6709\u5f3a\u5927\u7684\u77e9\u9635\u8fd0\u7b97\u548c\u5411\u91cf\u5316\u8ba1\u7b97\u80fd\u529b\uff0c\u652f\u6301\u591a\u79cd\u6570\u636e\u7c7b\u578b\u548c\u683c\u5f0f\u7684\u5904\u7406\u3002"}),"\n",(0,t.jsx)(n.h2,{id:"\u524d\u63d0\u6761\u4ef6",children:"\u524d\u63d0\u6761\u4ef6"}),"\n",(0,t.jsx)(n.p,{children:"\u8bf7\u786e\u4fdd\u5728\u9700\u8981\u8fd0\u884c\u684c\u9762\u7c7b\u5e94\u7528\u7684\u673a\u5668\u4e0a\u5b89\u88c5\u6709\uff1a"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:["\n",(0,t.jsx)(n.p,{children:"TurboVNC 3.0\u7248\u672c\u53ca\u4ee5\u4e0a"}),"\n"]}),"\n",(0,t.jsxs)(n.li,{children:["\n",(0,t.jsx)(n.p,{children:"\u60a8\u9700\u8981\u8fd0\u884c\u7684Matlab"}),"\n"]}),"\n"]}),"\n",(0,t.jsx)(n.p,{children:"\u4e0b\u9762\u8bb2\u89e3\u5982\u4f55\u914d\u7f6e\u4f7f\u7528Matlab\u3002"}),"\n",(0,t.jsx)(n.h2,{id:"\u914d\u7f6e\u6587\u4ef6",children:"\u914d\u7f6e\u6587\u4ef6"}),"\n",(0,t.jsxs)(n.p,{children:["\u521b\u5efa",(0,t.jsx)(n.code,{children:"config/apps"}),"\u76ee\u5f55\uff0c\u5728\u91cc\u9762\u521b\u5efa",(0,t.jsx)(n.code,{children:"matlab.yml"}),"\u6587\u4ef6\uff0c\u5176\u5185\u5bb9\u5982\u4e0b\uff1a"]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-yaml",metastring:'title="config/apps/matlab.yml"',children:'# \u8fd9\u4e2a\u5e94\u7528\u7684ID\nid: matlab\n\n# \u8fd9\u4e2a\u5e94\u7528\u7684\u540d\u5b57\nname: matlab\n\n# \u6307\u5b9a\u5e94\u7528\u7c7b\u578b\u4e3avnc\ntype: vnc\n\n# VNC\u5e94\u7528\u7684\u914d\u7f6e\nvnc:\n  # \u6b64X Session\u7684xstartup\u811a\u672c\n  xstartup: |\n    module load matlab/$matlab_path\n    matlab -desktop\n      \n# \u914d\u7f6eHTML\u8868\u5355\nattributes:\n  - type: select\n    name: matlab_path\n    label: \u9009\u62e9\u7248\u672c\n    select:\n      - value: R2019b\n        label: R2019b\n      - value: R2021a\n        label: R2021a\n      - value: R2021b\n        label: R2021b\n      - value: R2022b\n        label: R2022b\n  - type: text\n    name: sbatchOptions\n    label: \u5176\u4ed6sbatch\u53c2\u6570\n    required: false\n    placeholder: "\u6bd4\u5982\uff1a--gpus gres:2 --time 10"\n'})})]})}function d(e={}){const{wrapper:n}={...(0,l.R)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(c,{...e})}):c(e)}},5409:(e,n,a)=>{a.d(n,{R:()=>p,x:()=>o});var t=a(48318);const l={},s=t.createContext(l);function p(e){const n=t.useContext(s);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(l):e.components||l:p(e.components),t.createElement(s.Provider,{value:n},e.children)}}}]);