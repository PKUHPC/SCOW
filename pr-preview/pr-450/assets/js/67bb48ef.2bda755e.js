"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[6488],{4852:(e,n,t)=>{t.d(n,{Zo:()=>c,kt:()=>d});var r=t(9231);function a(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function l(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);n&&(r=r.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,r)}return t}function o(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?l(Object(t),!0).forEach((function(n){a(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):l(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function i(e,n){if(null==e)return{};var t,r,a=function(e,n){if(null==e)return{};var t,r,a={},l=Object.keys(e);for(r=0;r<l.length;r++)t=l[r],n.indexOf(t)>=0||(a[t]=e[t]);return a}(e,n);if(Object.getOwnPropertySymbols){var l=Object.getOwnPropertySymbols(e);for(r=0;r<l.length;r++)t=l[r],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(a[t]=e[t])}return a}var p=r.createContext({}),s=function(e){var n=r.useContext(p),t=n;return e&&(t="function"==typeof e?e(n):o(o({},n),e)),t},c=function(e){var n=s(e.components);return r.createElement(p.Provider,{value:n},e.children)},m={inlineCode:"code",wrapper:function(e){var n=e.children;return r.createElement(r.Fragment,{},n)}},u=r.forwardRef((function(e,n){var t=e.components,a=e.mdxType,l=e.originalType,p=e.parentName,c=i(e,["components","mdxType","originalType","parentName"]),u=s(t),d=a,k=u["".concat(p,".").concat(d)]||u[d]||m[d]||l;return t?r.createElement(k,o(o({ref:n},c),{},{components:t})):r.createElement(k,o({ref:n},c))}));function d(e,n){var t=arguments,a=n&&n.mdxType;if("string"==typeof e||a){var l=t.length,o=new Array(l);o[0]=u;var i={};for(var p in n)hasOwnProperty.call(n,p)&&(i[p]=n[p]);i.originalType=e,i.mdxType="string"==typeof e?e:a,o[1]=i;for(var s=2;s<l;s++)o[s]=t[s];return r.createElement.apply(null,o)}return r.createElement.apply(null,t)}u.displayName="MDXCreateElement"},1232:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>p,contentTitle:()=>o,default:()=>m,frontMatter:()=>l,metadata:()=>i,toc:()=>s});var r=t(9675),a=(t(9231),t(4852));const l={sidebar_position:3,title:"\u81ea\u5b9a\u4e49\u90e8\u7f72"},o=void 0,i={unversionedId:"deploy/vagrant/customization",id:"deploy/vagrant/customization",title:"\u81ea\u5b9a\u4e49\u90e8\u7f72",description:"1. \u5982\u4f55\u4fee\u6539\u8282\u70b9\u79c1\u7f51IP",source:"@site/docs/deploy/vagrant/customization.md",sourceDirName:"deploy/vagrant",slug:"/deploy/vagrant/customization",permalink:"/SCOW/pr-preview/pr-450/docs/deploy/vagrant/customization",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/vagrant/customization.md",tags:[],version:"current",sidebarPosition:3,frontMatter:{sidebar_position:3,title:"\u81ea\u5b9a\u4e49\u90e8\u7f72"},sidebar:"deploy",previous:{title:"vagrant\u73af\u5883\u642d\u5efa",permalink:"/SCOW/pr-preview/pr-450/docs/deploy/vagrant/vagrant-env"},next:{title:"vagrant\u955c\u50cf\u5236\u4f5c",permalink:"/SCOW/pr-preview/pr-450/docs/deploy/vagrant/images"}},p={},s=[{value:"1. \u5982\u4f55\u4fee\u6539\u8282\u70b9\u79c1\u7f51IP",id:"1-\u5982\u4f55\u4fee\u6539\u8282\u70b9\u79c1\u7f51ip",level:2},{value:"2. \u5982\u4f55\u65b0\u589e\u8ba1\u7b97\u8282\u70b9",id:"2-\u5982\u4f55\u65b0\u589e\u8ba1\u7b97\u8282\u70b9",level:2}],c={toc:s};function m(e){let{components:n,...t}=e;return(0,a.kt)("wrapper",(0,r.Z)({},c,t,{components:n,mdxType:"MDXLayout"}),(0,a.kt)("h2",{id:"1-\u5982\u4f55\u4fee\u6539\u8282\u70b9\u79c1\u7f51ip"},"1. \u5982\u4f55\u4fee\u6539\u8282\u70b9\u79c1\u7f51IP"),(0,a.kt)("p",null,"\u672c\u65b9\u6848\u5404\u8282\u70b9IP\u4f7f\u7528\u7684\u662f",(0,a.kt)("inlineCode",{parentName:"p"},"private_network"),"\u6a21\u5f0f(Host-Only)\uff0c\u82e5\u4e0d\u4e0e\u5176\u4ed6\u865a\u673aIP\u51b2\u7a81\uff0c\u53ef\u4e0d\u9700\u8981\u4fee\u6539\u76f4\u63a5\u4f7f\u7528\u9ed8\u8ba4\u5373\u53ef\u3002\u5982\u9700\u8981\u4fee\u6539\u8282\u70b9IP\uff0c\u53ef\u53c2\u7167\u5982\u4e0b\u64cd\u4f5c\uff1a"),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"(1) Vagrantfile\u4fee\u6539\uff1a")),(0,a.kt)("p",null,"\u901a\u8fc7\u4fee\u6539",(0,a.kt)("inlineCode",{parentName:"p"},"Vagrantfile"),"\u6587\u4ef6",(0,a.kt)("inlineCode",{parentName:"p"},"vm_list"),"\u4e0b\u5404\u8282\u70b9\u7684",(0,a.kt)("inlineCode",{parentName:"p"},"eth1"),"\u5c5e\u6027\uff0c\u4fee\u6539\u96c6\u7fa4\u4e2d\u5404\u8282\u70b9 \u4f7f\u7528\u7684IP\uff0c\u9700\u4fdd\u8bc1\u8bbe\u7f6e\u7684\u5404\u8282\u70b9IP\u5728\u540c\u4e00\u5c40\u57df\u7f51\u5185\u3002"),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"(2) slurm\u914d\u7f6e\u6587\u4ef6\u4fee\u6539\uff1a")),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("inlineCode",{parentName:"li"},"slurm\\slurm.conf"),"\u6587\u4ef6\u4e2d\u7684nodes\u914d\u7f6e\u90e8\u5206\uff0c\u5c06\u5404\u8282\u70b9IP\u4fee\u6539\u4e3a\u4e0e",(0,a.kt)("inlineCode",{parentName:"li"},"vm_list"),"\u4e2d\u914d\u7f6e\u7684\u4e00\u81f4\uff1b"),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("inlineCode",{parentName:"li"},"slurm\\ldap_client.sh"),"\u6587\u4ef6\u4e2d",(0,a.kt)("inlineCode",{parentName:"li"},"ServHost"),"\u6539\u4e3aslurm\u8282\u70b9IP\uff1b"),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("inlineCode",{parentName:"li"},"slurm\\nfs_client.sh"),"\u6587\u4ef6\u4e2d\u7684",(0,a.kt)("inlineCode",{parentName:"li"},"192.168.88.101"),"\u6539\u4e3aslurm\u8282\u70b9IP\u3002")),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"(3) SCOW\u914d\u7f6e\u6587\u4ef6\u4fee\u6539\uff1a")),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("inlineCode",{parentName:"li"},"scow\\scow-deployment\\config\\auth.yml"),"\u6587\u4ef6\u4e2d\u7684",(0,a.kt)("inlineCode",{parentName:"li"},"ldap.url"),"\u7684IP\u6539\u4e3aslurm\u8282\u70b9IP\uff1b"),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("inlineCode",{parentName:"li"},"scow\\scow-deployment\\config\\mis.yaml"),"\u6587\u4ef6\u4e2d",(0,a.kt)("inlineCode",{parentName:"li"},"fetchJobs.db.host"),"\u6539\u4e3ascow\u8282\u70b9IP\uff1b"),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("inlineCode",{parentName:"li"},"scow\\scow-deployment\\config\\clusters\\hpc01.yaml"),"\u6587\u6863\u4e2d",(0,a.kt)("inlineCode",{parentName:"li"},"slurm.mis.managerUrl"),"\u6539\u4e3aslurm\u8282\u70b9IP\u3002")),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"(4) export job\u914d\u7f6e\u6587\u4ef6\u4fee\u6539\uff1a")),(0,a.kt)("p",null,(0,a.kt)("inlineCode",{parentName:"p"},"scow\\export-jobs\\config.py"),"\u6587\u4ef6\u4e2d\u7684",(0,a.kt)("inlineCode",{parentName:"p"},"cluster_db_conf.host"),"\u6539\u4e3aslurm\u8282\u70b9IP\uff0c",(0,a.kt)("inlineCode",{parentName:"p"},"mgt_db_conf.host"),"scow\u8282\u70b9IP\u3002"),(0,a.kt)("p",null,"\u4ee5\u4e0a\u914d\u7f6e\u4fee\u6539\u5b8c\u6210\u4e4b\u540e\u6267\u884c\u90e8\u7f72\u547d\u4ee4\uff1a"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-shell"},"vagrant up\n")),(0,a.kt)("h2",{id:"2-\u5982\u4f55\u65b0\u589e\u8ba1\u7b97\u8282\u70b9"},"2. \u5982\u4f55\u65b0\u589e\u8ba1\u7b97\u8282\u70b9"),(0,a.kt)("p",null,"\u4ee5\u6dfb\u52a0\u8ba1\u7b97\u8282\u70b9",(0,a.kt)("inlineCode",{parentName:"p"},"cn02"),"\u4e3a\u4f8b\uff0c",(0,a.kt)("inlineCode",{parentName:"p"},"Vagrantfile"),"\u6587\u4ef6",(0,a.kt)("inlineCode",{parentName:"p"},"vm_list"),"\u4e2d\u590d\u5236\u4e00\u4efd",(0,a.kt)("inlineCode",{parentName:"p"},"cn01"),"\u7684\u914d\u7f6e\uff0c\u5e76\u505a\u5982\u4e0b\u4fee\u6539\uff1a"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-shell"},'    {\n        :name => "cn02",\n        :eth1 => "192.168.88.104",\n        :mem => "4096",\n        :cpu => "4",\n        :sshport => 22234,\n        :box => "icode/slurm_compute",\n        :role => "slurm",\n        :is_service_node => false\n    }\n')),(0,a.kt)("blockquote",null,(0,a.kt)("p",{parentName:"blockquote"},"\u6ce8\u610f\u4fee\u6539name\uff0ceth1\uff0csshport\u7684\u503c\uff0c\u53ef\u4e0d\u4fee\u6539\u5176\u4ed6\u5c5e\u6027\u503c\u3002")),(0,a.kt)("p",null,(0,a.kt)("inlineCode",{parentName:"p"},"slurm\\slurm.conf"),"\u6587\u4ef6\u4e2d\u4fee\u6539\u8ba1\u7b97\u8282\u70b9\u548c\u5206\u533a\u914d\u7f6e\u4fe1\u606f\u90e8\u5206\uff1a"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-shell"},"# NODES \u914d\u7f6e\u90e8\u5206\u5c06cn02\u8282\u70b9\u52a0\u5165 \nNodeName=cn0[1-2] NodeAddr=192.168.88.10[3-4]  CPUs=4 CoresPerSocket=2 ThreadsPerCore=1 RealMemory=3500 Procs=1 State=UNKNOWN\n\n# PARTITIONS \u914d\u7f6e\u90e8\u5206\u5c06cn02\u8282\u70b9\u52a0\u5165              \nPartitionName=compute Nodes=cn0[1-2] Default=YES MaxTime=INFINITE State=UP\n\n")),(0,a.kt)("p",null,(0,a.kt)("inlineCode",{parentName:"p"},"scow\\scow-deployment\\config\\clusters\\hpc01.yaml"),"\u4fee\u6539\u8282\u70b9\u548c\u5206\u533a\u914d\u7f6e\uff1a"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-yaml"},"# ...\nslurm:\n  loginNodes:\n    - login\n \n  computeNodes:\n    - cn01\n    - cn02      # \u589e\u52a0cn02\n\n  partitions:\n    - name: compute\n      # \u5206\u533a\u5185\u8282\u70b9\u6570\u4fee\u6539\u4e3a2\n      nodes: 2\n\n# ...\n")),(0,a.kt)("p",null,"\u4ee5\u4e0a\u914d\u7f6e\u4fee\u6539\u5b8c\u6210\u4e4b\u540e\u6267\u884c\u90e8\u7f72\u547d\u4ee4\uff1a"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-shell"},"vagrant up\n")))}m.isMDXComponent=!0}}]);