"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[6814],{4852:(e,n,t)=>{t.d(n,{Zo:()=>p,kt:()=>m});var r=t(9231);function s(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function a(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);n&&(r=r.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,r)}return t}function o(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?a(Object(t),!0).forEach((function(n){s(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):a(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function i(e,n){if(null==e)return{};var t,r,s=function(e,n){if(null==e)return{};var t,r,s={},a=Object.keys(e);for(r=0;r<a.length;r++)t=a[r],n.indexOf(t)>=0||(s[t]=e[t]);return s}(e,n);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(r=0;r<a.length;r++)t=a[r],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(s[t]=e[t])}return s}var l=r.createContext({}),c=function(e){var n=r.useContext(l),t=n;return e&&(t="function"==typeof e?e(n):o(o({},n),e)),t},p=function(e){var n=c(e.components);return r.createElement(l.Provider,{value:n},e.children)},u={inlineCode:"code",wrapper:function(e){var n=e.children;return r.createElement(r.Fragment,{},n)}},d=r.forwardRef((function(e,n){var t=e.components,s=e.mdxType,a=e.originalType,l=e.parentName,p=i(e,["components","mdxType","originalType","parentName"]),d=c(t),m=s,f=d["".concat(l,".").concat(m)]||d[m]||u[m]||a;return t?r.createElement(f,o(o({ref:n},p),{},{components:t})):r.createElement(f,o({ref:n},p))}));function m(e,n){var t=arguments,s=n&&n.mdxType;if("string"==typeof e||s){var a=t.length,o=new Array(a);o[0]=d;var i={};for(var l in n)hasOwnProperty.call(n,l)&&(i[l]=n[l]);i.originalType=e,i.mdxType="string"==typeof e?e:s,o[1]=i;for(var c=2;c<a;c++)o[c]=t[c];return r.createElement.apply(null,o)}return r.createElement.apply(null,t)}d.displayName="MDXCreateElement"},6670:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>l,contentTitle:()=>o,default:()=>u,frontMatter:()=>a,metadata:()=>i,toc:()=>c});var r=t(9675),s=(t(9231),t(4852));const a={sidebar_label:"\u57fa\u7840\u914d\u7f6e",title:"\u57fa\u7840\u914d\u7f6e",slug:"/basic-config",sidebar_position:3},o=void 0,i={unversionedId:"deploy/slurm/basic-config",id:"deploy/slurm/basic-config",title:"\u57fa\u7840\u914d\u7f6e",description:"1. \u6240\u6709\u8282\u70b9",source:"@site/docs/deploy/slurm/basic-config.md",sourceDirName:"deploy/slurm",slug:"/basic-config",permalink:"/SCOW/pr-preview/pr-390/docs/basic-config",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/deploy/slurm/basic-config.md",tags:[],version:"current",sidebarPosition:3,frontMatter:{sidebar_label:"\u57fa\u7840\u914d\u7f6e",title:"\u57fa\u7840\u914d\u7f6e",slug:"/basic-config",sidebar_position:3},sidebar:"deploy",previous:{title:"\u96c6\u7fa4\u89c4\u5212",permalink:"/SCOW/pr-preview/pr-390/docs/deploy/slurm/plan"},next:{title:"NFS\u5b89\u88c5\u548c\u914d\u7f6e",permalink:"/SCOW/pr-preview/pr-390/docs/deploy/slurm/nfs"}},l={},c=[{value:"1. \u6240\u6709\u8282\u70b9",id:"1-\u6240\u6709\u8282\u70b9",level:2},{value:"2. \u670d\u52a1\u8282\u70b9",id:"2-\u670d\u52a1\u8282\u70b9",level:2}],p={toc:c};function u(e){let{components:n,...t}=e;return(0,s.kt)("wrapper",(0,r.Z)({},p,t,{components:n,mdxType:"MDXLayout"}),(0,s.kt)("h2",{id:"1-\u6240\u6709\u8282\u70b9"},"1. \u6240\u6709\u8282\u70b9"),(0,s.kt)("p",null,"\u8bbe\u7f6e\u4e3b\u673a\u540d"),(0,s.kt)("pre",null,(0,s.kt)("code",{parentName:"pre",className:"language-Bash"},"hostnamectl set-hostname manage01\nhostnamectl set-hostname login01\nhostnamectl set-hostname compute01\nhostnamectl set-hostname compute02\n")),(0,s.kt)("p",null,"\u914d\u7f6ehosts\uff1a"),(0,s.kt)("pre",null,(0,s.kt)("code",{parentName:"pre",className:"language-Bash"},"vim /etc/hosts\n192.168.29.106 manage01\n192.168.29.101 login01\n192.168.29.102 compute01\n192.168.29.103 compute02\n")),(0,s.kt)("p",null,"\u5173\u95ed\u9632\u706b\u5899\u3001selinux\u3001dnsmasq\u3001swap\uff1a"),(0,s.kt)("pre",null,(0,s.kt)("code",{parentName:"pre",className:"language-SQL"},"systemctl disable --now firewalld \nsystemctl disable --now dnsmasq\nsystemctl disable --now NetworkManager\n\nsetenforce 0\nsed -i 's#SELINUX=permissive#SELINUX=disabled#g' /etc/sysconfig/selinux\nsed -i 's#SELINUX=permissive#SELINUX=disabled#g' /etc/selinux/config\nreboot\ngetenforce\n\n\nswapoff -a && sysctl -w vm.swappiness=0\nsed -ri '/^[^#]*swap/s@^@#@' /etc/fstab\n")),(0,s.kt)("p",null,"\u65f6\u95f4\u540c\u6b65\uff1a"),(0,s.kt)("pre",null,(0,s.kt)("code",{parentName:"pre",className:"language-Bash"},"# \u5b89\u88c5ntpdate\nrpm -ivh http://mirrors.wlnmp.com/centos/wlnmp-release-centos.noarch.rpm\nyum install ntpdate -y\n\n# \u540c\u6b65\u65f6\u95f4\u3002time2.aliyun.com\u5916\u7f51\uff0cvineyard.pku.edu.cn\u5185\u7f51\n# \u65f6\u95f4\u540c\u6b65\u914d\u7f6e\u5982\u4e0b\uff1a\nln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime\necho 'Asia/Shanghai' >/etc/timezone\nntpdate vineyard.pku.edu.cn\n\n# \u52a0\u5165\u5230crontab\ncrontab -e\n*/5 * * * * /usr/sbin/ntpdate vineyard.pku.edu.cn \n")),(0,s.kt)("h2",{id:"2-\u670d\u52a1\u8282\u70b9"},"2. \u670d\u52a1\u8282\u70b9"),(0,s.kt)("p",null,"\u5230\u5176\u4ed6\u8282\u70b9\u7684\u514d\u5bc6\u767b\u5f55\uff1a"),(0,s.kt)("pre",null,(0,s.kt)("code",{parentName:"pre",className:"language-Bash"},"yum install sshpass -y\nmkdir -p /extend/shell\n\n#\u751f\u6210\u811a\u672c\uff0croot123 \u4e3aroot\u7528\u6237\u5bc6\u7801\ncat >>/extend/shell/fenfa_pub.sh<< EOF\n#!/bin/bash\nssh-keygen -t rsa -f ~/.ssh/id_rsa -P ''\nfor ip in 101 102 103 \ndo\nsshpass -proot123 ssh-copy-id -o StrictHostKeyChecking=no 192.168.29.\\$ip\ndone\nEOF\n\n# \u8d4b\u6743\ncd /extend/shell\nchmod +x fenfa_pub.sh\n# \u6267\u884c\u811a\u672c\n ./fenfa_pub.sh\n")))}u.isMDXComponent=!0}}]);