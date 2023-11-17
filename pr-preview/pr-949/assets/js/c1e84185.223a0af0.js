"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[6728],{15540:(e,n,r)=>{r.r(n),r.d(n,{assets:()=>p,contentTitle:()=>s,default:()=>d,frontMatter:()=>l,metadata:()=>t,toc:()=>c});var o=r(35250),i=r(57766);const l={sidebar_position:1},s="Relion",t={id:"deploy/config/portal/apps/apps/relion/index",title:"Relion",description:"\u8f6f\u4ef6\u7b80\u4ecb",source:"@site/docs/deploy/config/portal/apps/apps/relion/index.md",sourceDirName:"deploy/config/portal/apps/apps/relion",slug:"/deploy/config/portal/apps/apps/relion/",permalink:"/SCOW/pr-preview/pr-949/docs/deploy/config/portal/apps/apps/relion/",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/portal/apps/apps/relion/index.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"deploy",previous:{title:"Octave",permalink:"/SCOW/pr-preview/pr-949/docs/deploy/config/portal/apps/apps/octave/"},next:{title:"RStudio",permalink:"/SCOW/pr-preview/pr-949/docs/deploy/config/portal/apps/apps/rstudio/"}},p={},c=[{value:"\u8f6f\u4ef6\u7b80\u4ecb",id:"\u8f6f\u4ef6\u7b80\u4ecb",level:2},{value:"\u524d\u63d0\u6761\u4ef6",id:"\u524d\u63d0\u6761\u4ef6",level:2},{value:"\u914d\u7f6e\u6587\u4ef6",id:"\u914d\u7f6e\u6587\u4ef6",level:2}];function a(e){const n={code:"code",h1:"h1",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...(0,i.a)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(n.h1,{id:"relion",children:"Relion"}),"\n",(0,o.jsx)(n.h2,{id:"\u8f6f\u4ef6\u7b80\u4ecb",children:"\u8f6f\u4ef6\u7b80\u4ecb"}),"\n",(0,o.jsx)(n.p,{children:"RELION\uff08Reconstruction of 3D structures of Large macromolecular complexes using Image-based ONline reconstruction\uff09\u662f\u4e00\u79cd\u7528\u4e8e\u5904\u7406\u5355\u7c92\u5b50\u51b7\u51bb\u7535\u955c\uff08Single Particle Cryo-EM\uff09\u56fe\u50cf\u6570\u636e\u7684\u8f6f\u4ef6\u5305\u3002"}),"\n",(0,o.jsx)(n.h2,{id:"\u524d\u63d0\u6761\u4ef6",children:"\u524d\u63d0\u6761\u4ef6"}),"\n",(0,o.jsx)(n.p,{children:"\u8bf7\u786e\u4fdd\u5728\u9700\u8981\u8fd0\u884c\u684c\u9762\u7c7b\u5e94\u7528\u7684\u673a\u5668\u4e0a\u5b89\u88c5\u6709\uff1a"}),"\n",(0,o.jsxs)(n.ul,{children:["\n",(0,o.jsxs)(n.li,{children:["\n",(0,o.jsx)(n.p,{children:"TurboVNC 3.0\u7248\u672c\u53ca\u4ee5\u4e0a"}),"\n"]}),"\n",(0,o.jsxs)(n.li,{children:["\n",(0,o.jsx)(n.p,{children:"\u60a8\u9700\u8981\u8fd0\u884c\u7684Relion"}),"\n"]}),"\n"]}),"\n",(0,o.jsx)(n.p,{children:"\u4e0b\u9762\u8bb2\u89e3\u5982\u4f55\u914d\u7f6e\u4f7f\u7528Relion\u3002"}),"\n",(0,o.jsx)(n.h2,{id:"\u914d\u7f6e\u6587\u4ef6",children:"\u914d\u7f6e\u6587\u4ef6"}),"\n",(0,o.jsxs)(n.p,{children:["\u521b\u5efa",(0,o.jsx)(n.code,{children:"config/apps"}),"\u76ee\u5f55\uff0c\u5728\u91cc\u9762\u521b\u5efa",(0,o.jsx)(n.code,{children:"relion.yml"}),"\u6587\u4ef6\uff0c\u5176\u5185\u5bb9\u5982\u4e0b\uff1a"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-yaml",metastring:'title="config/apps/relion.yml"',children:'# \u8fd9\u4e2a\u5e94\u7528\u7684ID\nid: relion\n\n# \u8fd9\u4e2a\u5e94\u7528\u7684\u540d\u5b57\nname: relion\n\n# \u6307\u5b9a\u5e94\u7528\u7c7b\u578b\u4e3avnc\ntype: vnc\n\n# VNC\u5e94\u7528\u7684\u914d\u7f6e\nvnc:\n  # \u6b64X Session\u7684xstartup\u811a\u672c\n  xstartup: |\n    module purge\n    module load ${relion_version}\n    echo y | relion\n      \n# \u914d\u7f6eHTML\u8868\u5355\nattributes:\n  - type: select\n    name: relion_version\n    label: \u9009\u62e9\u7248\u672c\n    required: true\n    placeholder: \u9009\u62e9relion\u7684\u7248\u672c\n    select:\n      - value: relion/3.1.3_openmpi_3.1.6\n        label: relion/3.1.3_openmpi_3.1.6\n        # \u53ef\u9009\u914d\u7f6e\uff0c\u82e5\u9700\u8981\u533a\u5206CPU\u548cGPU\u7684select\u7684\u4e0b\u62c9\u9879\uff0c\u6bd4\u5982\u6709\u4e9b\u7248\u672c\u53ea\u80fd\u5728\u6709GPU\u7684\u5206\u533a\u6709\u6548\n        # \u5c06requireGpu\u8bbe\u4e3atrue\uff0c\u6b64\u65f6\u8be5\u9009\u9879\u4f1a\u51fa\u73b0\u5728\u6709GPU\u7684\u5206\u533a\n        # requireGpu: true\n      - value: relion/4.0_openmpi_3.1.6\n        label: relion/4.0_openmpi_3.1.6\n        # \u5c06requireGpu\u8bbe\u4e3afalse\u6216\u8005\u4e0d\u914d\u7f6erequireGpu\uff0c\u6b64\u65f6\u8be5\u9009\u9879\u4f1a\u51fa\u73b0\u5728\u6240\u6709\u5206\u533a\n        # requireGpu: false\n  - type: text\n    name: sbatchOptions\n    label: \u5176\u4ed6sbatch\u53c2\u6570\n    required: false\n    placeholder: "\u6bd4\u5982\uff1a--gpus gres:2 --time 10"\n'})})]})}function d(e={}){const{wrapper:n}={...(0,i.a)(),...e.components};return n?(0,o.jsx)(n,{...e,children:(0,o.jsx)(a,{...e})}):a(e)}},57766:(e,n,r)=>{r.d(n,{Z:()=>t,a:()=>s});var o=r(70079);const i={},l=o.createContext(i);function s(e){const n=o.useContext(l);return o.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function t(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:s(e.components),o.createElement(l.Provider,{value:n},e.children)}}}]);