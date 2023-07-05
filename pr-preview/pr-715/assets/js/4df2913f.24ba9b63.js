"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[5237],{54852:(e,n,t)=>{t.d(n,{Zo:()=>s,kt:()=>v});var r=t(49231);function a(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function o(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);n&&(r=r.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,r)}return t}function p(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?o(Object(t),!0).forEach((function(n){a(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):o(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function l(e,n){if(null==e)return{};var t,r,a=function(e,n){if(null==e)return{};var t,r,a={},o=Object.keys(e);for(r=0;r<o.length;r++)t=o[r],n.indexOf(t)>=0||(a[t]=e[t]);return a}(e,n);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(r=0;r<o.length;r++)t=o[r],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(a[t]=e[t])}return a}var i=r.createContext({}),c=function(e){var n=r.useContext(i),t=n;return e&&(t="function"==typeof e?e(n):p(p({},n),e)),t},s=function(e){var n=c(e.components);return r.createElement(i.Provider,{value:n},e.children)},f="mdxType",u={inlineCode:"code",wrapper:function(e){var n=e.children;return r.createElement(r.Fragment,{},n)}},d=r.forwardRef((function(e,n){var t=e.components,a=e.mdxType,o=e.originalType,i=e.parentName,s=l(e,["components","mdxType","originalType","parentName"]),f=c(t),d=a,v=f["".concat(i,".").concat(d)]||f[d]||u[d]||o;return t?r.createElement(v,p(p({ref:n},s),{},{components:t})):r.createElement(v,p({ref:n},s))}));function v(e,n){var t=arguments,a=n&&n.mdxType;if("string"==typeof e||a){var o=t.length,p=new Array(o);p[0]=d;var l={};for(var i in n)hasOwnProperty.call(n,i)&&(l[i]=n[i]);l.originalType=e,l[f]="string"==typeof e?e:a,p[1]=l;for(var c=2;c<o;c++)p[c]=t[c];return r.createElement.apply(null,p)}return r.createElement.apply(null,t)}d.displayName="MDXCreateElement"},62753:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>i,contentTitle:()=>p,default:()=>u,frontMatter:()=>o,metadata:()=>l,toc:()=>c});var r=t(95907),a=(t(49231),t(54852));const o={sidebar_position:1},p="Desktop",l={unversionedId:"deploy/config/portal/apps/apps/desktop/index",id:"deploy/config/portal/apps/apps/desktop/index",title:"Desktop",description:"\u8f6f\u4ef6\u7b80\u4ecb",source:"@site/docs/deploy/config/portal/apps/apps/desktop/index.md",sourceDirName:"deploy/config/portal/apps/apps/desktop",slug:"/deploy/config/portal/apps/apps/desktop/",permalink:"/SCOW/pr-preview/pr-715/docs/deploy/config/portal/apps/apps/desktop/",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/portal/apps/apps/desktop/index.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"deploy",previous:{title:"Baltamatica",permalink:"/SCOW/pr-preview/pr-715/docs/deploy/config/portal/apps/apps/baltamatica/"},next:{title:"Emacs",permalink:"/SCOW/pr-preview/pr-715/docs/deploy/config/portal/apps/apps/emacs/"}},i={},c=[{value:"\u8f6f\u4ef6\u7b80\u4ecb",id:"\u8f6f\u4ef6\u7b80\u4ecb",level:2},{value:"\u524d\u63d0\u6761\u4ef6",id:"\u524d\u63d0\u6761\u4ef6",level:2},{value:"1\u3001TurboVNC\u5b89\u88c5",id:"1turbovnc\u5b89\u88c5",level:3},{value:"3\u3001\u684c\u9762\u73af\u5883\u5b89\u88c5",id:"3\u684c\u9762\u73af\u5883\u5b89\u88c5",level:3},{value:"\u914d\u7f6e\u6587\u4ef6",id:"\u914d\u7f6e\u6587\u4ef6",level:2},{value:"FAQ",id:"faq",level:2},{value:"Q1\uff1a\u9996\u6b21\u8fde\u63a5\u8fdb\u5165\u5230Xfce\u684c\u9762\u65f6\uff0c\u4f1a\u62a5XFCE PolicyKit Agent\u7684\u5f39\u7a97\u9519\u8bef",id:"q1\u9996\u6b21\u8fde\u63a5\u8fdb\u5165\u5230xfce\u684c\u9762\u65f6\u4f1a\u62a5xfce-policykit-agent\u7684\u5f39\u7a97\u9519\u8bef",level:3}],s={toc:c},f="wrapper";function u(e){let{components:n,...o}=e;return(0,a.kt)(f,(0,r.Z)({},s,o,{components:n,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"desktop"},"Desktop"),(0,a.kt)("h2",{id:"\u8f6f\u4ef6\u7b80\u4ecb"},"\u8f6f\u4ef6\u7b80\u4ecb"),(0,a.kt)("p",null,"Xfce Desktop\u662f\u4e00\u6b3e\u8f7b\u91cf\u7ea7\u7684\u684c\u9762\u73af\u5883\uff0c\u5b83\u88ab\u8bbe\u8ba1\u4e3a\u5728\u8d44\u6e90\u53d7\u9650\u7684\u7cfb\u7edf\u4e0a\u8fd0\u884c\u3002\u5177\u6709\u7b80\u6d01\u3001\u5feb\u901f\u3001\u53ef\u5b9a\u5236\u7684\u7279\u70b9\uff0c\u5b83\u7684\u7528\u6237\u754c\u9762\u98ce\u683c\u975e\u5e38\u6e05\u723d\u3001\u73b0\u4ee3\u3002\u4e0e\u5176\u4ed6\u684c\u9762\u73af\u5883\u76f8\u6bd4\uff0c\u5b83\u5360\u7528\u7684\u7cfb\u7edf\u8d44\u6e90\u975e\u5e38\u5c11\uff0c\u540c\u65f6\u4e5f\u63d0\u4f9b\u4e86\u4e00\u4e9b\u5e38\u89c1\u7684\u5de5\u5177\u548c\u5e94\u7528\u7a0b\u5e8f\uff0c\u4f8b\u5982\u6587\u4ef6\u7ba1\u7406\u5668\u3001\u7ec8\u7aef\u6a21\u62df\u5668\u3001\u6587\u672c\u7f16\u8f91\u5668\u3001\u56fe\u50cf\u67e5\u770b\u5668\u548c\u97f3\u9891\u64ad\u653e\u5668\u7b49\u3002"),(0,a.kt)("p",null,"KDE\u662f\u4e00\u4e2a\u5f00\u6e90\u7684\u684c\u9762\u73af\u5883\uff0c\u5168\u79f0\u4e3aK Desktop Environment\uff08KDE\uff09\u3002\u5b83\u63d0\u4f9b\u4e86\u4e00\u4e2a\u529f\u80fd\u4e30\u5bcc\u3001\u53ef\u5b9a\u5236\u548c\u7528\u6237\u53cb\u597d\u7684\u56fe\u5f62\u5316\u684c\u9762\u73af\u5883\uff0c\u65e8\u5728\u4e3aLinux\u548c\u7c7bUNIX\u64cd\u4f5c\u7cfb\u7edf\u63d0\u4f9b\u5148\u8fdb\u7684\u7528\u6237\u4f53\u9a8c\u3002"),(0,a.kt)("p",null,"MATE\u662f\u4e00\u4e2a\u57fa\u4e8e\u4f20\u7edfGNOME 2\u684c\u9762\u73af\u5883\u7684\u8f7b\u91cf\u7ea7\u684c\u9762\u73af\u5883\uff0c\u65e8\u5728\u63d0\u4f9b\u4f20\u7edf\u7684\u684c\u9762\u4f53\u9a8c\u548c\u7528\u6237\u53cb\u597d\u7684\u754c\u9762\u3002"),(0,a.kt)("p",null,"Cinnamon\u662f\u4e00\u4e2a\u73b0\u4ee3\u5316\u7684\u684c\u9762\u73af\u5883\uff0c\u6700\u521d\u7531Linux Mint\u5f00\u53d1\uff0c\u65e8\u5728\u63d0\u4f9b\u76f4\u89c2\u3001\u6613\u7528\u4e14\u5438\u5f15\u4eba\u7684\u7528\u6237\u4f53\u9a8c\u3002\u5b83\u7684\u8bbe\u8ba1\u76ee\u6807\u662f\u4e3a\u7528\u6237\u63d0\u4f9b\u4e00\u4e2a\u719f\u6089\u800c\u9ad8\u6548\u7684\u684c\u9762\u73af\u5883\uff0c\u5177\u6709\u76f4\u89c2\u7684\u754c\u9762\u548c\u5f3a\u5927\u7684\u529f\u80fd\u3002"),(0,a.kt)("h2",{id:"\u524d\u63d0\u6761\u4ef6"},"\u524d\u63d0\u6761\u4ef6"),(0,a.kt)("p",null,"\u8bf7\u786e\u4fdd\u5728\u9700\u8981\u8fd0\u884c\u684c\u9762\u7c7b\u5e94\u7528\u7684\u673a\u5668\u4e0a\u5b89\u88c5\u6709\uff1a"),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},"TurboVNC 3.0\u7248\u672c\u53ca\u4ee5\u4e0a")),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},"\u60a8\u9700\u8981\u8fd0\u884c\u7684Xfce Desktop\u3001K Desktop Environment\uff08KDE\uff09\u3001MATE\u548ccinnamon\u684c\u9762\u73af\u5883"))),(0,a.kt)("h3",{id:"1turbovnc\u5b89\u88c5"},"1\u3001TurboVNC\u5b89\u88c5"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-bash"},"wget https://turbovnc.org/pmwiki/uploads/Downloads/TurboVNC.repo --no-check-certificate\nmv TurboVNC.repo /etc/yum.repos.d\n# \u5b89\u88c5\u6700\u65b0\u7248\u672c\nyum install turbovnc -y\n")),(0,a.kt)("h3",{id:"3\u684c\u9762\u73af\u5883\u5b89\u88c5"},"3\u3001\u684c\u9762\u73af\u5883\u5b89\u88c5"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-bash"},'yum groupinstall "Xfce" -y\nyum groupinstall "KDE Plasma Workspaces" -y\nyum groupinstall "MATE Desktop" -y\nyum install cinnamon -y\n')),(0,a.kt)("p",null,"\u4e0b\u9762\u8bb2\u89e3\u5982\u4f55\u914d\u7f6e\u4f7f\u7528Desktop\u3002"),(0,a.kt)("h2",{id:"\u914d\u7f6e\u6587\u4ef6"},"\u914d\u7f6e\u6587\u4ef6"),(0,a.kt)("p",null,"\u521b\u5efa",(0,a.kt)("inlineCode",{parentName:"p"},"config/apps"),"\u76ee\u5f55\uff0c\u5728\u91cc\u9762\u521b\u5efa",(0,a.kt)("inlineCode",{parentName:"p"},"desktop.yml"),"\u6587\u4ef6\uff0c\u5176\u5185\u5bb9\u5982\u4e0b\uff1a"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-yaml",metastring:'title="config/apps/desktop.yml"',title:'"config/apps/desktop.yml"'},'# \u8fd9\u4e2a\u5e94\u7528\u7684ID\nid: desktop\n\n# \u8fd9\u4e2a\u5e94\u7528\u7684\u540d\u5b57\nname: desktop\n\n# \u6307\u5b9a\u5e94\u7528\u7c7b\u578b\u4e3avnc\ntype: vnc\n\n# VNC\u5e94\u7528\u7684\u914d\u7f6e\nvnc:\n  # \u51c6\u5907\u811a\u672c\n  beforeScript: |\n    # \u684c\u9762\u4f1a\u8bdd\u4e34\u65f6\u6570\u636e\u5b58\u653e\u4f4d\u7f6e\n    export XDG_RUNTIME_DIR="$(mktemp -d)"\n  # \u6b64X Session\u7684xstartup\u811a\u672c\n  xstartup: |\n    unset SESSION_MANAGER\n    unset DBUS_SESSION_BUS_ADDRESS\n    \n    case ${desktop_type} in\n      "kde")\n        cd ~\n        startkde\n        ;;\n      "mate")\n        cd ~\n        mate-session\n        ;;\n      "cinnamon")\n        cd ~\n        cinnamon-session\n        ;;\n      *)\n        # Disable startup services \n        xfconf-query -c xfce4-session -p /startup/ssh-agent/enabled -n -t bool -s false\n        xfconf-query -c xfce4-session -p /startup/gpg-agent/enabled -n -t bool -s false\n        xfconf-query --channel xfce4-desktop -p /desktop-icons/file-icons/show-filesystem -s false --create -t bool\n        xfconf-query --channel xfce4-desktop -p /desktop-icons/file-icons/show-removable -s false --create -t bool\n        # \u914d\u7f6e\u9ed8\u8ba4\u9762\u677f\n        if [ ! -d "${HOME}/.config/xfce4/panel/launcher-9" ] || [ ! -d "${HOME}/.config/xfce4/panel/launcher-10" ] || [ ! -d "${HOME}/.config/xfce4/panel/launcher-11" ] || [ ! -d "${HOME}/.config/xfce4/panel/launcher-12" ]; then\n          cp -f /etc/xdg/xfce4/panel/default.xml ${HOME}/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.xml\n        fi\n        # \u684c\u9762\u7ec8\u7aef\u9ed8\u8ba4\u8fdb\u5165\u5230\u5bb6\u76ee\u5f55\n        cd ~\n        # \u542f\u52a8xfce\u684c\u9762\u73af\u5883\n        startxfce4\n    esac\n    \n      \n# \u914d\u7f6eHTML\u8868\u5355   \nattributes:\n  - type: select\n    name: desktop_type\n    label: \u8bf7\u9009\u62e9\u684c\u9762\u73af\u5883\n    select:\n      - value: xfce\n        label: Xfce Desktop\n      - value: kde\n        label: K Desktop Environment\uff08KDE\uff09\n      - value: mate\n        label: MATE\n      - value: cinnamon\n        label: Cinnamon\n  - type: text\n    name: sbatchOptions\n    label: \u5176\u4ed6sbatch\u53c2\u6570\n    required: false\n    placeholder: "\u6bd4\u5982\uff1a--gpus gres:2 --time 10"\n')),(0,a.kt)("h2",{id:"faq"},"FAQ"),(0,a.kt)("h3",{id:"q1\u9996\u6b21\u8fde\u63a5\u8fdb\u5165\u5230xfce\u684c\u9762\u65f6\u4f1a\u62a5xfce-policykit-agent\u7684\u5f39\u7a97\u9519\u8bef"},"Q1\uff1a\u9996\u6b21\u8fde\u63a5\u8fdb\u5165\u5230Xfce\u684c\u9762\u65f6\uff0c\u4f1a\u62a5XFCE PolicyKit Agent\u7684\u5f39\u7a97\u9519\u8bef"),(0,a.kt)("p",null,(0,a.kt)("img",{alt:"Xfce\u8ba4\u8bc1\u4ee3\u7406\u62a5\u9519\u56fe",src:t(47520).Z,width:"504",height:"134"})),(0,a.kt)("p",null,"\u7cfb\u7edf\u7ba1\u7406\u5458\u53ef\u901a\u8fc7\u7981\u7528Xfce PolicyKit\u9a8c\u8bc1\u4ee3\u7406\u89e3\u51b3\uff1a"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-bash"},"# \u5c06\u9700\u8981\u542f\u52a8xfce\u684c\u9762\u7684\u8282\u70b9\u4e0axfce-polkit.desktop\u6587\u4ef6\u91cd\u547d\u540d\nmv /etc/xdg/autostart/xfce-polkit.desktop /etc/xdg/autostart/xfce-polkit.desktop.disabled\n")))}u.isMDXComponent=!0},47520:(e,n,t)=>{t.d(n,{Z:()=>r});const r="data:image/png;base64,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"}}]);