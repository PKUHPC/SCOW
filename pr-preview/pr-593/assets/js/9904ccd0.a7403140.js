"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[1051],{4852:(e,t,r)=>{r.d(t,{Zo:()=>d,kt:()=>f});var n=r(9231);function i(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function p(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function a(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?p(Object(r),!0).forEach((function(t){i(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):p(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function l(e,t){if(null==e)return{};var r,n,i=function(e,t){if(null==e)return{};var r,n,i={},p=Object.keys(e);for(n=0;n<p.length;n++)r=p[n],t.indexOf(r)>=0||(i[r]=e[r]);return i}(e,t);if(Object.getOwnPropertySymbols){var p=Object.getOwnPropertySymbols(e);for(n=0;n<p.length;n++)r=p[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(i[r]=e[r])}return i}var o=n.createContext({}),s=function(e){var t=n.useContext(o),r=t;return e&&(r="function"==typeof e?e(t):a(a({},t),e)),r},d=function(e){var t=s(e.components);return n.createElement(o.Provider,{value:t},e.children)},u="mdxType",m={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},c=n.forwardRef((function(e,t){var r=e.components,i=e.mdxType,p=e.originalType,o=e.parentName,d=l(e,["components","mdxType","originalType","parentName"]),u=s(r),c=i,f=u["".concat(o,".").concat(c)]||u[c]||m[c]||p;return r?n.createElement(f,a(a({ref:t},d),{},{components:r})):n.createElement(f,a({ref:t},d))}));function f(e,t){var r=arguments,i=t&&t.mdxType;if("string"==typeof e||i){var p=r.length,a=new Array(p);a[0]=c;var l={};for(var o in t)hasOwnProperty.call(t,o)&&(l[o]=t[o]);l.originalType=e,l[u]="string"==typeof e?e:i,a[1]=l;for(var s=2;s<p;s++)a[s]=r[s];return n.createElement.apply(null,a)}return n.createElement.apply(null,r)}c.displayName="MDXCreateElement"},5815:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>o,contentTitle:()=>a,default:()=>m,frontMatter:()=>p,metadata:()=>l,toc:()=>s});var n=r(5675),i=(r(9231),r(4852));const p={},a=void 0,l={unversionedId:"refs/config/cluster/definition-properties-slurm",id:"refs/config/cluster/definition-properties-slurm",title:"definition-properties-slurm",description:"slurm Type",source:"@site/docs/refs/config/cluster/definition-properties-slurm.md",sourceDirName:"refs/config/cluster",slug:"/refs/config/cluster/definition-properties-slurm",permalink:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/refs/config/cluster/definition-properties-slurm.md",tags:[],version:"current",frontMatter:{},sidebar:"refs",previous:{title:"definition-properties-slurm-properties-partitions",permalink:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-partitions"},next:{title:"definition",permalink:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition"}},o={},s=[{value:"slurm Type",id:"slurm-type",level:2},{value:"loginNodes",id:"loginnodes",level:2},{value:"loginNodes Type",id:"loginnodes-type",level:3},{value:"loginNodes Default Value",id:"loginnodes-default-value",level:3},{value:"computeNodes",id:"computenodes",level:2},{value:"computeNodes Type",id:"computenodes-type",level:3},{value:"computeNodes Default Value",id:"computenodes-default-value",level:3},{value:"partitions",id:"partitions",level:2},{value:"partitions Type",id:"partitions-type",level:3},{value:"mis",id:"mis",level:2},{value:"mis Type",id:"mis-type",level:3}],d={toc:s},u="wrapper";function m(e){let{components:t,...r}=e;return(0,i.kt)(u,(0,n.Z)({},d,r,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("h2",{id:"slurm-type"},"slurm Type"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"object")," (",(0,i.kt)("a",{parentName:"p",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm"},"Details"),")"),(0,i.kt)("h1",{id:"slurm-properties"},"slurm Properties"),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:"left"},"Property"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Type"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Required"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Nullable"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Defined by"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"#loginnodes"},"loginNodes")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"array")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Required"),(0,i.kt)("td",{parentName:"tr",align:"left"},"cannot be null"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-loginnodes",title:"undefined#/properties/slurm/properties/loginNodes"},"Untitled schema"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"#computenodes"},"computeNodes")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"array")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Required"),(0,i.kt)("td",{parentName:"tr",align:"left"},"cannot be null"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-computenodes",title:"undefined#/properties/slurm/properties/computeNodes"},"Untitled schema"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"#partitions"},"partitions")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"object")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Required"),(0,i.kt)("td",{parentName:"tr",align:"left"},"cannot be null"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-partitions",title:"undefined#/properties/slurm/properties/partitions"},"Untitled schema"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"#mis"},"mis")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"object")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Optional"),(0,i.kt)("td",{parentName:"tr",align:"left"},"cannot be null"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("a",{parentName:"td",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-mis",title:"undefined#/properties/slurm/properties/mis"},"Untitled schema"))))),(0,i.kt)("h2",{id:"loginnodes"},"loginNodes"),(0,i.kt)("p",null,"\u96c6\u7fa4\u7684\u767b\u5f55\u8282\u70b9\u5730\u5740"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"loginNodes")),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"is required")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"Type: ",(0,i.kt)("inlineCode",{parentName:"p"},"string[]"))),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"cannot be null")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"defined in: ",(0,i.kt)("a",{parentName:"p",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-loginnodes",title:"undefined#/properties/slurm/properties/loginNodes"},"Untitled schema")))),(0,i.kt)("h3",{id:"loginnodes-type"},"loginNodes Type"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"string[]")),(0,i.kt)("h3",{id:"loginnodes-default-value"},"loginNodes Default Value"),(0,i.kt)("p",null,"The default value is:"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-json"},"[]\n")),(0,i.kt)("h2",{id:"computenodes"},"computeNodes"),(0,i.kt)("p",null,"\u96c6\u7fa4\u7684\u8ba1\u7b97\u8282\u70b9\u5730\u5740"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"computeNodes")),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"is required")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"Type: ",(0,i.kt)("inlineCode",{parentName:"p"},"string[]"))),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"cannot be null")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"defined in: ",(0,i.kt)("a",{parentName:"p",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-computenodes",title:"undefined#/properties/slurm/properties/computeNodes"},"Untitled schema")))),(0,i.kt)("h3",{id:"computenodes-type"},"computeNodes Type"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"string[]")),(0,i.kt)("h3",{id:"computenodes-default-value"},"computeNodes Default Value"),(0,i.kt)("p",null,"The default value is:"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-json"},"[]\n")),(0,i.kt)("h2",{id:"partitions"},"partitions"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"partitions")),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"is required")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"Type: ",(0,i.kt)("inlineCode",{parentName:"p"},"object")," (",(0,i.kt)("a",{parentName:"p",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-partitions"},"Details"),")")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"cannot be null")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"defined in: ",(0,i.kt)("a",{parentName:"p",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-partitions",title:"undefined#/properties/slurm/properties/partitions"},"Untitled schema")))),(0,i.kt)("h3",{id:"partitions-type"},"partitions Type"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"object")," (",(0,i.kt)("a",{parentName:"p",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-partitions"},"Details"),")"),(0,i.kt)("h2",{id:"mis"},"mis"),(0,i.kt)("p",null,"slurm\u7684MIS\u914d\u7f6e"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"mis")),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"is optional")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"Type: ",(0,i.kt)("inlineCode",{parentName:"p"},"object")," (",(0,i.kt)("a",{parentName:"p",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-mis"},"Details"),")")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"cannot be null")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"defined in: ",(0,i.kt)("a",{parentName:"p",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-mis",title:"undefined#/properties/slurm/properties/mis"},"Untitled schema")))),(0,i.kt)("h3",{id:"mis-type"},"mis Type"),(0,i.kt)("p",null,(0,i.kt)("inlineCode",{parentName:"p"},"object")," (",(0,i.kt)("a",{parentName:"p",href:"/SCOW/pr-preview/pr-593/docs/refs/config/cluster/definition-properties-slurm-properties-mis"},"Details"),")"))}m.isMDXComponent=!0}}]);