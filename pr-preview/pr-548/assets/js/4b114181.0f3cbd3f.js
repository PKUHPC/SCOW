"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[1887],{4852:(e,t,r)=>{r.d(t,{Zo:()=>c,kt:()=>u});var a=r(9231);function n(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function l(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,a)}return r}function o(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?l(Object(r),!0).forEach((function(t){n(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):l(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function p(e,t){if(null==e)return{};var r,a,n=function(e,t){if(null==e)return{};var r,a,n={},l=Object.keys(e);for(a=0;a<l.length;a++)r=l[a],t.indexOf(r)>=0||(n[r]=e[r]);return n}(e,t);if(Object.getOwnPropertySymbols){var l=Object.getOwnPropertySymbols(e);for(a=0;a<l.length;a++)r=l[a],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(n[r]=e[r])}return n}var i=a.createContext({}),s=function(e){var t=a.useContext(i),r=t;return e&&(r="function"==typeof e?e(t):o(o({},t),e)),r},c=function(e){var t=s(e.components);return a.createElement(i.Provider,{value:t},e.children)},d={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},m=a.forwardRef((function(e,t){var r=e.components,n=e.mdxType,l=e.originalType,i=e.parentName,c=p(e,["components","mdxType","originalType","parentName"]),m=s(r),u=n,g=m["".concat(i,".").concat(u)]||m[u]||d[u]||l;return r?a.createElement(g,o(o({ref:t},c),{},{components:r})):a.createElement(g,o({ref:t},c))}));function u(e,t){var r=arguments,n=t&&t.mdxType;if("string"==typeof e||n){var l=r.length,o=new Array(l);o[0]=m;var p={};for(var i in t)hasOwnProperty.call(t,i)&&(p[i]=t[i]);p.originalType=e,p.mdxType="string"==typeof e?e:n,o[1]=p;for(var s=2;s<l;s++)o[s]=r[s];return a.createElement.apply(null,o)}return a.createElement.apply(null,r)}m.displayName="MDXCreateElement"},4572:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>i,contentTitle:()=>o,default:()=>d,frontMatter:()=>l,metadata:()=>p,toc:()=>s});var a=r(5675),n=(r(9231),r(4852));const l={sidebar_position:1,title:"\u4f7f\u7528"},o=void 0,p={unversionedId:"deploy/get-started/vagrant/index",id:"deploy/get-started/vagrant/index",title:"\u4f7f\u7528",description:"\u672c\u9879\u76ee\u9762\u5411\u5f00\u53d1\u548c\u6d4b\u8bd5\u4eba\u5458\uff0c\u57fa\u4e8eVagrant\uff0c\u91c7\u7528VirtualBox\u4f5c\u4e3aProvider\uff0c\u63d0\u4f9bslurm+SCOW\u96c6\u7fa4\u4e00\u952e\u90e8\u7f72\u65b9\u6848\uff0c\u6781\u5927\u7b80\u5316\u4e86\u90e8\u7f72\u6d41\u7a0b\u548c\u90e8\u7f72\u95e8\u69db\u3002",source:"@site/docs/deploy/get-started/vagrant/index.md",sourceDirName:"deploy/get-started/vagrant",slug:"/deploy/get-started/vagrant/",permalink:"/SCOW/pr-preview/pr-548/docs/deploy/get-started/vagrant/",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/get-started/vagrant/index.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1,title:"\u4f7f\u7528"},sidebar:"deploy",previous:{title:"vagrant",permalink:"/SCOW/pr-preview/pr-548/docs/category/vagrant"},next:{title:"vagrant\u73af\u5883\u642d\u5efa",permalink:"/SCOW/pr-preview/pr-548/docs/deploy/get-started/vagrant/vagrant-env"}},i={},s=[{value:"1. \u96c6\u7fa4\u4e00\u952e\u90e8\u7f72\u547d\u4ee4",id:"1-\u96c6\u7fa4\u4e00\u952e\u90e8\u7f72\u547d\u4ee4",level:3},{value:"2. \u96c6\u7fa4\u521d\u59cb\u5316",id:"2-\u96c6\u7fa4\u521d\u59cb\u5316",level:3},{value:"3. SCOW\u8fd0\u7ef4\u64cd\u4f5c",id:"3-scow\u8fd0\u7ef4\u64cd\u4f5c",level:3},{value:"4. \u96c6\u7fa4\u4e00\u952e\u9500\u6bc1\u547d\u4ee4",id:"4-\u96c6\u7fa4\u4e00\u952e\u9500\u6bc1\u547d\u4ee4",level:3},{value:"5. \u66f4\u591a\u6587\u6863",id:"5-\u66f4\u591a\u6587\u6863",level:3}],c={toc:s};function d(e){let{components:t,...l}=e;return(0,n.kt)("wrapper",(0,a.Z)({},c,l,{components:t,mdxType:"MDXLayout"}),(0,n.kt)("p",null,"\u672c\u9879\u76ee\u9762\u5411",(0,n.kt)("strong",{parentName:"p"},"\u5f00\u53d1"),"\u548c",(0,n.kt)("strong",{parentName:"p"},"\u6d4b\u8bd5"),"\u4eba\u5458\uff0c\u57fa\u4e8eVagrant\uff0c\u91c7\u7528VirtualBox\u4f5c\u4e3aProvider\uff0c\u63d0\u4f9bslurm+SCOW\u96c6\u7fa4\u4e00\u952e\u90e8\u7f72\u65b9\u6848\uff0c\u6781\u5927\u7b80\u5316\u4e86\u90e8\u7f72\u6d41\u7a0b\u548c\u90e8\u7f72\u95e8\u69db\u3002"),(0,n.kt)("p",null,"\u90e8\u7f72slurm+SCOW\u56db\u8282\u70b9\u96c6\u7fa4\uff0c\u8282\u70b9\u89d2\u8272\u53ca\u9ed8\u8ba4\u914d\u7f6e\u5982\u4e0b\u8868\u6240\u793a\uff1a"),(0,n.kt)("table",null,(0,n.kt)("thead",{parentName:"table"},(0,n.kt)("tr",{parentName:"thead"},(0,n.kt)("th",{parentName:"tr",align:"center"},"\u8282\u70b9\u540d\u79f0/\u89d2\u8272"),(0,n.kt)("th",{parentName:"tr",align:"center"},"\u4e3b\u8981\u670d\u52a1"),(0,n.kt)("th",{parentName:"tr",align:"center"},"\u79c1\u7f51IP"),(0,n.kt)("th",{parentName:"tr",align:"center"},"\u914d\u7f6e"))),(0,n.kt)("tbody",{parentName:"table"},(0,n.kt)("tr",{parentName:"tbody"},(0,n.kt)("td",{parentName:"tr",align:"center"},"scow"),(0,n.kt)("td",{parentName:"tr",align:"center"},"scow\uff1aportal\u3001mis\u3001auth\u3001gateway\u3001export job"),(0,n.kt)("td",{parentName:"tr",align:"center"},"192.168.88.100"),(0,n.kt)("td",{parentName:"tr",align:"center"},"4C4G")),(0,n.kt)("tr",{parentName:"tbody"},(0,n.kt)("td",{parentName:"tr",align:"center"},"slurm"),(0,n.kt)("td",{parentName:"tr",align:"center"},"slurmdbd\u3001slurmctld\u3001slurmd\u3001mariadb\u3001nfs-server\u3001slapd\u3001sssd"),(0,n.kt)("td",{parentName:"tr",align:"center"},"192.168.88.101"),(0,n.kt)("td",{parentName:"tr",align:"center"},"2C2G")),(0,n.kt)("tr",{parentName:"tbody"},(0,n.kt)("td",{parentName:"tr",align:"center"},"login"),(0,n.kt)("td",{parentName:"tr",align:"center"},"slurmd\u3001sssd\u3001nfs\u3001Xfce\u3001KDE\u3001MATE\u3001cinnamon"),(0,n.kt)("td",{parentName:"tr",align:"center"},"192.168.88.102"),(0,n.kt)("td",{parentName:"tr",align:"center"},"2C2G")),(0,n.kt)("tr",{parentName:"tbody"},(0,n.kt)("td",{parentName:"tr",align:"center"},"cn01"),(0,n.kt)("td",{parentName:"tr",align:"center"},"slurmd\u3001sssd\u3001nfs\u3001Xfce\u3001KDE\u3001MATE\u3001cinnamon"),(0,n.kt)("td",{parentName:"tr",align:"center"},"192.168.88.103"),(0,n.kt)("td",{parentName:"tr",align:"center"},"2C2G")))),(0,n.kt)("h3",{id:"1-\u96c6\u7fa4\u4e00\u952e\u90e8\u7f72\u547d\u4ee4"},"1. \u96c6\u7fa4\u4e00\u952e\u90e8\u7f72\u547d\u4ee4"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-shell"},"vagrant up\n")),(0,n.kt)("p",null,(0,n.kt)("img",{src:r(2465).Z,width:"1910",height:"849"})),(0,n.kt)("blockquote",null,(0,n.kt)("ul",{parentName:"blockquote"},(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("p",{parentName:"li"},"\u7b2c\u4e00\u6b21\u90e8\u7f72\u9700\u8981\u4ecevagrant clould\u62c9\u53d6vagrant\u955c\u50cf\uff0c\u901f\u5ea6\u4f1a\u6bd4\u8f83\u6162\uff0c\u8bf7\u8010\u5fc3\u7b49\u5f85\u3002")),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("p",{parentName:"li"},"\u82e5\u955c\u50cf\u6709\u66f4\u65b0\uff0cVagrant\u4e0d\u4f1a\u81ea\u52a8\u91cd\u65b0\u4e0b\u8f7d\uff0c\u8bf7\u5148\u5220\u9664\u539f\u6765\u7684\u955c\u50cf\u3002")))),(0,n.kt)("h3",{id:"2-\u96c6\u7fa4\u521d\u59cb\u5316"},"2. \u96c6\u7fa4\u521d\u59cb\u5316"),(0,n.kt)("blockquote",null,(0,n.kt)("p",{parentName:"blockquote"},"\u521d\u59cb\u5316\u5730\u5740\uff1a",(0,n.kt)("a",{parentName:"p",href:"http://192.168.88.100/mis/init/"},"http://192.168.88.100/mis/init/"),"  \u7528\u6237\u540d/\u5bc6\u7801\uff1ademo_admin/demo_admin")),(0,n.kt)("p",null,"\u8fdb\u5165\u521d\u59cb\u5316\u9875\u9762\uff0c\u9009\u62e9\u521b\u5efa\u521d\u59cb\u7ba1\u7406\u5458\u7528\u6237\uff0c\u5c06",(0,n.kt)("inlineCode",{parentName:"p"},"demo_admin"),"\u8bbe\u7f6e\u4e3a\u7ba1\u7406\u5458\u7528\u6237\u3002\u540e\u7eed\u7528\u6237\u3001\u8d26\u6237\u8bbe\u7f6e\u8bf7\u53c2\u8003\u672c\u9879\u76ee\u64cd\u4f5c\u624b\u518c\u3002"),(0,n.kt)("p",null,(0,n.kt)("img",{alt:"image-20230126081833205",src:r(9180).Z,width:"2210",height:"1224"})),(0,n.kt)("h3",{id:"3-scow\u8fd0\u7ef4\u64cd\u4f5c"},"3. SCOW\u8fd0\u7ef4\u64cd\u4f5c"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-shell"},"#\u767b\u5f55\u5230\u96c6\u7fa4scow\u8282\u70b9\nvagrant ssh scow\n\n# \u8f93\u5165root\u7528\u6237\u5bc6\u7801\uff0c\u5bc6\u7801\u4e3a\uff1avagrant\n\n# \u8fdb\u5165scow\u90e8\u7f72\u76ee\u5f55\n/root/scow/scow-deployment\n\n# \u62c9\u53d6\u6700\u65b0\u955c\u50cf\n./compose.sh pull\n\n# \u91cd\u542f\u670d\u52a1\n./compose.sh down\n./compose.sh up -d\n")),(0,n.kt)("h3",{id:"4-\u96c6\u7fa4\u4e00\u952e\u9500\u6bc1\u547d\u4ee4"},"4. \u96c6\u7fa4\u4e00\u952e\u9500\u6bc1\u547d\u4ee4"),(0,n.kt)("pre",null,(0,n.kt)("code",{parentName:"pre",className:"language-shell"},"vagrant destroy\n")),(0,n.kt)("h3",{id:"5-\u66f4\u591a\u6587\u6863"},"5. \u66f4\u591a\u6587\u6863"),(0,n.kt)("ul",null,(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"/SCOW/pr-preview/pr-548/docs/deploy/get-started/vagrant/vagrant-env"},"vagrant\u73af\u5883\u642d\u5efa")),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"/SCOW/pr-preview/pr-548/docs/deploy/get-started/vagrant/customization"},"\u81ea\u5b9a\u4e49\u90e8\u7f72")),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"/SCOW/pr-preview/pr-548/docs/deploy/get-started/vagrant/images"},"vagrant\u955c\u50cf\u5236\u4f5c")),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"/SCOW/pr-preview/pr-548/docs/deploy/get-started/vagrant/faq"},"FAQ"))))}d.isMDXComponent=!0},9180:(e,t,r)=>{r.d(t,{Z:()=>a});const a=r.p+"assets/images/init-b48915cd077c0934531a81d93ee5d481.png"},2465:(e,t,r)=>{r.d(t,{Z:()=>a});const a=r.p+"assets/images/vagrant-up-ea5a65efcb800612313b2bbbde412c66.png"}}]);