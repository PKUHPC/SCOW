"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[535],{9291:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>a,contentTitle:()=>r,default:()=>p,frontMatter:()=>i,metadata:()=>s,toc:()=>d});var o=t(35250),c=t(57766);const i={sidebar_position:8,title:"\u914d\u7f6e"},r="\u7f51\u5173\u914d\u7f6e",s={id:"deploy/config/gateway/config/index",title:"\u914d\u7f6e",description:"extra",source:"@site/docs/deploy/config/gateway/config/index.md",sourceDirName:"deploy/config/gateway/config",slug:"/deploy/config/gateway/config/",permalink:"/SCOW/pr-preview/pr-983/docs/deploy/config/gateway/config/",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/gateway/config/index.md",tags:[],version:"current",sidebarPosition:8,frontMatter:{sidebar_position:8,title:"\u914d\u7f6e"},sidebar:"deploy",previous:{title:"\u7f51\u5173",permalink:"/SCOW/pr-preview/pr-983/docs/category/\u7f51\u5173"},next:{title:"\u81ea\u5b9a\u4e49",permalink:"/SCOW/pr-preview/pr-983/docs/category/\u81ea\u5b9a\u4e49"}},a={},d=[{value:"extra",id:"extra",level:2}];function l(e){const n={code:"code",h1:"h1",h2:"h2",p:"p",pre:"pre",...(0,c.a)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(n.h1,{id:"\u7f51\u5173\u914d\u7f6e",children:"\u7f51\u5173\u914d\u7f6e"}),"\n",(0,o.jsx)(n.h2,{id:"extra",children:"extra"}),"\n",(0,o.jsxs)(n.p,{children:["\u60a8\u53ef\u4ee5\u5728cli\u540c\u7ea7\u7684",(0,o.jsx)(n.code,{children:"install.yml"}),"\u6587\u4ef6\u4e2d\u589e\u52a0\u5bf9scow\u81ea\u5e26\u7f51\u5173\u7684\u914d\u7f6e\uff0c\u53ef\u63a5\u53d7\u7684\u683c\u5f0f\u4e3anginx\u7684server\u53ef\u63a5\u53d7\u7684\u5c5e\u6027\u914d\u7f6e\u3002"]}),"\n",(0,o.jsxs)(n.p,{children:["\u4f8b\u5982\uff0c\u589e\u52a0\u5728\u5f53\u524d\u7cfb\u7edfnginx\u9ed8\u8ba4\u7aef\u53e3\u7684http\u670d\u52a1",(0,o.jsx)(n.code,{children:"http://extra-web:3000"}),"\uff0c\u5219\u7f16\u5199"]}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-yaml",metastring:'title="install.yml"',children:"# \u7f51\u5173\u914d\u7f6e\ngateway:\n   # \u66f4\u591anginx\u914d\u7f6e\n    extra: >\n        location /extra {\n            proxy_pass http://extra-web:3000;\n            include includes/headers;\n            include includes/websocket;\n         }\n"})}),"\n",(0,o.jsxs)(n.p,{children:["\u60a8\u589e\u52a0",(0,o.jsx)(n.code,{children:"extra"}),"\u914d\u7f6e\u540e\uff0c\u53ef\u4ee5\u5728\u4f7f\u7528",(0,o.jsx)(n.code,{children:"./cli compose up -d"}),"\u542f\u52a8scow\u540e\uff0c\u4f7f\u7528 ",(0,o.jsx)(n.code,{children:" ./cli compose exec gateway sh"})," \u8fdb\u5165gateway\u670d\u52a1\uff0c\u5728 ",(0,o.jsx)(n.code,{children:"/etc/nginx/http.d"})," \u76ee\u5f55\u4e0b\u7684 ",(0,o.jsx)(n.code,{children:"default.conf"})," \u6587\u4ef6\u6700\u4e0b\u65b9\u67e5\u770b\u5230\u60a8\u6dfb\u52a0\u7684\u914d\u7f6e\u3002\n\u5982\u679cgateway\u670d\u52a1\u542f\u52a8\u5931\u8d25\uff0c\u8bf4\u660e\u60a8\u7684\u914d\u7f6e\u4e0d\u7b26\u5408\u89c4\u8303\uff0c\u8bf7\u4fdd\u8bc1\u5176\u6b63\u786e\u6027\u3002"]})]})}function p(e={}){const{wrapper:n}={...(0,c.a)(),...e.components};return n?(0,o.jsx)(n,{...e,children:(0,o.jsx)(l,{...e})}):l(e)}},57766:(e,n,t)=>{t.d(n,{Z:()=>s,a:()=>r});var o=t(70079);const c={},i=o.createContext(c);function r(e){const n=o.useContext(i);return o.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function s(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(c):e.components||c:r(e.components),o.createElement(i.Provider,{value:n},e.children)}}}]);