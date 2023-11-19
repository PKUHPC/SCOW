"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[3627],{32778:(e,l,n)=>{n.r(l),n.d(l,{assets:()=>r,contentTitle:()=>c,default:()=>u,frontMatter:()=>o,metadata:()=>d,toc:()=>i});var t=n(35250),s=n(57766);const o={sidebar_label:"module\u5b89\u88c5",title:"module\u5b89\u88c5",sidebar_position:8},c=void 0,d={id:"hpccluster/module",title:"module\u5b89\u88c5",description:"module\u662f\u7ed9\u96c6\u7fa4\u6240\u6709\u8282\u70b9\u4f7f\u7528\uff0c\u5b89\u88c5\u5728nfs\u5171\u4eab\u5b58\u50a8\u76ee\u5f55\u4e0a\u3002\u521b\u5efamodule\u5b89\u88c5\u76ee\u5f55\uff1a",source:"@site/docs/hpccluster/module.md",sourceDirName:"hpccluster",slug:"/hpccluster/module",permalink:"/SCOW/pr-preview/pr-983/docs/hpccluster/module",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/hpccluster/module.md",tags:[],version:"current",sidebarPosition:8,frontMatter:{sidebar_label:"module\u5b89\u88c5",title:"module\u5b89\u88c5",sidebar_position:8},sidebar:"hpccluster",previous:{title:"LDAP\u65b0\u5efa\u7528\u6237",permalink:"/SCOW/pr-preview/pr-983/docs/hpccluster/add-user"},next:{title:"intel\u7f16\u8bd1\u5668\u5b89\u88c5",permalink:"/SCOW/pr-preview/pr-983/docs/hpccluster/intel"}},r={},i=[{value:"1. tcl\u5b89\u88c5",id:"1-tcl\u5b89\u88c5",level:2},{value:"2. module\u5b89\u88c5",id:"2-module\u5b89\u88c5",level:2},{value:"3. \u914d\u7f6e",id:"3-\u914d\u7f6e",level:2}];function a(e){const l={code:"code",h2:"h2",img:"img",p:"p",pre:"pre",...(0,s.a)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(l.p,{children:"module\u662f\u7ed9\u96c6\u7fa4\u6240\u6709\u8282\u70b9\u4f7f\u7528\uff0c\u5b89\u88c5\u5728nfs\u5171\u4eab\u5b58\u50a8\u76ee\u5f55\u4e0a\u3002\u521b\u5efamodule\u5b89\u88c5\u76ee\u5f55\uff1a"}),"\n",(0,t.jsx)(l.pre,{children:(0,t.jsx)(l.code,{className:"language-Shell",children:"mkdir /data/software/module\n"})}),"\n",(0,t.jsx)(l.h2,{id:"1-tcl\u5b89\u88c5",children:"1. tcl\u5b89\u88c5"}),"\n",(0,t.jsx)(l.p,{children:"module\u5de5\u5177\uff0c\u4f9d\u8d56tcl\u5de5\u5177\uff0c\u56e0\u6b64\u9996\u5148\u8981\u5b89\u88c5tcl\u5de5\u5177\u3002"}),"\n",(0,t.jsx)(l.p,{children:"\u521b\u5efa\u5de5\u5177\u76ee\u5f55\uff1a"}),"\n",(0,t.jsx)(l.pre,{children:(0,t.jsx)(l.code,{className:"language-Shell",children:"mkdir -p /data/software/module/tools/tcl\n"})}),"\n",(0,t.jsx)(l.p,{children:"\u4e0b\u8f7d\u3001\u7f16\u8bd1\u3001\u5b89\u88c5\uff1a"}),"\n",(0,t.jsx)(l.pre,{children:(0,t.jsx)(l.code,{className:"language-PowerShell",children:"# \u4e0b\u8f7d\nwget https://cfhcable.dl.sourceforge.net/project/tcl/Tcl/8.5.9/tcl8.5.9-src.tar.gz\n\n# \u89e3\u538b\ntar -zxvf tcl8.5.9-src.tar.gz \ncd tcl8.5.9/unix \n\n# \u7f16\u8bd1 & \u5b89\u88c5\uff0c\u6ce8\u610f\u4fee\u6539\u6b64\u5904\u76ee\u5f55\n./configure --prefix=/data/software/module/tools/tcl \nmake \nmake install\n"})}),"\n",(0,t.jsx)(l.h2,{id:"2-module\u5b89\u88c5",children:"2. module\u5b89\u88c5"}),"\n",(0,t.jsx)(l.p,{children:"\u521b\u5efa\u5de5\u5177\u76ee\u5f55\uff1a"}),"\n",(0,t.jsx)(l.pre,{children:(0,t.jsx)(l.code,{className:"language-Shell",children:"mkdir -p /data/software/module/tools/modules\n"})}),"\n",(0,t.jsx)(l.p,{children:"\u4e0b\u8f7d\u3001\u7f16\u8bd1\u3001\u5b89\u88c5\uff1a"}),"\n",(0,t.jsx)(l.pre,{children:(0,t.jsx)(l.code,{className:"language-PowerShell",children:"# \u4e0b\u8f7d\uff0c\u6b64\u5904\u53ef\u80fd\u9700\u8981\u79d1\u5b66\u4e0a\u7f51\nwget https://newcontinuum.dl.sourceforge.net/project/modules/Modules/modules-4.2.4/modules-4.2.4.tar.gz \n\n#\u89e3\u538b\ntar -zxvf modules-4.2.4.tar.gz \ncd modules-4.2.4 \n\n# \u7f16\u8bd1 & \u5b89\u88c5,\u6ce8\u610f\u4fee\u6539\u8def\u5f84\n./configure --prefix=/data/software/module/tools/modules --with-tcl-lib=/data/software/module/tools/tcl/lib --with-tcl-inc=/data/software/module/tools/tcl/include  \nmake \nmake install\n"})}),"\n",(0,t.jsx)(l.h2,{id:"3-\u914d\u7f6e",children:"3. \u914d\u7f6e"}),"\n",(0,t.jsxs)(l.p,{children:["\u5b89\u88c5\u5b8c\u6210\u4e4b\u540e\uff0c\u5728",(0,t.jsx)(l.code,{children:"/data/software/module/tools/modules"}),"\u76ee\u5f55\u4e0b\uff0c\u5c31\u6709",(0,t.jsx)(l.code,{children:"module"}),"\u5de5\u5177\u4e86\u3002\u4e0d\u8fc7\u5728",(0,t.jsx)(l.code,{children:"/usr/bin"}),"\u76ee\u5f55\u4e0b\uff0c\u662f\u6ca1\u6709",(0,t.jsx)(l.code,{children:"module"}),"\u8fd9\u4e2a\u547d\u4ee4\u7684\u3002"]}),"\n",(0,t.jsx)(l.p,{children:"\u914d\u7f6e\u73af\u5883\u53d8\u91cf\uff1a"}),"\n",(0,t.jsx)(l.pre,{children:(0,t.jsx)(l.code,{className:"language-PowerShell",children:" source /data/software/module/tools/modules/init/profile.sh\n"})}),"\n",(0,t.jsxs)(l.p,{children:["\u63a5\u4e0b\u6765\u5c31\u53ef\u4ee5\u4f7f\u7528",(0,t.jsx)(l.code,{children:"module"}),"\u547d\u4ee4\u4e86\uff1a"]}),"\n",(0,t.jsx)(l.p,{children:(0,t.jsx)(l.img,{alt:"img",src:n(4349).Z+"",width:"1032",height:"821"})})]})}function u(e={}){const{wrapper:l}={...(0,s.a)(),...e.components};return l?(0,t.jsx)(l,{...e,children:(0,t.jsx)(a,{...e})}):a(e)}},4349:(e,l,n)=>{n.d(l,{Z:()=>t});const t=n.p+"assets/images/-6-1-beffe3fe746fa6ea8e15ede2f693d0f9.PNG"},57766:(e,l,n)=>{n.d(l,{Z:()=>d,a:()=>c});var t=n(70079);const s={},o=t.createContext(s);function c(e){const l=t.useContext(o);return t.useMemo((function(){return"function"==typeof e?e(l):{...l,...e}}),[l,e])}function d(e){let l;return l=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:c(e.components),t.createElement(o.Provider,{value:l},e.children)}}}]);