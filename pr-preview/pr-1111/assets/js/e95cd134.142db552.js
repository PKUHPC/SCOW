"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[245],{58512:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>r,contentTitle:()=>a,default:()=>p,frontMatter:()=>i,metadata:()=>o,toc:()=>l});var t=s(35250),c=s(57766);const i={sidebar_label:"\u57fa\u7840\u914d\u7f6e",title:"\u57fa\u7840\u914d\u7f6e",slug:"/basic-config",sidebar_position:3},a=void 0,o={id:"hpccluster/basic-config",title:"\u57fa\u7840\u914d\u7f6e",description:"1. \u6240\u6709\u8282\u70b9",source:"@site/docs/hpccluster/basic-config.md",sourceDirName:"hpccluster",slug:"/basic-config",permalink:"/SCOW/pr-preview/pr-1111/docs/basic-config",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/hpccluster/basic-config.md",tags:[],version:"current",sidebarPosition:3,frontMatter:{sidebar_label:"\u57fa\u7840\u914d\u7f6e",title:"\u57fa\u7840\u914d\u7f6e",slug:"/basic-config",sidebar_position:3},sidebar:"hpccluster",previous:{title:"\u96c6\u7fa4\u89c4\u5212",permalink:"/SCOW/pr-preview/pr-1111/docs/hpccluster/plan"},next:{title:"NFS\u5b89\u88c5\u548c\u914d\u7f6e",permalink:"/SCOW/pr-preview/pr-1111/docs/hpccluster/nfs"}},r={},l=[{value:"1. \u6240\u6709\u8282\u70b9",id:"1-\u6240\u6709\u8282\u70b9",level:2},{value:"2. \u670d\u52a1\u8282\u70b9",id:"2-\u670d\u52a1\u8282\u70b9",level:2}];function d(e){const n={code:"code",h2:"h2",p:"p",pre:"pre",...(0,c.a)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h2,{id:"1-\u6240\u6709\u8282\u70b9",children:"1. \u6240\u6709\u8282\u70b9"}),"\n",(0,t.jsx)(n.p,{children:"\u8bbe\u7f6e\u4e3b\u673a\u540d"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-Bash",children:"hostnamectl set-hostname manage01\nhostnamectl set-hostname login01\nhostnamectl set-hostname compute01\nhostnamectl set-hostname compute02\n"})}),"\n",(0,t.jsx)(n.p,{children:"\u914d\u7f6ehosts\uff1a"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-Bash",children:"vim /etc/hosts\n192.168.29.106 manage01\n192.168.29.101 login01\n192.168.29.102 compute01\n192.168.29.103 compute02\n"})}),"\n",(0,t.jsx)(n.p,{children:"\u5173\u95ed\u9632\u706b\u5899\u3001selinux\u3001dnsmasq\u3001swap\uff1a"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-SQL",children:"systemctl disable --now firewalld \nsystemctl disable --now dnsmasq\nsystemctl disable --now NetworkManager\n\nsetenforce 0\nsed -i 's#SELINUX=permissive#SELINUX=disabled#g' /etc/sysconfig/selinux\nsed -i 's#SELINUX=permissive#SELINUX=disabled#g' /etc/selinux/config\nreboot\ngetenforce\n\n\nswapoff -a && sysctl -w vm.swappiness=0\nsed -ri '/^[^#]*swap/s@^@#@' /etc/fstab\n"})}),"\n",(0,t.jsx)(n.p,{children:"\u65f6\u95f4\u540c\u6b65\uff1a"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-Bash",children:"# \u5b89\u88c5ntpdate\nrpm -ivh http://mirrors.wlnmp.com/centos/wlnmp-release-centos.noarch.rpm\nyum install ntpdate -y\n\n# \u540c\u6b65\u65f6\u95f4\u3002time2.aliyun.com\u5916\u7f51\uff0cvineyard.pku.edu.cn\u5185\u7f51\n# \u65f6\u95f4\u540c\u6b65\u914d\u7f6e\u5982\u4e0b\uff1a\nln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime\necho 'Asia/Shanghai' >/etc/timezone\nntpdate vineyard.pku.edu.cn\n\n# \u52a0\u5165\u5230crontab\ncrontab -e\n*/5 * * * * /usr/sbin/ntpdate vineyard.pku.edu.cn \n"})}),"\n",(0,t.jsx)(n.h2,{id:"2-\u670d\u52a1\u8282\u70b9",children:"2. \u670d\u52a1\u8282\u70b9"}),"\n",(0,t.jsx)(n.p,{children:"\u5230\u5176\u4ed6\u8282\u70b9\u7684\u514d\u5bc6\u767b\u5f55\uff1a"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-Bash",children:"yum install sshpass -y\nmkdir -p /extend/shell\n\n#\u751f\u6210\u811a\u672c\uff0croot123 \u4e3aroot\u7528\u6237\u5bc6\u7801\ncat >>/extend/shell/fenfa_pub.sh<< EOF\n#!/bin/bash\nssh-keygen -t rsa -f ~/.ssh/id_rsa -P ''\nfor ip in 101 102 103 \ndo\nsshpass -proot123 ssh-copy-id -o StrictHostKeyChecking=no 192.168.29.\\$ip\ndone\nEOF\n\n# \u8d4b\u6743\ncd /extend/shell\nchmod +x fenfa_pub.sh\n# \u6267\u884c\u811a\u672c\n ./fenfa_pub.sh\n"})})]})}function p(e={}){const{wrapper:n}={...(0,c.a)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(d,{...e})}):d(e)}},57766:(e,n,s)=>{s.d(n,{Z:()=>o,a:()=>a});var t=s(70079);const c={},i=t.createContext(c);function a(e){const n=t.useContext(i);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(c):e.components||c:a(e.components),t.createElement(i.Provider,{value:n},e.children)}}}]);