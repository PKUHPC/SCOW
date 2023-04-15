"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[5345],{4852:(e,t,r)=>{r.d(t,{Zo:()=>s,kt:()=>f});var n=r(9231);function p(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function o(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function a(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?o(Object(r),!0).forEach((function(t){p(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):o(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function i(e,t){if(null==e)return{};var r,n,p=function(e,t){if(null==e)return{};var r,n,p={},o=Object.keys(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||(p[r]=e[r]);return p}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(p[r]=e[r])}return p}var l=n.createContext({}),c=function(e){var t=n.useContext(l),r=t;return e&&(r="function"==typeof e?e(t):a(a({},t),e)),r},s=function(e){var t=c(e.components);return n.createElement(l.Provider,{value:t},e.children)},u="mdxType",y={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},d=n.forwardRef((function(e,t){var r=e.components,p=e.mdxType,o=e.originalType,l=e.parentName,s=i(e,["components","mdxType","originalType","parentName"]),u=c(r),d=p,f=u["".concat(l,".").concat(d)]||u[d]||y[d]||o;return r?n.createElement(f,a(a({ref:t},s),{},{components:r})):n.createElement(f,a({ref:t},s))}));function f(e,t){var r=arguments,p=t&&t.mdxType;if("string"==typeof e||p){var o=r.length,a=new Array(o);a[0]=d;var i={};for(var l in t)hasOwnProperty.call(t,l)&&(i[l]=t[l]);i.originalType=e,i[u]="string"==typeof e?e:p,a[1]=i;for(var c=2;c<o;c++)a[c]=r[c];return n.createElement.apply(null,a)}return n.createElement.apply(null,r)}d.displayName="MDXCreateElement"},2390:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>l,contentTitle:()=>a,default:()=>y,frontMatter:()=>o,metadata:()=>i,toc:()=>c});var n=r(5675),p=(r(9231),r(4852));const o={sidebar_position:2,title:"Jupyter"},a="Jupyter",i={unversionedId:"deploy/config/portal/apps/apps/jupyter",id:"deploy/config/portal/apps/apps/jupyter",title:"Jupyter",description:"\u524d\u63d0\u6761\u4ef6",source:"@site/docs/deploy/config/portal/apps/apps/jupyter.md",sourceDirName:"deploy/config/portal/apps/apps",slug:"/deploy/config/portal/apps/apps/jupyter",permalink:"/SCOW/pr-preview/pr-562/docs/deploy/config/portal/apps/apps/jupyter",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/portal/apps/apps/jupyter.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2,title:"Jupyter"},sidebar:"deploy",previous:{title:"VSCode",permalink:"/SCOW/pr-preview/pr-562/docs/deploy/config/portal/apps/apps/vscode"},next:{title:"\u767b\u5f55\u8282\u70b9\u684c\u9762\u529f\u80fd",permalink:"/SCOW/pr-preview/pr-562/docs/deploy/config/portal/desktop"}},l={},c=[{value:"\u524d\u63d0\u6761\u4ef6",id:"\u524d\u63d0\u6761\u4ef6",level:2},{value:"\u914d\u7f6e\u6587\u4ef6",id:"\u914d\u7f6e\u6587\u4ef6",level:2}],s={toc:c},u="wrapper";function y(e){let{components:t,...r}=e;return(0,p.kt)(u,(0,n.Z)({},s,r,{components:t,mdxType:"MDXLayout"}),(0,p.kt)("h1",{id:"jupyter"},"Jupyter"),(0,p.kt)("h2",{id:"\u524d\u63d0\u6761\u4ef6"},"\u524d\u63d0\u6761\u4ef6"),(0,p.kt)("p",null,"\u8bf7\u786e\u4fdd\u5728\u9700\u8981\u8fd0\u884c\u5e94\u7528\u7684\u8ba1\u7b97\u8282\u70b9\u4e0a\u5b89\u88c5\u6709Jupyter Notebook\u3002"),(0,p.kt)("p",null,"\u4e0b\u9762\u8bb2\u89e3\u5982\u4f55\u914d\u7f6e\u4f7f\u7528Jupyter\u3002"),(0,p.kt)("h2",{id:"\u914d\u7f6e\u6587\u4ef6"},"\u914d\u7f6e\u6587\u4ef6"),(0,p.kt)("p",null,"\u521b\u5efa",(0,p.kt)("inlineCode",{parentName:"p"},"config/apps"),"\u76ee\u5f55\uff0c\u5728\u91cc\u9762\u521b\u5efa",(0,p.kt)("inlineCode",{parentName:"p"},"jupyter.yml"),"\u6587\u4ef6\uff0c\u5176\u5185\u5bb9\u5982\u4e0b\uff1a"),(0,p.kt)("pre",null,(0,p.kt)("code",{parentName:"pre",className:"language-yaml",metastring:'title="config/apps/jupyter.yml"',title:'"config/apps/jupyter.yml"'},'# \u8fd9\u4e2a\u5e94\u7528\u7684ID\nid: jupyter\n\n# \u8fd9\u4e2a\u5e94\u7528\u7684\u540d\u5b57\nname: jupyter\n\n# \u6307\u5b9a\u5e94\u7528\u7c7b\u578b\u4e3aweb\ntype: web\n\n# Web\u5e94\u7528\u7684\u914d\u7f6e\nweb:\n  # \u6307\u5b9a\u53cd\u5411\u4ee3\u7406\u7c7b\u578b\n  proxyType: absolute\n  # \u51c6\u5907\u811a\u672c\n  beforeScript: |\n    export PORT=$(get_port)\n    export PASSWORD=$(get_password 12)\n    export SALT=123\n    export PASSWORD_SHA1="$(echo -n "${PASSWORD}${SALT}" | openssl dgst -sha1 | awk \'{print $NF}\')"\n    export CONFIG_FILE="${PWD}/config.py"\n    export SLURM_COMPUTE_NODE_IP=$(get_ip)\n\n  # \u8fd0\u884c\u4efb\u52a1\u7684\u811a\u672c\u3002\u53ef\u4ee5\u4f7f\u7528\u51c6\u5907\u811a\u672c\u5b9a\u4e49\u7684\u53d8\u91cf\n  script: |\n    (\n    umask 077\n    cat > "${CONFIG_FILE}" << EOL\n    c.NotebookApp.ip = \'0.0.0.0\'\n    c.NotebookApp.port = ${PORT}\n    c.NotebookApp.port_retries = 0\n    c.NotebookApp.password = u\'sha1:${SALT}:${PASSWORD_SHA1}\'\n    c.NotebookApp.open_browser = False\n    c.NotebookApp.base_url = "${PROXY_BASE_PATH}/${SLURM_COMPUTE_NODE_IP}/${PORT}/"\n    c.NotebookApp.allow_origin = \'*\'\n    c.NotebookApp.disable_check_xsrf = True\n    EOL\n    )\n    jupyter notebook --config=${CONFIG_FILE}\n\n  # \u5982\u4f55\u8fde\u63a5\u5e94\u7528\n  connect:\n    method: POST\n    path: /login\n    formData:\n      password: "{{ PASSWORD }}"\n')),(0,p.kt)("p",null,"\u589e\u52a0\u4e86\u6b64\u6587\u4ef6\u540e\uff0c\u5237\u65b0\u5373\u53ef\u3002"),(0,p.kt)("p",null,"\u5bf9\u4e8eJupyter\uff0cexport\u4ee5\u4e0b\u53d8\u91cf\u7684\u542b\u4e49\u662f\uff1a"),(0,p.kt)("ul",null,(0,p.kt)("li",{parentName:"ul"},(0,p.kt)("inlineCode",{parentName:"li"},"SLURM_COMPUTE_NODE_IP"),": \u8ba1\u7b97\u8282\u70b9\u7684IP\u5730\u5740"),(0,p.kt)("li",{parentName:"ul"},(0,p.kt)("inlineCode",{parentName:"li"},"CONFIG_FILE"),": \u6307\u5b9aJupyter\u7684\u914d\u7f6e\u6587\u4ef6")))}y.isMDXComponent=!0}}]);