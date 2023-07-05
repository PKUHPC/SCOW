"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[1550],{54852:(e,t,n)=>{n.d(t,{Zo:()=>u,kt:()=>N});var a=n(49231);function r(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function l(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function p(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?l(Object(n),!0).forEach((function(t){r(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):l(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function i(e,t){if(null==e)return{};var n,a,r=function(e,t){if(null==e)return{};var n,a,r={},l=Object.keys(e);for(a=0;a<l.length;a++)n=l[a],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,t);if(Object.getOwnPropertySymbols){var l=Object.getOwnPropertySymbols(e);for(a=0;a<l.length;a++)n=l[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(r[n]=e[n])}return r}var d=a.createContext({}),o=function(e){var t=a.useContext(d),n=t;return e&&(n="function"==typeof e?e(t):p(p({},t),e)),n},u=function(e){var t=o(e.components);return a.createElement(d.Provider,{value:t},e.children)},m="mdxType",k={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},s=a.forwardRef((function(e,t){var n=e.components,r=e.mdxType,l=e.originalType,d=e.parentName,u=i(e,["components","mdxType","originalType","parentName"]),m=o(n),s=r,N=m["".concat(d,".").concat(s)]||m[s]||k[s]||l;return n?a.createElement(N,p(p({ref:t},u),{},{components:n})):a.createElement(N,p({ref:t},u))}));function N(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var l=n.length,p=new Array(l);p[0]=s;var i={};for(var d in t)hasOwnProperty.call(t,d)&&(i[d]=t[d]);i.originalType=e,i[m]="string"==typeof e?e:r,p[1]=i;for(var o=2;o<l;o++)p[o]=n[o];return a.createElement.apply(null,p)}return a.createElement.apply(null,n)}s.displayName="MDXCreateElement"},2621:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>d,contentTitle:()=>p,default:()=>k,frontMatter:()=>l,metadata:()=>i,toc:()=>o});var a=n(95907),r=(n(49231),n(54852));const l={sidebar_position:3,title:"LDAP"},p="LDAP\u8ba4\u8bc1\u7cfb\u7edf",i={unversionedId:"deploy/config/auth/ldap",id:"deploy/config/auth/ldap",title:"LDAP",description:"\u672c\u8282\u4ecb\u7ecd\u4f7f\u7528\u5185\u7f6e\u8ba4\u8bc1\u7cfb\u7edf\u5e76\u4f7f\u7528LDAP\u8fdb\u884c\u7528\u6237\u8ba4\u8bc1\u3002",source:"@site/docs/deploy/config/auth/ldap.md",sourceDirName:"deploy/config/auth",slug:"/deploy/config/auth/ldap",permalink:"/SCOW/pr-preview/pr-715/docs/deploy/config/auth/ldap",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/config/auth/ldap.md",tags:[],version:"current",sidebarPosition:3,frontMatter:{sidebar_position:3,title:"LDAP"},sidebar:"deploy",previous:{title:"SSH",permalink:"/SCOW/pr-preview/pr-715/docs/deploy/config/auth/ssh"},next:{title:"\u5185\u7f6e\u8ba4\u8bc1\u7cfb\u7edf\u914d\u7f6e",permalink:"/SCOW/pr-preview/pr-715/docs/deploy/config/auth/config"}},d={},o=[{value:"LDAP\u8ba4\u8bc1\u8981\u6c42\u548c\u6d41\u7a0b",id:"ldap\u8ba4\u8bc1\u8981\u6c42\u548c\u6d41\u7a0b",level:2},{value:"\u4f7f\u7528LDAP\u767b\u5f55\u96c6\u7fa4",id:"\u4f7f\u7528ldap\u767b\u5f55\u96c6\u7fa4",level:3},{value:"\u767b\u5f55",id:"\u767b\u5f55",level:3},{value:"\u521b\u5efa\u7528\u6237",id:"\u521b\u5efa\u7528\u6237",level:3},{value:"\u914d\u7f6eLDAP\u8ba4\u8bc1\u670d\u52a1",id:"\u914d\u7f6eldap\u8ba4\u8bc1\u670d\u52a1",level:2},{value:"LDAP\u5feb\u901f\u914d\u7f6e\u811a\u672c",id:"ldap\u5feb\u901f\u914d\u7f6e\u811a\u672c",level:2},{value:"LDAP\u955c\u50cf",id:"ldap\u955c\u50cf",level:2}],u={toc:o},m="wrapper";function k(e){let{components:t,...n}=e;return(0,r.kt)(m,(0,a.Z)({},u,n,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"ldap\u8ba4\u8bc1\u7cfb\u7edf"},"LDAP\u8ba4\u8bc1\u7cfb\u7edf"),(0,r.kt)("p",null,"\u672c\u8282\u4ecb\u7ecd\u4f7f\u7528\u5185\u7f6e\u8ba4\u8bc1\u7cfb\u7edf\u5e76\u4f7f\u7528LDAP\u8fdb\u884c\u7528\u6237\u8ba4\u8bc1\u3002"),(0,r.kt)("p",null,"LDAP\u8ba4\u8bc1\u7cfb\u7edf\u652f\u6301\u7684\u529f\u80fd\u5982\u4e0b\u8868\uff1a"),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:null},"\u529f\u80fd"),(0,r.kt)("th",{parentName:"tr",align:null},"\u662f\u5426\u652f\u6301"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"\u7528\u6237\u767b\u5f55"),(0,r.kt)("td",{parentName:"tr",align:null},"\u662f")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"\u83b7\u53d6\u7528\u6237\u4fe1\u606f"),(0,r.kt)("td",{parentName:"tr",align:null},"\u662f")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"\u7528\u6237\u521b\u5efa"),(0,r.kt)("td",{parentName:"tr",align:null},"\u5982\u679c\u914d\u7f6e\u4e86\u76f8\u5173\u914d\u7f6e\u5373\u652f\u6301")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"\u7528\u6237\u540d\u548c\u59d3\u540d\u9a8c\u8bc1"),(0,r.kt)("td",{parentName:"tr",align:null},"\u662f")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"\u4fee\u6539\u5bc6\u7801"),(0,r.kt)("td",{parentName:"tr",align:null},"\u662f")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"\u7ba1\u7406\u7528\u6237\u8d26\u6237\u5173\u7cfb"),(0,r.kt)("td",{parentName:"tr",align:null},"\u5426")))),(0,r.kt)("h2",{id:"ldap\u8ba4\u8bc1\u8981\u6c42\u548c\u6d41\u7a0b"},"LDAP\u8ba4\u8bc1\u8981\u6c42\u548c\u6d41\u7a0b"),(0,r.kt)("p",null,"\u4e3a\u4e86\u66f4\u597d\u7684\u7406\u89e3\u5e76\u914d\u7f6eLDAP\u8ba4\u8bc1\u7cfb\u7edf\uff0c\u672c\u8282\u5c06\u4ecb\u7ecd\u5404\u4e2a\u64cd\u4f5c\u65f6\uff0cLDAP\u8ba4\u8bc1\u7cfb\u7edf\u6240\u8fdb\u884c\u7684\u64cd\u4f5c\u3002\u8bf7\u786e\u8ba4\u60a8\u7684LDAP\u914d\u7f6e\u517c\u5bb9\u8fd9\u91cc\u6240\u79f0\u7684\u6d41\u7a0b"),(0,r.kt)("p",null,"\u4e0b\u6587\u4e2d\uff0c\u4ee3\u7801\u5757\uff08\u5982",(0,r.kt)("inlineCode",{parentName:"p"},"ldap.bindDn"),"\uff09\u4e3a\u914d\u7f6e\u6587\u4ef6",(0,r.kt)("inlineCode",{parentName:"p"},"config/auth.yml"),"\u4e2d\u7684\u5bf9\u5e94\u503c\u3002"),(0,r.kt)("h3",{id:"\u4f7f\u7528ldap\u767b\u5f55\u96c6\u7fa4"},"\u4f7f\u7528LDAP\u767b\u5f55\u96c6\u7fa4"),(0,r.kt)("p",null,"\u8981\u4f7f\u7528LDAP\u8fdb\u884cSCOW\u7cfb\u7edf\u7684\u7528\u6237\u8ba4\u8bc1\uff0c\u60a8\u5fc5\u987b\u914d\u7f6eLDAP\u670d\u52a1\u5668\u548c\u96c6\u7fa4\u4e2d\u7684\u6bcf\u4e2a\u8282\u70b9\uff0c\u4f7f\u5f97\u96c6\u7fa4\u4e2d\u7684\u4efb\u4f55\u8282\u70b9\u90fd\u53ef\u4ee5\u4f7f\u7528LDAP\u7528\u6237\u8282\u70b9\u7684",(0,r.kt)("inlineCode",{parentName:"p"},"ldap.attrs.uid"),"\u5bf9\u5e94\u7684\u5c5e\u6027\u7684\u503c\u548c\u5bc6\u7801\u4f5c\u4e3a\u7528\u6237\u540d\u548c\u5bc6\u7801\u767b\u5f55\u3002\u8bf7\u53c2\u8003",(0,r.kt)("a",{parentName:"p",href:"https://github.com/PKUHPC/SCOW/blob/master/dev/ldap/client.sh"},"client.sh"),"\u914d\u7f6e\u4f7f\u7528LDAP\u670d\u52a1\u5668\u767b\u5f55Linux\u8282\u70b9\u3002"),(0,r.kt)("h3",{id:"\u767b\u5f55"},"\u767b\u5f55"),(0,r.kt)("p",null,"\u5f53\u7528\u6237\u767b\u5f55\u65f6\uff0c\u8ba4\u8bc1\u7cfb\u7edf\u83b7\u5f97\u7528\u6237\u8f93\u5165\u7684\u7528\u6237\u540d\u548c\u5bc6\u7801\uff0c\u8fdb\u884c\u4ee5\u4e0b\u64cd\u4f5c\uff1a"),(0,r.kt)("ol",null,(0,r.kt)("li",{parentName:"ol"},"\u4f7f\u7528",(0,r.kt)("inlineCode",{parentName:"li"},"ldap.bindDn"),"\u548c",(0,r.kt)("inlineCode",{parentName:"li"},"ldap.bindPassword"),"\u4f5c\u4e3a\u7528\u6237\u540d\u548c\u5bc6\u7801\uff0c\u5411LDAP\u670d\u52a1\u5668\u6240\u5728\u7684",(0,r.kt)("inlineCode",{parentName:"li"},"ldap.url"),"\u53d1\u8d77bind\u8bf7\u6c42"),(0,r.kt)("li",{parentName:"ol"},"bind\u6210\u529f\u540e\uff0c\u4ee5",(0,r.kt)("inlineCode",{parentName:"li"},"ldap.searchBase"),"\u4e3a\u641c\u7d22\u6839\uff0c\u4ee5sub\u6a21\u5f0f\uff0c\u4ee5",(0,r.kt)("inlineCode",{parentName:"li"},"ldap.filter")," && (",(0,r.kt)("inlineCode",{parentName:"li"},"ldap.attrs.uid"),"\u7b49\u4e8e\u8f93\u5165\u7684\u7528\u6237\u540d) \u4e3a\u7b5b\u9009\u6761\u4ef6\u641c\u7d22\u8282\u70b9",(0,r.kt)("ol",{parentName:"li"},(0,r.kt)("li",{parentName:"ol"},"\u5982\u679c\u641c\u7d22\u7ed3\u679c\u4e3a\u7a7a\uff0c\u5219\u767b\u5f55\u5931\u8d25"),(0,r.kt)("li",{parentName:"ol"},"\u5982\u679c\u641c\u7d22\u8282\u70b9\u6709\u591a\u4e2a\uff0c\u53d6\u7b2c\u4e00\u4e2a\u7ed3\u679c"))),(0,r.kt)("li",{parentName:"ol"},"\u4ee5",(0,r.kt)("strong",{parentName:"li"},"\u4e0a\u4e00\u4e2a\u7ed3\u679c\u7684DN"),"\u4ee5\u53ca",(0,r.kt)("strong",{parentName:"li"},"\u8f93\u5165\u7684\u5bc6\u7801"),"\u4f5c\u4e3a\u7528\u6237\u540d\u548c\u5bc6\u7801\uff0c\u4e0eLDAP\u670d\u52a1\u5668\u53d1\u8d77bind\u8bf7\u6c42",(0,r.kt)("ol",{parentName:"li"},(0,r.kt)("li",{parentName:"ol"},"\u5982\u679cbind\u5931\u8d25\uff0c\u5219\u767b\u5f55\u5931\u8d25"))),(0,r.kt)("li",{parentName:"ol"},"\u767b\u5f55\u6210\u529f\u3002\u751f\u6210\u4e00\u4e2aUUID\u4f5c\u4e3atoken\uff0c\u5c06token\u4e0e",(0,r.kt)("strong",{parentName:"li"},"\u8f93\u5165\u7684\u7528\u6237\u540d"),"\u5b58\u5165redis"),(0,r.kt)("li",{parentName:"ol"},"\u91cd\u5b9a\u5411\u5230\u7528\u6237\u5728\u767b\u5f55\u65f6\uff0c\u901a\u8fc7querystring\u6307\u5b9a\u7684callback URL\uff0c\u5e76\u4f20\u5165",(0,r.kt)("inlineCode",{parentName:"li"},"token={token}"),"\u4f5c\u4e3aquerystring\u53c2\u6570")),(0,r.kt)("h3",{id:"\u521b\u5efa\u7528\u6237"},"\u521b\u5efa\u7528\u6237"),(0,r.kt)("p",null,"\u7cfb\u7edf\u4f1a\u5bf9\u6bcf\u4e2a\u65b0\u7528\u6237\u521b\u5efa\u4e00\u4e2a\u65b0\u7684LDAP\u8282\u70b9\u8868\u793a\u7528\u6237\uff0c\u5e76\u652f\u6301\u540c\u65f6\u521b\u5efa\u4e00\u4e2aLDAP\u8282\u70b9\u8868\u793a\u7528\u6237\u7684\u7ec4\u3002"),(0,r.kt)("p",null,"\u5f53\u7528\u6237\u5728\u7ba1\u7406\u7cfb\u7edf\u4e2d\u521b\u5efa\u540e\uff0c\u8ba4\u8bc1\u7cfb\u7edf\u83b7\u5f97\u65b0\u7528\u6237\u7684\u7528\u6237\u540d\u3001\u7528\u6237\u59d3\u540d\u3001\u5bc6\u7801\u548c\u90ae\u7bb1\uff0c\u8fdb\u884c\u4ee5\u4e0b\u64cd\u4f5c"),(0,r.kt)("ol",null,(0,r.kt)("li",{parentName:"ol"},"\u4f7f\u7528",(0,r.kt)("inlineCode",{parentName:"li"},"ldap.bindDn"),"\u548c",(0,r.kt)("inlineCode",{parentName:"li"},"ldap.bindPassword"),"\u4f5c\u4e3a\u7528\u6237\u540d\u548c\u5bc6\u7801\u4e0e\u5411LDAP\u670d\u52a1\u5668\u6240\u5728\u7684",(0,r.kt)("inlineCode",{parentName:"li"},"ldap.url"),"\u53d1\u8d77bind\u8bf7\u6c42"),(0,r.kt)("li",{parentName:"ol"},"\u521b\u5efa\u4e00\u4e2a\u65b0\u7684entry\u4f5c\u4e3a\u7528\u6237\uff0c\u5176DN\u4ee5\u53ca\u5c5e\u6027\u503c\u5982\u4e0b\u8868\u6240\u793a")),(0,r.kt)("p",null,"\u8868\u4e2d",(0,r.kt)("inlineCode",{parentName:"p"},"??"),"\u8868\u793a\u5982\u679c\u524d\u9762\u7684\u914d\u7f6e\u503c\u8bbe\u7f6e\u4e86\uff0c\u5c31\u91c7\u7528\u524d\u9762\u7684\u503c\uff0c\u5982\u679c\u6ca1\u6709\u8bbe\u7f6e\uff0c\u5219\u91c7\u7528\u540e\u9762\u7684\u503c\u3002"),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:null},"\u5c5e\u6027\u540d"),(0,r.kt)("th",{parentName:"tr",align:null},"\u503c"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"DN"),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"{ldap.addUser.userIdDnKey ?? ldap.attrs.uid}=\u7528\u6237\u540d,{ldap.addUser.userBase}"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"ldap.attrs.uid")),(0,r.kt)("td",{parentName:"tr",align:null},"\u7528\u6237\u540d")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"sn"),(0,r.kt)("td",{parentName:"tr",align:null},"\u7528\u6237\u540d")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"loginShell"),(0,r.kt)("td",{parentName:"tr",align:null},"/bin/bash")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"objectClass"),(0,r.kt)("td",{parentName:"tr",align:null},'["inetOrgPerson", "posixAccount", "shadowAccount"]')),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"homeDirectory"),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"ldap.addUser.homeDir"),"\uff0c\u5176\u4e2d\u7684",(0,r.kt)("inlineCode",{parentName:"td"},"{{ username }}"),"\u66ff\u6362\u4e3a\u7528\u6237\u540d")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"uidNumber"),(0,r.kt)("td",{parentName:"tr",align:null},"\u6570\u636e\u5e93\u4e2d\u7684\u7528\u6237\u9879\u7684id + ",(0,r.kt)("inlineCode",{parentName:"td"},"ldap.addUser.uidStart"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"gidNumber"),(0,r.kt)("td",{parentName:"tr",align:null},"\u53d6\u51b3\u4e8e",(0,r.kt)("inlineCode",{parentName:"td"},"ldap.groupStrategy"),"\uff0c\u89c1\u4e0b\u6587")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"ldap.attrs.name"),"\uff08\u5982\u679c\u8bbe\u7f6e\u4e86\uff09"),(0,r.kt)("td",{parentName:"tr",align:null},"\u7528\u6237\u59d3\u540d")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"ldap.attrs.mail"),"\uff08\u5982\u679c\u8bbe\u7f6e\u4e86\uff09"),(0,r.kt)("td",{parentName:"tr",align:null},"\u7528\u6237\u7684\u90ae\u7bb1")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"ldap.addUser.extraProps"),"\u4e2d\u7684\u6bcf\u4e2akey"),(0,r.kt)("td",{parentName:"tr",align:null},"key\u5bf9\u5e94\u7684\u503c\uff0c\u5bf9\u5e94\u7684\u503c\u53ef\u4ee5\u4e3a\u5b57\u7b26\u4e32\u3001\u5b57\u7b26\u4e32\u5217\u8868\u6216\u8005",(0,r.kt)("inlineCode",{parentName:"td"},"null"),"\u3002\u5b57\u7b26\u4e32\u6216\u8005\u5b57\u7b26\u4e32\u5217\u8868\u4e2d\u7684\u6bcf\u4e00\u9879\u5176\u4e2d\u7684",(0,r.kt)("inlineCode",{parentName:"td"},"{{ key }}"),"\u66ff\u6362\u4e3a",(0,r.kt)("inlineCode",{parentName:"td"},"key"),"\u672c\u8282\u70b9\u7684\u5bf9\u5e94\u7684\u5c5e\u6027\u7684\u503c\u3002")))),(0,r.kt)("p",null,"\u5982\u679c",(0,r.kt)("inlineCode",{parentName:"p"},"ldap.addUser.extraProps"),"\u4e2d\u5305\u62ec\u5df2\u7ecf\u5b58\u5728\u7684\u5c5e\u6027\u540d\uff0c\u5219\u4f1a\u66ff\u6362\u5bf9\u5e94\u7684\u5c5e\u6027\u3002\u5982\u679c\u8fd9\u91cc\u9762\u67d0\u4e2a\u503c\u4e3a",(0,r.kt)("inlineCode",{parentName:"p"},"null"),"\uff0c\u5219\u4f1a\u5220\u9664\u5bf9\u5e94\u7684\u5c5e\u6027\u3002"),(0,r.kt)("ol",{start:3},(0,r.kt)("li",{parentName:"ol"},"\u914d\u7f6e\u65b0\u7528\u6237\u6240\u5c5e\u7684\u7ec4\u3002")),(0,r.kt)("p",null,"\u5982\u679c",(0,r.kt)("inlineCode",{parentName:"p"},"ldap.addUser.groupStrategy"),"\u8bbe\u7f6e\u4e3a",(0,r.kt)("inlineCode",{parentName:"p"},"oneGroupForAllUsers"),"\uff0c\u5219\u65b0\u7528\u6237\u7684",(0,r.kt)("inlineCode",{parentName:"p"},"gidNumber"),"\u4e3a",(0,r.kt)("inlineCode",{parentName:"p"},"ldap.addUser.oneGroupForAllUsers.gidNumber"),"\u7684\u503c\uff0c\u4e14\u4e0d\u4f1a\u65b0\u5efa\u65b0\u7684\u8868\u793a\u7ec4\u7684LDAP\u8282\u70b9\u3002"),(0,r.kt)("p",null,"\u5982\u679c",(0,r.kt)("inlineCode",{parentName:"p"},"ldap.addUser.groupStrategy"),"\u8bbe\u7f6e\u4e3a",(0,r.kt)("inlineCode",{parentName:"p"},"newGroupPerUser"),"\uff0c\u5219\u65b0\u7528\u6237\u7684",(0,r.kt)("inlineCode",{parentName:"p"},"gidNumber"),"\u7684\u503c\u7b49\u4e8e\u7528\u6237\u7684uidNumber\uff0c\u5e76\u4e14\u4f1a\u521b\u5efa\u4e00\u4e2a\u65b0\u7684LDAP\u8282\u70b9\u4f5c\u4e3a\u65b0\u7528\u6237\u7684group\uff0c\u5176DN\u4ee5\u53ca\u5c5e\u6027\u503c\u5982\u4e0b\u8868\u6240\u793a\u3002"),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:null},"\u5c5e\u6027\u540d"),(0,r.kt)("th",{parentName:"tr",align:null},"\u503c"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"DN"),(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"{ldap.newGroupPerUser.groupIdDnKey ?? ldap.attrs.userId}=\u7528\u6237\u540d,{ldap.addUser.newGroupPerUser.groupBase}"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"objectClass"),(0,r.kt)("td",{parentName:"tr",align:null},'["posixGroup"]')),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"memberUid"),(0,r.kt)("td",{parentName:"tr",align:null},"\u7528\u6237\u540d")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},"gidNumber"),(0,r.kt)("td",{parentName:"tr",align:null},"\u540c\u7528\u6237\u7684uidNumber")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:null},(0,r.kt)("inlineCode",{parentName:"td"},"ldap.addUser.newGroupPerUser.extraProps"),"\u4e2d\u7684\u6bcf\u4e2akey"),(0,r.kt)("td",{parentName:"tr",align:null},"key\u5bf9\u5e94\u7684\u503c\uff0c\u5bf9\u5e94\u7684\u503c\u53ef\u4ee5\u4e3a\u5b57\u7b26\u4e32\u3001\u5b57\u7b26\u4e32\u5217\u8868\u6216\u8005",(0,r.kt)("inlineCode",{parentName:"td"},"null"),"\u3002\u5b57\u7b26\u4e32\u6216\u8005\u5b57\u7b26\u4e32\u5217\u8868\u4e2d\u7684\u6bcf\u4e00\u9879\u5176\u4e2d\u7684",(0,r.kt)("inlineCode",{parentName:"td"},"{{ key }}"),"\u66ff\u6362\u4e3a",(0,r.kt)("inlineCode",{parentName:"td"},"key"),"\u672c\u8282\u70b9\u7684\u5bf9\u5e94\u7684\u5c5e\u6027\u7684\u503c\u3002")))),(0,r.kt)("p",null,"\u5982\u679c",(0,r.kt)("inlineCode",{parentName:"p"},"ldap.addUser.newGroupPerUser.extraProps"),"\u4e2d\u5305\u62ec\u5df2\u7ecf\u5b58\u5728\u7684\u5c5e\u6027\u540d\uff0c\u5219\u4f1a\u66ff\u6362\u5bf9\u5e94\u7684\u5c5e\u6027\u3002\u5982\u679c\u8fd9\u91cc\u9762\u67d0\u4e2a\u503c\u4e3a",(0,r.kt)("inlineCode",{parentName:"p"},"null"),"\uff0c\u5219\u4f1a\u5220\u9664\u5bf9\u5e94\u7684\u5c5e\u6027\u3002"),(0,r.kt)("ol",{start:4},(0,r.kt)("li",{parentName:"ol"},"\u8bbe\u7f6e\u65b0\u7528\u6237\u7684\u5bc6\u7801\u4e3a\u7528\u6237\u8f93\u5165\u7684\u5bc6\u7801")),(0,r.kt)("h2",{id:"\u914d\u7f6eldap\u8ba4\u8bc1\u670d\u52a1"},"\u914d\u7f6eLDAP\u8ba4\u8bc1\u670d\u52a1"),(0,r.kt)("p",null,"\u5728",(0,r.kt)("inlineCode",{parentName:"p"},"config/auth.yml"),"\u4e2d\u8f93\u5165\u4ee5\u4e0b\u5185\u5bb9\uff0c\u5e76\u6839\u636e\u60c5\u51b5\u914d\u7f6e\u3002"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-yaml",metastring:'title="config/auth.yml"',title:'"config/auth.yml"'},'# \u6307\u5b9a\u4f7f\u7528\u8ba4\u8bc1\u7c7b\u578b\u4e3aLDAP\nauthType: ldap\n\n# \u5728\u6b64\u90e8\u5206\u8f93\u5165LDAP\u7684\u914d\u7f6e\nldap:\n  # LDAP\u670d\u52a1\u5668\u5730\u5740\u3002\u5fc5\u586b\n  url: ldap://LDAP\u670d\u52a1\u5668\u5730\u5740\n\n  # \u8fdb\u884cLDAP\u64cd\u4f5c\u7684\u7528\u6237DN\u3002\u9ed8\u8ba4\u4e3a\u7a7a\n  # bindDN: ""\n  # \u8fdb\u884cLDAP\u64cd\u4f5c\u7684\u7528\u6237\u5bc6\u7801\u3002\u9ed8\u8ba4\u4e3a\u7a7a\n  # bindPassword: ""\n\n  # \u5728\u54ea\u4e2a\u8282\u70b9\u4e0b\u641c\u7d22\u8981\u767b\u5f55\u7684\u7528\u6237\u3002\u5fc5\u586b\u3002\n  searchBase: ""\n  # \u641c\u7d22\u767b\u5f55\u7528\u6237\u65f6\u7684\u7b5b\u9009\u5668\u3002\u5fc5\u586b\n  userFilter: "(uid=*)"\n\n  # \u5c5e\u6027\u6620\u5c04\n  attrs:\n    # LDAP\u4e2d\u5bf9\u5e94\u7528\u6237ID\u7684\u5c5e\u6027\u540d\n    uid: uid\n\n    # LDAP\u5bf9\u5e94\u7528\u6237\u59d3\u540d\u7684\u5c5e\u6027\u540d\n    # \u6b64\u5b57\u6bb5\u7528\u4e8e\n    # 1. \u767b\u5f55\u65f6\u663e\u793a\u4e3a\u7528\u6237\u7684\u59d3\u540d\n    # 2. \u521b\u5efa\u7528\u6237\u7684\u65f6\u5019\u628a\u59d3\u540d\u4fe1\u606f\u586b\u5165LDAP\n    # 3. \u7ba1\u7406\u7cfb\u7edf\u6dfb\u52a0\u7528\u6237\u65f6\uff0c\u9a8c\u8bc1ID\u548c\u59d3\u540d\u662f\u5426\u5339\u914d\n    #\n    # \u5982\u679c\u4e0d\u8bbe\u7f6e\u6b64\u5b57\u6bb5\uff0c\u90a3\u4e48\n    # 1. \u7528\u6237\u663e\u793a\u7684\u59d3\u540d\u4e3a\u7528\u6237\u7684ID\n    # 2. \u521b\u5efa\u7528\u6237\u65f6\u59d3\u540d\u4fe1\u606f\u586b\u5165LDAP\n    # 3. \u7ba1\u7406\u7cfb\u7edf\u6dfb\u52a0\u7528\u6237\u65f6\uff0c\u4e0d\u9a8c\u8bc1ID\u4e0e\u59d3\u540d\u662f\u5426\u5339\u914d\n    # name: cn\n\n    # LDAP\u4e2d\u5bf9\u5e94\u7528\u6237\u7684\u90ae\u7bb1\u7684\u5c5e\u6027\u540d\u3002\u53ef\u4e0d\u586b\u3002\u6b64\u5b57\u6bb5\u53ea\u7528\u4e8e\u5728\u521b\u5efa\u7528\u6237\u7684\u65f6\u5019\u628a\u90ae\u4ef6\u4fe1\u606f\u586b\u5165LDAP\u3002\n    # mail: mail\n\n  # \u6dfb\u52a0\u7528\u6237\u7684\u76f8\u5173\u914d\u7f6e\u3002\u53ef\u4e0d\u586b\uff0c\u4e0d\u586b\u7684\u8bddSCOW\u4e0d\u652f\u6301\u521b\u5efa\u7528\u6237\u3002\n  addUser:\n    # \u589e\u52a0\u7528\u6237\u8282\u70b9\u65f6\uff0c\u628a\u7528\u6237\u589e\u52a0\u5230\u54ea\u4e2a\u8282\u70b9\u4e0b\n    userBase: "ou=People,ou={ou},o={dn}"\n\n    # \u7528\u6237\u7684homeDirectory\u503c\u3002\u4f7f\u7528{{ userId }}\u4ee3\u66ff\u65b0\u7528\u6237\u7684\u7528\u6237\u540d\u3002\u9ed8\u8ba4\u5982\u4e0b\n    homeDir: /nfs/{{ userId }}\n\n    # LDAP\u589e\u52a0\u7528\u6237\u65f6\uff0c\u65b0\u7528\u6237\u8282\u70b9\u7684DN\u4e2d\uff0c\u7b2c\u4e00\u4e2a\u8def\u5f84\u7684\u5c5e\u6027\u7684key\u3002\n    # \u65b0\u7528\u6237\u8282\u70b9\u7684DN\u4e3a{userIdDnKey}={\u7528\u6237ID},{userBase}\n    # \u5982\u679c\u4e0d\u586b\u5199\uff0c\u5219\u4f7f\u7528ldap.attrs.uid\u7684\u503c\n    # userIdDnKey: uid\n\n    # \u5982\u4f55\u786e\u5b9a\u65b0\u7528\u6237\u7684\u7ec4\u3002\u53ef\u53d6\u7684\u503c\u5305\u62ec\uff1a\n    # newGroupPerUser: \u7ed9\u6bcf\u4e2a\u7528\u6237\u521b\u5efa\u65b0\u7684\u7ec4\n    # oneGroupForAllUsers: \u4e0d\u521b\u5efa\u65b0\u7684\u7ec4\uff0c\u7ed9\u6240\u6709\u7528\u6237\u8bbe\u5b9a\u4e00\u4e2a\u56fa\u5b9a\u7684\u7ec4\n    groupStrategy: newGroupPerUser\n\n    newGroupPerUser:\n      # \u7528\u6237\u5bf9\u5e94\u7684\u65b0\u7ec4\u5e94\u8be5\u52a0\u5728\u54ea\u4e2a\u8282\u70b9\u4e0b\n      groupBase: "ou=Group,ou={ou},o={dn}"\n\n      # \u65b0\u7684\u7ec4\u8282\u70b9\u7684DN\u4e2d\uff0c\u7b2c\u4e00\u4e2a\u8def\u5f84\u7684\u5c5e\u6027\u7684key\u3002\n      # \u65b0\u7684\u7ec4\u8282\u70b9\u7684DN\u4e3a{groupIdDnKey}={\u7528\u6237ID},{groupBase}\n      # \u5982\u679c\u4e0d\u586b\u5199\uff0c\u5219\u4f7f\u7528ldap.attrs.uid\u7684\u503c\n      # groupIdDnKey: uid\n\n      # \u7ec4\u7684\u8282\u70b9\u5e94\u8be5\u989d\u5916\u62e5\u6709\u7684\u5c5e\u6027\u503c\u3002\u53ef\u4ee5\u4f7f\u7528 {{ \u7528\u6237\u8282\u70b9\u7684\u5c5e\u6027key }}\u6765\u4f7f\u7528\u7528\u6237\u8282\u70b9\u7684\u5c5e\u6027\u503c\n      # extraProps:\n      #   greetings: hello this is group {{ userId }}\n\n    # \u5982\u679cgroupStrategy\u8bbe\u7f6e\u4e3aoneGroupForAllUsers\uff0c\u90a3\u4e48\u5fc5\u987b\u8bbe\u7f6e\u6b64\u5c5e\u6027\n    oneGroupForAllUsers:\n      # \u7528\u6237\u7684gidNumber\u5c5e\u6027\u7684\u503c\n      gidNumber: 5000\n\n    # \u662f\u5426\u5e94\u8be5\u628a\u65b0\u7528\u6237\u52a0\u5230\u54ea\u4e2aLDAP\u7ec4\u4e0b\u3002\u5982\u679c\u4e0d\u586b\uff0c\u5219\u4e0d\u52a0\n    # addUserToLdapGroup: group\n\n    # uid\u4ece\u591a\u5c11\u5f00\u59cb\u3002\u751f\u6210\u7684\u7528\u6237\u7684uid\u7b49\u4e8e\u6b64\u503c\u52a0\u4e0a\u7528\u6237\u8d26\u6237\u4e2d\u521b\u5efa\u7684\u7528\u6237ID\n    # \u9ed8\u8ba4\u5982\u4e0b\n    # uidStart: 66000\n\n    # \u7528\u6237\u9879\u9664\u4e86id\u3001name\u548cmail\uff0c\u8fd8\u5e94\u8be5\u6dfb\u52a0\u54ea\u4e9b\u5c5e\u6027\u3002\u7c7b\u578b\u662f\u4e2adict\n    # \u5982\u679c\u8fd9\u91cc\u51fa\u73b0\u4e86\u540d\u4e3auid, name\u6216email\u7684\u5c5e\u6027\uff0c\u8fd9\u91cc\u7684\u503c\u5c06\u66ff\u4ee3\u7528\u6237\u8f93\u5165\u7684\u503c\u3002\n    # \u5c5e\u6027\u503c\u652f\u6301\u4f7f\u7528 {{ LDAP\u5c5e\u6027\u503ckey }} \u683c\u5f0f\u6765\u4f7f\u7528\u7528\u6237\u586b\u5165\u7684\u503c\u3002\n    # \u4f8b\u5982\uff1asn: "{{ cn }}"\uff0c\u90a3\u4e48\u6dfb\u52a0\u65f6\u5c06\u4f1a\u589e\u52a0\u4e00\u4e2asn\u5c5e\u6027\uff0c\u5176\u503c\u4e3acn\u7684\u5c5e\u6027\uff0c\u5373\u4e3a\u7528\u6237\u8f93\u5165\u7684\u59d3\u540d\n    # extraProps: \n    #   key: value\n')),(0,r.kt)("p",null,"\u589e\u52a0\u597d\u914d\u7f6e\u540e\uff0c\u8fd0\u884c",(0,r.kt)("inlineCode",{parentName:"p"},"./cli compose restart"),"\u91cd\u542f\u7cfb\u7edf\u5373\u53ef\u3002"),(0,r.kt)("h2",{id:"ldap\u5feb\u901f\u914d\u7f6e\u811a\u672c"},"LDAP\u5feb\u901f\u914d\u7f6e\u811a\u672c"),(0,r.kt)("p",null,"\u6211\u4eec\u63d0\u4f9b\u4ee5\u4e0b\u4e24\u4e2a\u811a\u672c\u53ef\u4ee5\u7528\u6765\u5728",(0,r.kt)("strong",{parentName:"p"},"CentOS 7"),"\u73af\u5883\u5feb\u901f\u5b89\u88c5\u548c\u914d\u7f6eLDAP\u670d\u52a1\u5668"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"https://github.com/PKUHPC/SCOW/blob/master/dev/ldap/provider.sh"},"provider.sh"),": \u7528\u4e8e\u914d\u7f6eLDAP\u670d\u52a1\u5668"),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"https://github.com/PKUHPC/SCOW/blob/master/dev/ldap/client.sh"},"client.sh"),": \u7528\u4e8e\u914d\u7f6eLDAP\u5ba2\u6237\u7aef")),(0,r.kt)("p",null,"\u8bf7\u4e0b\u8f7d\u8fd9\u4e24\u4e2a\u6587\u4ef6\uff0c\u4fee\u6539\u4e24\u4e2a\u6587\u4ef6\u5f00\u5934\u90e8\u5206\u7684\u76f8\u5173\u914d\u7f6e\uff08",(0,r.kt)("inlineCode",{parentName:"p"},"Start Configuratin Part"),"\u548c",(0,r.kt)("inlineCode",{parentName:"p"},"End Configuration Part"),"\u4e4b\u95f4\u7684\u53d8\u91cf\uff09\uff0c\u8fd0\u884c\u5373\u53ef\u3002"),(0,r.kt)("p",null,"\u5982\u679c\u60a8\u4f7f\u7528provider.sh\u811a\u672c\u914d\u7f6e\u60a8\u7684\u670d\u52a1\u5668\uff0c\u60a8\u7684LDAP\u76f8\u5173\u914d\u7f6e\u4e3a\u5982\u4e0b\u3002\u5176\u4e2d",(0,r.kt)("inlineCode",{parentName:"p"},"{\u53d8\u91cf}"),"\u66ff\u6362\u4e3aprovider.sh\u4e2d\u7684\u5bf9\u5e94\u53d8\u91cf\u503c\u3002"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-yaml",metastring:'title="config/auth.yml"',title:'"config/auth.yml"'},'\n# ...\u5176\u4ed6\u914d\u7f6e\n\nauthType: ldap\nldap:\n  url: ldap://LDAP\u670d\u52a1\u5668\u5730\u5740\n  bindDN: cn=Manager,ou={ou},o={dn}\n  bindPassword: {adminPasswd}\n  searchBase: "ou={ou},o={dn}"\n  userFilter: "(uid=*)"\n  addUser:\n    userBase: "ou=People,ou={ou},o={dn}"\n    userIdDnKey: uid\n    # \u628ahomeDir\u8bbe\u7f6e\u4e3a\u5171\u4eab\u5b58\u50a8\u4e0a\u7684\u7528\u6237\u7684\u5bb6\u8def\u5f84\n    homeDir: /nfs/{{ userId }} \n\n    groupStrategy: newGroupPerUser\n    newGroupPerUser:\n      groupBase: "ou=Group,ou={ou},o={dn}"\n      groupIdDnKey: cn\n  attrs:\n    uid: uid\n    name: cn\n    mail: mail\n')),(0,r.kt)("h2",{id:"ldap\u955c\u50cf"},"LDAP\u955c\u50cf"),(0,r.kt)("p",null,"\u60a8\u8fd8\u53ef\u4ee5\u4f7f\u7528\u6211\u4eec\u63d0\u4f9b\u7684\u5df2\u7ecf\u914d\u7f6e\u597d\u7684LDAP docker\u955c\u50cf\u8fdb\u884c\u4f53\u9a8c\u3002\u6ce8\u610f\uff0c\u6b64\u955c\u50cf\u4ec5\u7528\u4e8e\u6d4b\u8bd5\u548c\u529f\u80fd\u4f53\u9a8c\uff0c\u8bf7\u52ff\u7528\u4e8e\u751f\u4ea7\u73af\u5883\uff01"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"# \u5728\u6574\u4e2a\u9879\u76ee\u7684\u6839\u76ee\u5f55\u6784\u5efa\u955c\u50cf \ndocker build -f dev/ldap/Dockerfile -t ldap .\n\n# \u542f\u52a8\u955c\u50cf\u3002\u670d\u52a1\u5728389\u7aef\u53e3\u76d1\u542c\u3002\n# \u7ba1\u7406\u5458\u7528\u6237\u4e3acn=Manager,ou=hpc,o=pku\uff0c\u5bc6\u7801\u4e3aadmin\ndocker run -p 389:389 ldap\n")))}k.isMDXComponent=!0}}]);