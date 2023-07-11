"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[535],{54852:(e,t,n)=>{n.d(t,{Zo:()=>s,kt:()=>y});var r=n(49231);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function a(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?a(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):a(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function c(e,t){if(null==e)return{};var n,r,o=function(e,t){if(null==e)return{};var n,r,o={},a=Object.keys(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var l=r.createContext({}),p=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},s=function(e){var t=p(e.components);return r.createElement(l.Provider,{value:t},e.children)},d="mdxType",u={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},f=r.forwardRef((function(e,t){var n=e.components,o=e.mdxType,a=e.originalType,l=e.parentName,s=c(e,["components","mdxType","originalType","parentName"]),d=p(n),f=o,y=d["".concat(l,".").concat(f)]||d[f]||u[f]||a;return n?r.createElement(y,i(i({ref:t},s),{},{components:n})):r.createElement(y,i({ref:t},s))}));function y(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var a=n.length,i=new Array(a);i[0]=f;var c={};for(var l in t)hasOwnProperty.call(t,l)&&(c[l]=t[l]);c.originalType=e,c[d]="string"==typeof e?e:o,i[1]=c;for(var p=2;p<a;p++)i[p]=n[p];return r.createElement.apply(null,i)}return r.createElement.apply(null,n)}f.displayName="MDXCreateElement"},87468:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>u,frontMatter:()=>a,metadata:()=>c,toc:()=>p});var r=n(45675),o=(n(49231),n(54852));const a={sidebar_position:8,title:"\u914d\u7f6e"},i="\u7f51\u5173\u914d\u7f6e",c={unversionedId:"deploy/config/gateway/config/index",id:"deploy/config/gateway/config/index",title:"\u914d\u7f6e",description:"extra",source:"@site/docs/deploy/config/gateway/config/index.md",sourceDirName:"deploy/config/gateway/config",slug:"/deploy/config/gateway/config/",permalink:"/SCOW/pr-preview/pr-726/docs/deploy/config/gateway/config/",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/gateway/config/index.md",tags:[],version:"current",sidebarPosition:8,frontMatter:{sidebar_position:8,title:"\u914d\u7f6e"},sidebar:"deploy",previous:{title:"\u7f51\u5173",permalink:"/SCOW/pr-preview/pr-726/docs/category/\u7f51\u5173"},next:{title:"\u81ea\u5b9a\u4e49",permalink:"/SCOW/pr-preview/pr-726/docs/category/\u81ea\u5b9a\u4e49"}},l={},p=[{value:"extra",id:"extra",level:2}],s={toc:p},d="wrapper";function u(e){let{components:t,...n}=e;return(0,o.kt)(d,(0,r.Z)({},s,n,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"\u7f51\u5173\u914d\u7f6e"},"\u7f51\u5173\u914d\u7f6e"),(0,o.kt)("h2",{id:"extra"},"extra"),(0,o.kt)("p",null,"\u60a8\u53ef\u4ee5\u5728cli\u540c\u7ea7\u7684",(0,o.kt)("inlineCode",{parentName:"p"},"install.yml"),"\u6587\u4ef6\u4e2d\u589e\u52a0\u5bf9scow\u81ea\u5e26\u7f51\u5173\u7684\u914d\u7f6e\uff0c\u53ef\u63a5\u53d7\u7684\u683c\u5f0f\u4e3anginx\u7684server\u53ef\u63a5\u53d7\u7684\u5c5e\u6027\u914d\u7f6e\u3002"),(0,o.kt)("p",null,"\u4f8b\u5982\uff0c\u589e\u52a0\u5728\u5f53\u524d\u7cfb\u7edfnginx\u9ed8\u8ba4\u7aef\u53e3\u7684http\u670d\u52a1",(0,o.kt)("inlineCode",{parentName:"p"},"http://extra-web:3000"),"\uff0c\u5219\u7f16\u5199"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-yaml",metastring:'title="install.yml"',title:'"install.yml"'},"# \u7f51\u5173\u914d\u7f6e\ngateway:\n   # \u66f4\u591anginx\u914d\u7f6e\n    extra: >\n        location /extra {\n            proxy_pass http://extra-web:3000;\n            include includes/headers;\n            include includes/websocket;\n         }\n")),(0,o.kt)("p",null,"\u60a8\u589e\u52a0",(0,o.kt)("inlineCode",{parentName:"p"},"extra"),"\u914d\u7f6e\u540e\uff0c\u53ef\u4ee5\u5728\u4f7f\u7528",(0,o.kt)("inlineCode",{parentName:"p"},"./cli compose up -d"),"\u542f\u52a8scow\u540e\uff0c\u4f7f\u7528 ",(0,o.kt)("inlineCode",{parentName:"p"}," ./cli compose exec gateway sh")," \u8fdb\u5165gateway\u670d\u52a1\uff0c\u5728 ",(0,o.kt)("inlineCode",{parentName:"p"},"/etc/nginx/http.d")," \u76ee\u5f55\u4e0b\u7684 ",(0,o.kt)("inlineCode",{parentName:"p"},"default.conf")," \u6587\u4ef6\u6700\u4e0b\u65b9\u67e5\u770b\u5230\u60a8\u6dfb\u52a0\u7684\u914d\u7f6e\u3002\n\u5982\u679cgateway\u670d\u52a1\u542f\u52a8\u5931\u8d25\uff0c\u8bf4\u660e\u60a8\u7684\u914d\u7f6e\u4e0d\u7b26\u5408\u89c4\u8303\uff0c\u8bf7\u4fdd\u8bc1\u5176\u6b63\u786e\u6027\u3002"))}u.isMDXComponent=!0}}]);