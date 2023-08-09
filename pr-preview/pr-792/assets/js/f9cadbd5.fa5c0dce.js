"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[5797],{54852:(e,t,n)=>{n.d(t,{Zo:()=>u,kt:()=>f});var r=n(49231);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function l(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function o(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?l(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):l(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function i(e,t){if(null==e)return{};var n,r,a=function(e,t){if(null==e)return{};var n,r,a={},l=Object.keys(e);for(r=0;r<l.length;r++)n=l[r],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var l=Object.getOwnPropertySymbols(e);for(r=0;r<l.length;r++)n=l[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var p=r.createContext({}),c=function(e){var t=r.useContext(p),n=t;return e&&(n="function"==typeof e?e(t):o(o({},t),e)),n},u=function(e){var t=c(e.components);return r.createElement(p.Provider,{value:t},e.children)},s="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},m=r.forwardRef((function(e,t){var n=e.components,a=e.mdxType,l=e.originalType,p=e.parentName,u=i(e,["components","mdxType","originalType","parentName"]),s=c(n),m=a,f=s["".concat(p,".").concat(m)]||s[m]||d[m]||l;return n?r.createElement(f,o(o({ref:t},u),{},{components:n})):r.createElement(f,o({ref:t},u))}));function f(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var l=n.length,o=new Array(l);o[0]=m;var i={};for(var p in t)hasOwnProperty.call(t,p)&&(i[p]=t[p]);i.originalType=e,i[s]="string"==typeof e?e:a,o[1]=i;for(var c=2;c<l;c++)o[c]=n[c];return r.createElement.apply(null,o)}return r.createElement.apply(null,n)}m.displayName="MDXCreateElement"},69574:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>p,contentTitle:()=>o,default:()=>d,frontMatter:()=>l,metadata:()=>i,toc:()=>c});var r=n(45675),a=(n(49231),n(54852));const l={sidebar_position:2,title:"SSH"},o="SSH\u8ba4\u8bc1\u7cfb\u7edf",i={unversionedId:"deploy/config/auth/ssh",id:"deploy/config/auth/ssh",title:"SSH",description:"\u672c\u8282\u4ecb\u7ecd\u5185\u7f6e\u8ba4\u8bc1\u7cfb\u7edf\u5e76\u91c7\u7528SSH\u8fdb\u884c\u7528\u6237\u8ba4\u8bc1\u7684\u8ba4\u8bc1\u7cfb\u7edf\u3002",source:"@site/docs/deploy/config/auth/ssh.md",sourceDirName:"deploy/config/auth",slug:"/deploy/config/auth/ssh",permalink:"/SCOW/pr-preview/pr-792/docs/deploy/config/auth/ssh",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/auth/ssh.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2,title:"SSH"},sidebar:"deploy",previous:{title:"\u7b80\u4ecb",permalink:"/SCOW/pr-preview/pr-792/docs/deploy/config/auth/intro"},next:{title:"LDAP",permalink:"/SCOW/pr-preview/pr-792/docs/deploy/config/auth/ldap"}},p={},c=[{value:"\u914d\u7f6eSSH\u8ba4\u8bc1\u670d\u52a1",id:"\u914d\u7f6essh\u8ba4\u8bc1\u670d\u52a1",level:2}],u={toc:c},s="wrapper";function d(e){let{components:t,...n}=e;return(0,a.kt)(s,(0,r.Z)({},u,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"ssh\u8ba4\u8bc1\u7cfb\u7edf"},"SSH\u8ba4\u8bc1\u7cfb\u7edf"),(0,a.kt)("p",null,"\u672c\u8282\u4ecb\u7ecd\u5185\u7f6e\u8ba4\u8bc1\u7cfb\u7edf\u5e76\u91c7\u7528SSH\u8fdb\u884c\u7528\u6237\u8ba4\u8bc1\u7684\u8ba4\u8bc1\u7cfb\u7edf\u3002"),(0,a.kt)("p",null,"SSH\u8ba4\u8bc1\u662f\u975e\u5e38\u7b80\u5355\u7684\u8ba4\u8bc1\u65b9\u5f0f\u3002\u7528\u6237\u53ef\u4ee5\u76f4\u63a5\u4f7f\u7528\u548cSSH\u767b\u5f55\u96c6\u7fa4\u76f8\u540c\u7684\u7528\u6237\u540d\u548c\u5bc6\u7801\u6765\u767b\u5f55\u7cfb\u7edf\u3002"),(0,a.kt)("p",null,"\u5728\u6b64\u8ba4\u8bc1\u65b9\u5f0f\u4e2d\uff0c\u7528\u6237\u7684\u7528\u6237ID\u4e3a\u5176\u5bf9\u5e94\u7684Linux\u7528\u6237\u540d\uff0c\u7528\u6237\u7684\u59d3\u540d\u4e3a\u5176\u5bf9\u5e94\u7684Linux\u7528\u6237\u7684",(0,a.kt)("a",{parentName:"p",href:"https://en.wikipedia.org/wiki/Gecos_field"},"Gecos Field"),"\u7684full name\u5b57\u6bb5\u3002"),(0,a.kt)("p",null,"SSH\u8ba4\u8bc1\u65b9\u5f0f\u6240\u652f\u6301\u7684\u529f\u80fd\u5982\u4e0b\u8868\uff1a"),(0,a.kt)("table",null,(0,a.kt)("thead",{parentName:"table"},(0,a.kt)("tr",{parentName:"thead"},(0,a.kt)("th",{parentName:"tr",align:null},"\u529f\u80fd"),(0,a.kt)("th",{parentName:"tr",align:null},"\u662f\u5426\u652f\u6301"))),(0,a.kt)("tbody",{parentName:"table"},(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},"\u7528\u6237\u767b\u5f55"),(0,a.kt)("td",{parentName:"tr",align:null},"\u662f")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},"\u83b7\u53d6\u7528\u6237\u4fe1\u606f"),(0,a.kt)("td",{parentName:"tr",align:null},"\u662f")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},"\u7528\u6237\u521b\u5efa"),(0,a.kt)("td",{parentName:"tr",align:null},"\u5426")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},"\u7528\u6237\u540d\u548c\u59d3\u540d\u9a8c\u8bc1"),(0,a.kt)("td",{parentName:"tr",align:null},"\u5426")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},"\u4fee\u6539\u5bc6\u7801"),(0,a.kt)("td",{parentName:"tr",align:null},"\u5426")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},"\u7ba1\u7406\u7528\u6237\u8d26\u6237\u5173\u7cfb"),(0,a.kt)("td",{parentName:"tr",align:null},"\u5426")))),(0,a.kt)("h2",{id:"\u914d\u7f6essh\u8ba4\u8bc1\u670d\u52a1"},"\u914d\u7f6eSSH\u8ba4\u8bc1\u670d\u52a1"),(0,a.kt)("p",null,"SSH\u8ba4\u8bc1\u65b9\u5f0f\u8981\u6c42\u7f16\u5199\u597d",(0,a.kt)("a",{parentName:"p",href:"/SCOW/pr-preview/pr-792/docs/deploy/config/cluster-config"},"\u96c6\u7fa4\u914d\u7f6e\u6587\u4ef6"),"\uff0c\u5e76\u4e14\u786e\u4fdd\u5176\u4e2d\u7b2c\u4e00\u4e2a\u96c6\u7fa4\u6709\u81f3\u5c11\u4e00\u4e2a\u767b\u5f55\u8282\u70b9\u3002"),(0,a.kt)("p",null,"\u5728",(0,a.kt)("inlineCode",{parentName:"p"},"config/auth.yml"),"\u4e2d\u8f93\u5165\u4ee5\u4e0b\u5185\u5bb9\uff1a"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-yaml",metastring:'title="config/auth.yml"',title:'"config/auth.yml"'},"# \u6307\u5b9a\u4f7f\u7528\u8ba4\u8bc1\u7c7b\u578b\u4e3aSSH\nauthType: ssh\n")),(0,a.kt)("p",null,"\u589e\u52a0\u597d\u914d\u7f6e\u540e\uff0c\u8fd0\u884c",(0,a.kt)("inlineCode",{parentName:"p"},"./cli compose restart"),"\u91cd\u542f\u7cfb\u7edf\u5373\u53ef\u3002"))}d.isMDXComponent=!0}}]);