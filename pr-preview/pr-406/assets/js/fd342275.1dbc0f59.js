"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[8480],{4852:(e,t,l)=>{l.d(t,{Zo:()=>s,kt:()=>m});var r=l(9231);function n(e,t,l){return t in e?Object.defineProperty(e,t,{value:l,enumerable:!0,configurable:!0,writable:!0}):e[t]=l,e}function o(e,t){var l=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),l.push.apply(l,r)}return l}function a(e){for(var t=1;t<arguments.length;t++){var l=null!=arguments[t]?arguments[t]:{};t%2?o(Object(l),!0).forEach((function(t){n(e,t,l[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(l)):o(Object(l)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(l,t))}))}return e}function u(e,t){if(null==e)return{};var l,r,n=function(e,t){if(null==e)return{};var l,r,n={},o=Object.keys(e);for(r=0;r<o.length;r++)l=o[r],t.indexOf(l)>=0||(n[l]=e[l]);return n}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(r=0;r<o.length;r++)l=o[r],t.indexOf(l)>=0||Object.prototype.propertyIsEnumerable.call(e,l)&&(n[l]=e[l])}return n}var d=r.createContext({}),i=function(e){var t=r.useContext(d),l=t;return e&&(l="function"==typeof e?e(t):a(a({},t),e)),l},s=function(e){var t=i(e.components);return r.createElement(d.Provider,{value:t},e.children)},p={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},c=r.forwardRef((function(e,t){var l=e.components,n=e.mdxType,o=e.originalType,d=e.parentName,s=u(e,["components","mdxType","originalType","parentName"]),c=i(l),m=n,f=c["".concat(d,".").concat(m)]||c[m]||p[m]||o;return l?r.createElement(f,a(a({ref:t},s),{},{components:l})):r.createElement(f,a({ref:t},s))}));function m(e,t){var l=arguments,n=t&&t.mdxType;if("string"==typeof e||n){var o=l.length,a=new Array(o);a[0]=c;var u={};for(var d in t)hasOwnProperty.call(t,d)&&(u[d]=t[d]);u.originalType=e,u.mdxType="string"==typeof e?e:n,a[1]=u;for(var i=2;i<o;i++)a[i]=l[i];return r.createElement.apply(null,a)}return r.createElement.apply(null,l)}c.displayName="MDXCreateElement"},511:(e,t,l)=>{l.r(t),l.d(t,{assets:()=>d,contentTitle:()=>a,default:()=>p,frontMatter:()=>o,metadata:()=>u,toc:()=>i});var r=l(9675),n=(l(9231),l(4852));const o={sidebar_label:"module\u5b89\u88c5",title:"module\u5b89\u88c5",sidebar_position:8},a=void 0,u={unversionedId:"deploy/slurm/module",id:"deploy/slurm/module",title:"module\u5b89\u88c5",description:"module\u662f\u7ed9\u96c6\u7fa4\u6240\u6709\u8282\u70b9\u4f7f\u7528\uff0c\u5b89\u88c5\u5728nfs\u5171\u4eab\u5b58\u50a8\u76ee\u5f55\u4e0a\u3002\u521b\u5efamodule\u5b89\u88c5\u76ee\u5f55\uff1a",source:"@site/docs/deploy/slurm/module.md",sourceDirName:"deploy/slurm",slug:"/deploy/slurm/module",permalink:"/SCOW/pr-preview/pr-406/docs/deploy/slurm/module",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/slurm/module.md",tags:[],version:"current",sidebarPosition:8,frontMatter:{sidebar_label:"module\u5b89\u88c5",title:"module\u5b89\u88c5",sidebar_position:8},sidebar:"deploy",previous:{title:"LDAP\u65b0\u5efa\u7528\u6237",permalink:"/SCOW/pr-preview/pr-406/docs/deploy/slurm/add-user"},next:{title:"intel\u7f16\u8bd1\u5668\u5b89\u88c5",permalink:"/SCOW/pr-preview/pr-406/docs/deploy/slurm/intel"}},d={},i=[{value:"1. tcl\u5b89\u88c5",id:"1-tcl\u5b89\u88c5",level:2},{value:"2. module\u5b89\u88c5",id:"2-module\u5b89\u88c5",level:2},{value:"3. \u914d\u7f6e",id:"3-\u914d\u7f6e",level:2}],s={toc:i};function p(e){let{components:t,...o}=e;return(0,n.kt)("wrapper",(0,r.Z)({},s,o,{components:t,mdxType:"MDXLayout"}),(0,n.kt)("p",null,"module\u662f\u7ed9\u96c6\u7fa4\u6240\u6709\u8282\u70b9\u4f7f\u7528\uff0c\u5b89\u88c5\u5728nfs\u5171\u4eab\u5b58\u50a8\u76ee\u5f55\u4e0a\u3002\u521b\u5efamodule\u5b89\u88c5\u76ee\u5f55\uff1a"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-Shell"},"mkdir /data/software/module\n")),(0,n.kt)("h2",{id:"1-tcl\u5b89\u88c5"},"1. tcl\u5b89\u88c5"),(0,n.kt)("p",null,"module\u5de5\u5177\uff0c\u4f9d\u8d56tcl\u5de5\u5177\uff0c\u56e0\u6b64\u9996\u5148\u8981\u5b89\u88c5tcl\u5de5\u5177\u3002"),(0,n.kt)("p",null,"\u521b\u5efa\u5de5\u5177\u76ee\u5f55\uff1a"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-Shell"},"mkdir -p /data/software/module/tools/tcl\n")),(0,n.kt)("p",null,"\u4e0b\u8f7d\u3001\u7f16\u8bd1\u3001\u5b89\u88c5\uff1a"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-PowerShell"},"# \u4e0b\u8f7d\nwget https://cfhcable.dl.sourceforge.net/project/tcl/Tcl/8.5.9/tcl8.5.9-src.tar.gz\n\n# \u89e3\u538b\ntar -zxvf tcl8.5.9-src.tar.gz \ncd tcl8.5.9/unix \n\n# \u7f16\u8bd1 & \u5b89\u88c5\uff0c\u6ce8\u610f\u4fee\u6539\u6b64\u5904\u76ee\u5f55\n./configure --prefix=/data/software/module/tools/tcl \nmake \nmake install\n")),(0,n.kt)("h2",{id:"2-module\u5b89\u88c5"},"2. module\u5b89\u88c5"),(0,n.kt)("p",null,"\u521b\u5efa\u5de5\u5177\u76ee\u5f55\uff1a"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-Shell"},"mkdir -p /data/software/module/tools/modules\n")),(0,n.kt)("p",null,"\u4e0b\u8f7d\u3001\u7f16\u8bd1\u3001\u5b89\u88c5\uff1a"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-PowerShell"},"# \u4e0b\u8f7d\uff0c\u6b64\u5904\u53ef\u80fd\u9700\u8981\u79d1\u5b66\u4e0a\u7f51\nwget https://newcontinuum.dl.sourceforge.net/project/modules/Modules/modules-4.2.4/modules-4.2.4.tar.gz \n\n#\u89e3\u538b\ntar -zxvf modules-4.2.4.tar.gz \ncd modules-4.2.4 \n\n# \u7f16\u8bd1 & \u5b89\u88c5,\u6ce8\u610f\u4fee\u6539\u8def\u5f84\n./configure --prefix=/data/software/module/tools/modules --with-tcl-lib=/data/software/module/tools/tcl/lib --with-tcl-inc=/data/software/module/tools/tcl/include  \nmake \nmake install\n")),(0,n.kt)("h2",{id:"3-\u914d\u7f6e"},"3. \u914d\u7f6e"),(0,n.kt)("p",null,"\u5b89\u88c5\u5b8c\u6210\u4e4b\u540e\uff0c\u5728",(0,n.kt)("inlineCode",{parentName:"p"},"/data/software/module/tools/modules"),"\u76ee\u5f55\u4e0b\uff0c\u5c31\u6709",(0,n.kt)("inlineCode",{parentName:"p"},"module"),"\u5de5\u5177\u4e86\u3002\u4e0d\u8fc7\u5728",(0,n.kt)("inlineCode",{parentName:"p"},"/usr/bin"),"\u76ee\u5f55\u4e0b\uff0c\u662f\u6ca1\u6709",(0,n.kt)("inlineCode",{parentName:"p"},"module"),"\u8fd9\u4e2a\u547d\u4ee4\u7684\u3002"),(0,n.kt)("p",null,"\u914d\u7f6e\u73af\u5883\u53d8\u91cf\uff1a"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-PowerShell"}," source /data/software/module/tools/modules/init/profile.sh\n")),(0,n.kt)("p",null,"\u63a5\u4e0b\u6765\u5c31\u53ef\u4ee5\u4f7f\u7528",(0,n.kt)("inlineCode",{parentName:"p"},"module"),"\u547d\u4ee4\u4e86\uff1a"),(0,n.kt)("p",null,(0,n.kt)("img",{alt:"img",src:l(9726).Z,width:"1032",height:"821"})))}p.isMDXComponent=!0},9726:(e,t,l)=>{l.d(t,{Z:()=>r});const r=l.p+"assets/images/-6-1-beffe3fe746fa6ea8e15ede2f693d0f9.PNG"}}]);