"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[7469],{33414:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>_,contentTitle:()=>k,default:()=>q,frontMatter:()=>P,metadata:()=>S,toc:()=>V});var r=t(49214),s=t(5409),l=t(48318),i=t(23372),c=t(10194),a=t(66325),o=t(10983),u=t(36391),d=t(30988),h=t(12922);function p(e){return l.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,l.isValidElement)(e)&&function(e){const{props:n}=e;return!!n&&"object"==typeof n&&"value"in n}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function m(e){const{values:n,children:t}=e;return(0,l.useMemo)((()=>{const e=n??function(e){return p(e).map((e=>{let{props:{value:n,label:t,attributes:r,default:s}}=e;return{value:n,label:t,attributes:r,default:s}}))}(t);return function(e){const n=(0,d.X)(e,((e,n)=>e.value===n.value));if(n.length>0)throw new Error(`Docusaurus error: Duplicate values "${n.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[n,t])}function x(e){let{value:n,tabValues:t}=e;return t.some((e=>e.value===n))}function j(e){let{queryString:n=!1,groupId:t}=e;const r=(0,a.W6)(),s=function(e){let{queryString:n=!1,groupId:t}=e;if("string"==typeof n)return n;if(!1===n)return null;if(!0===n&&!t)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return t??null}({queryString:n,groupId:t});return[(0,u.aZ)(s),(0,l.useCallback)((e=>{if(!s)return;const n=new URLSearchParams(r.location.search);n.set(s,e),r.replace({...r.location,search:n.toString()})}),[s,r])]}function b(e){const{defaultValue:n,queryString:t=!1,groupId:r}=e,s=m(e),[i,c]=(0,l.useState)((()=>function(e){let{defaultValue:n,tabValues:t}=e;if(0===t.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(n){if(!x({value:n,tabValues:t}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${n}" but none of its children has the corresponding value. Available values are: ${t.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return n}const r=t.find((e=>e.default))??t[0];if(!r)throw new Error("Unexpected error: 0 tabValues");return r.value}({defaultValue:n,tabValues:s}))),[a,u]=j({queryString:t,groupId:r}),[d,p]=function(e){let{groupId:n}=e;const t=function(e){return e?`docusaurus.tab.${e}`:null}(n),[r,s]=(0,h.Dv)(t);return[r,(0,l.useCallback)((e=>{t&&s.set(e)}),[t,s])]}({groupId:r}),b=(()=>{const e=a??d;return x({value:e,tabValues:s})?e:null})();(0,o.A)((()=>{b&&c(b)}),[b]);return{selectedValue:i,selectValue:(0,l.useCallback)((e=>{if(!x({value:e,tabValues:s}))throw new Error(`Can't select invalid tab value=${e}`);c(e),u(e),p(e)}),[u,p,s]),tabValues:s}}var f=t(68933);const g={tabList:"tabList_yu9l",tabItem:"tabItem_ET3Y"};function v(e){let{className:n,block:t,selectedValue:s,selectValue:l,tabValues:a}=e;const o=[],{blockElementScrollPositionUntilNextRender:u}=(0,c.a_)(),d=e=>{const n=e.currentTarget,t=o.indexOf(n),r=a[t].value;r!==s&&(u(n),l(r))},h=e=>{let n=null;switch(e.key){case"Enter":d(e);break;case"ArrowRight":{const t=o.indexOf(e.currentTarget)+1;n=o[t]??o[0];break}case"ArrowLeft":{const t=o.indexOf(e.currentTarget)-1;n=o[t]??o[o.length-1];break}}n?.focus()};return(0,r.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,i.A)("tabs",{"tabs--block":t},n),children:a.map((e=>{let{value:n,label:t,attributes:l}=e;return(0,r.jsx)("li",{role:"tab",tabIndex:s===n?0:-1,"aria-selected":s===n,ref:e=>o.push(e),onKeyDown:h,onClick:d,...l,className:(0,i.A)("tabs__item",g.tabItem,l?.className,{"tabs__item--active":s===n}),children:t??n},n)}))})}function w(e){let{lazy:n,children:t,selectedValue:s}=e;const i=(Array.isArray(t)?t:[t]).filter(Boolean);if(n){const e=i.find((e=>e.props.value===s));return e?(0,l.cloneElement)(e,{className:"margin-top--md"}):null}return(0,r.jsx)("div",{className:"margin-top--md",children:i.map(((e,n)=>(0,l.cloneElement)(e,{key:n,hidden:e.props.value!==s})))})}function y(e){const n=b(e);return(0,r.jsxs)("div",{className:(0,i.A)("tabs-container",g.tabList),children:[(0,r.jsx)(v,{...n,...e}),(0,r.jsx)(w,{...n,...e})]})}function A(e){const n=(0,f.A)();return(0,r.jsx)(y,{...e,children:p(e.children)},String(n))}const C={tabItem:"tabItem_diMf"};function I(e){let{children:n,hidden:t,className:s}=e;return(0,r.jsx)("div",{role:"tabpanel",className:(0,i.A)(C.tabItem,s),hidden:t,children:n})}const P={sidebar_position:2,title:"\u8ba1\u8d39\u6536\u8d39"},k="\u8ba1\u8d39\u6536\u8d39",S={id:"info/mis/business/billing",title:"\u8ba1\u8d39\u6536\u8d39",description:"\u7cfb\u7edf\u76ee\u524d\u91c7\u7528\u4e00\u4e2a\u72ec\u7acb\u7684\u8d22\u52a1\u7cfb\u7edf\u3002",source:"@site/docs/info/mis/business/billing.mdx",sourceDirName:"info/mis/business",slug:"/info/mis/business/billing",permalink:"/SCOW/pr-preview/pr-1389/docs/info/mis/business/billing",draft:!1,unlisted:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/info/mis/business/billing.mdx",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2,title:"\u8ba1\u8d39\u6536\u8d39"},sidebar:"info",previous:{title:"\u7528\u6237\u6a21\u578b",permalink:"/SCOW/pr-preview/pr-1389/docs/info/mis/business/users"},next:{title:"AI \u7cfb\u7edf\uff08beta\uff09",permalink:"/SCOW/pr-preview/pr-1389/docs/info/ai/"}},_={},V=[{value:"\u8ba1\u8d39\u89c4\u5219",id:"\u8ba1\u8d39\u89c4\u5219",level:2},{value:"\u4ece\u7f51\u9875\u7f16\u8f91\u4f5c\u4e1a\u4ef7\u683c\u8868",id:"\u4ece\u7f51\u9875\u7f16\u8f91\u4f5c\u4e1a\u4ef7\u683c\u8868",level:2},{value:"\u5feb\u901f\u521b\u5efa\u8ba1\u8d39\u89c4\u5219",id:"\u5feb\u901f\u521b\u5efa\u8ba1\u8d39\u89c4\u5219",level:2}];function T(e){const n={a:"a",blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",img:"img",li:"li",ol:"ol",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,s.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.h1,{id:"\u8ba1\u8d39\u6536\u8d39",children:"\u8ba1\u8d39\u6536\u8d39"}),"\n",(0,r.jsx)(n.p,{children:"\u7cfb\u7edf\u76ee\u524d\u91c7\u7528\u4e00\u4e2a\u72ec\u7acb\u7684\u8d22\u52a1\u7cfb\u7edf\u3002"}),"\n",(0,r.jsx)(n.p,{children:"\u6536\u8d39\uff1a"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsx)(n.li,{children:"\u7cfb\u7edf\u91c7\u7528\u9884\u4ed8\u8d39\u5236\uff0c\u6bcf\u4e2a\u79df\u6237\u548c\u8d26\u6237\u5177\u6709\u4f59\u989d"}),"\n",(0,r.jsx)(n.li,{children:"\u5e73\u53f0\u7ba1\u7406\u5458\u53ef\u4ee5\u7ed9\u79df\u6237\u589e\u52a0\u4f59\u989d\uff0c\u79df\u6237\u7ba1\u7406\u5458\u53ef\u4ee5\u7ed9\u8d26\u6237\u589e\u52a0\u4f59\u989d"}),"\n",(0,r.jsx)(n.li,{children:"\u5728\u6570\u636e\u5e93\u4e2d\u4f59\u989d\u5b58\u50a8\u5230\u5c0f\u6570\u70b9\u540e4\u4f4d\uff0c\u524d\u53f0\u663e\u793a3\u4f4d"}),"\n"]}),"\n",(0,r.jsx)(n.p,{children:"\u8ba1\u8d39\uff1a"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:["\u7cfb\u7edf\u7684\u8ba1\u8d39\u6536\u8d39\u6a21\u578b\u6309\u7167\u96c6\u7fa4\u3001\u5206\u533a\u548cQOS\u8fdb\u884c\u6536\u8d39","\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:["\u53c2\u8003",(0,r.jsx)(n.a,{href:"https://hpc.pku.edu.cn/guide_6.html",children:"\u5317\u5927\u9ad8\u6027\u80fd\u5e73\u53f0\u6536\u8d39\u6807\u51c6"}),"\u8bbe\u8ba1"]}),"\n"]}),"\n"]}),"\n",(0,r.jsx)(n.li,{children:"\u7cfb\u7edf\u652f\u6301\u591a\u7ea7\u8ba1\u8d39\uff1a\u5e73\u53f0\u5bf9\u79df\u6237\u4f7f\u7528\u4e00\u4e2a\u7edf\u4e00\u7684\u6536\u8d39\u6807\u51c6\uff0c\u800c\u79df\u6237\u53ef\u4ee5\u81ea\u5b9a\u4e49\u79df\u6237\u5185\u7684\u8d26\u6237\u7684\u8d39\u7528\u6807\u51c6"}),"\n",(0,r.jsxs)(n.li,{children:["\u7cfb\u7edf\u652f\u6301\u7528\u6237",(0,r.jsx)(n.a,{href:"/SCOW/pr-preview/pr-1389/docs/deploy/config/customization/custom-amount-strategies",children:"\u901a\u8fc7\u4ee3\u7801\u81ea\u5b9a\u4e49\u6536\u8d39\u89c4\u5219"})]}),"\n"]}),"\n",(0,r.jsx)(n.h2,{id:"\u8ba1\u8d39\u89c4\u5219",children:"\u8ba1\u8d39\u89c4\u5219"}),"\n",(0,r.jsxs)(n.p,{children:["\u670d\u52a1\u5668\u4f1a\u5b9a\u671f\u5730\u4ece",(0,r.jsx)(n.strong,{children:"\u8c03\u5ea6\u5668\u9002\u914d\u5668"}),"\u4e2d\u83b7\u53d6\u5df2\u5b8c\u6210\u7684\u4f5c\u4e1a\u4fe1\u606f\uff0c\u5e76\u6839\u636e\u89c4\u5219\u5bf9\u79df\u6237\u548c\u8d26\u6237\u8fdb\u884c\u6263\u8d39\u64cd\u4f5c\u3002"]}),"\n",(0,r.jsxs)(n.p,{children:["\u7cfb\u7edf\u8ba1\u8d39\u4ee5",(0,r.jsx)(n.strong,{children:"\u8d39\u7528\u9879\u76ee price item"}),"\u4e3a\u57fa\u7840\uff0c\u6bcf\u4e2a\u8ba1\u8d39\u9879\u6709\u72ec\u7279\u7684ID\u4ee5\u53ca\u4ef7\u683c\uff0c\u6bcf\u4e2a(\u96c6\u7fa4,\u5206\u533a,QOS)\u9879\u5e94\u8be5\u6709\u4e00\u4e2a\u72ec\u7279\u7684\u8ba1\u8d39\u9879\u3002\u8ba1\u8d39\u9879\u4e00\u65e6\u521b\u5efa\u548c\u5206\u914d\u4e0d\u80fd\u88ab\u91cd\u65b0\u5206\u914d\u3001\u4fee\u6539\u6216\u8005\u5220\u9664\uff0c\u5982\u679c\u60a8\u60f3\u4fee\u6539\u4e00\u4e2a\u8ba1\u8d39\u9879\u7684\u4ef7\u683c\uff0c\u60a8\u9700\u8981\u521b\u5efa\u4e00\u4e2a\u65b0\u7684\u8ba1\u8d39\u9879\u3002"]}),"\n",(0,r.jsxs)(n.p,{children:["\u8d39\u7528\u9879\u76ee\u7684\u4fe1\u606f\u5b58\u653e\u5728\u6570\u636e\u5e93\u7684",(0,r.jsx)(n.code,{children:"job_price_item"}),"\u8868\u4e2d\u3002\u6bcf\u6b21\u9700\u8981\u8ba1\u7b97\u4ef7\u683c\u65f6\uff0c\u670d\u52a1\u5668\u5c06\u4f1a\u4ece\u6570\u636e\u5e93\u4e2d\u53d6\u5f97\u6240\u6709\u8ba1\u8d39\u9879\uff0c\u5e76\u5f97\u5230\u6bcf\u4e2a(\u96c6\u7fa4,\u5206\u533a,QOS)\u7684\u6700\u65b0\u7684\u8ba1\u8d39\u89c4\u5219\u3002\u5982\u679c\u5728\u96c6\u7fa4\u914d\u7f6e\u6587\u4ef6\u7684\u67d0\u4e2aQOS\u4e0d\u5b58\u5728\u8d39\u7528\u9879\uff0c\u670d\u52a1\u5668\u5c06\u4f1a\u62a5\u9519\u3002"]}),"\n",(0,r.jsx)(n.p,{children:"\u6bcf\u4e2a\u4f5c\u4e1a\u7684\u8d39\u7528\u8ba1\u7b97\u65b9\u6cd5\u5982\u4e0b\uff1a"}),"\n",(0,r.jsxs)(n.blockquote,{children:["\n",(0,r.jsxs)(n.p,{children:["\u56db\u820d\u4e94\u5165(\u4f5c\u4e1a\u6301\u7eed\u5c0f\u65f6 (",(0,r.jsx)(n.code,{children:"timeUsed"})," / 3600) x \u7528\u91cf x \u6240\u9002\u7528\u7684\u8d39\u7528\u9879\u76ee\u7684\u4ef7\u683c)"]}),"\n"]}),"\n",(0,r.jsx)(n.p,{children:"\u6bcf\u4e2a\u4f5c\u4e1a\u7684\u7528\u91cf\u7531\u8ba1\u8d39\u7b56\u7565(amount)\u786e\u5b9a\uff0c\u652f\u6301\u7684\u8ba1\u8d39\u7b56\u7565\u53d6\u503c\u5982\u4e0b\uff1a"}),"\n",(0,r.jsxs)(n.table,{children:[(0,r.jsx)(n.thead,{children:(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.th,{children:"amount"}),(0,r.jsx)(n.th,{children:"\u603b\u91cf\u7b97\u6cd5"})]})}),(0,r.jsxs)(n.tbody,{children:[(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"cpusAlloc"})}),(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"cpusAlloc"})})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"gpu"})}),(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"gpu"})})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"max-cpusAlloc-mem"})}),(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"max(cpusAlloc, \u5411\u4e0a\u53d6\u6574(memReq / (\u5206\u533a\u5185\u5b58\u91cf/\u5206\u533a\u6838\u5fc3\u6570)))"})})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"max-gpu-cpusAlloc"})}),(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"max(gpu, \u5411\u4e0a\u53d6\u6574(cpusAlloc / (\u5206\u533a\u6838\u5fc3\u6570/\u5206\u533agpu\u6570)))"})})]})]})]}),"\n",(0,r.jsx)(n.p,{children:"\u5728\u8ba1\u7b97\u8fc7\u7a0b\u4e2d\u5982\u679c\u53d1\u73b0\u4e86\u5176\u4ed6\u7b56\u7565\uff0c\u5219\u6574\u4e2a\u4f5c\u4e1a\u7684\u8d39\u7528\u4e3a0\u3002"}),"\n",(0,r.jsx)(n.h2,{id:"\u4ece\u7f51\u9875\u7f16\u8f91\u4f5c\u4e1a\u4ef7\u683c\u8868",children:"\u4ece\u7f51\u9875\u7f16\u8f91\u4f5c\u4e1a\u4ef7\u683c\u8868"}),"\n",(0,r.jsxs)(n.p,{children:["\u60a8\u53ef\u4ee5\u5728\u7cfb\u7edf\u521d\u59cb\u5316\u65f6\u6216\u8005\u4ee5\u5e73\u53f0\u7ba1\u7406\u5458\u8eab\u4efd\u767b\u5f55\u7cfb\u7edf\u540e\u8fdb\u5165",(0,r.jsx)(n.strong,{children:"\u5e73\u53f0\u7ba1\u7406"}),"->",(0,r.jsx)(n.strong,{children:"\u7f16\u8f91\u4f5c\u4e1a\u4ef7\u683c\u8868"}),"\uff0c\u5728\u7f51\u9875\u4e0a\u7f16\u8f91\u4f5c\u4e1a\u4ef7\u683c\u8868\u3002"]}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.img,{alt:"\u4f5c\u4e1a\u4ef7\u683c\u8868",src:t(80626).A+"",width:"2418",height:"1057"})}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.img,{alt:"\u4fee\u6539\u4f5c\u4e1a\u4ef7\u683c",src:t(92686).A+"",width:"997",height:"935"})}),"\n",(0,r.jsx)(n.p,{children:"\u65b0\u7684\u4f5c\u4e1a\u4ef7\u683c\u8868\u5c06\u5728\u4e0b\u6b21\u83b7\u53d6\u4f5c\u4e1a\u65f6\u751f\u6548\u3002"}),"\n",(0,r.jsx)(n.h2,{id:"\u5feb\u901f\u521b\u5efa\u8ba1\u8d39\u89c4\u5219",children:"\u5feb\u901f\u521b\u5efa\u8ba1\u8d39\u89c4\u5219"}),"\n",(0,r.jsxs)(n.p,{children:["\u60a8\u53ef\u4ee5\u521b\u5efa\u4e00\u4e2a",(0,r.jsx)(n.code,{children:"config/priceItems.{json|yml|yaml}"}),"\u6587\u4ef6\uff0c\u5b9a\u4e49(\u96c6\u7fa4,\u5206\u533a,QOS)\u9879\u4ee5\u53ca\u5bf9\u5e94\u7684\u8d39\u7528\u9879\u76ee\uff0c\u670d\u52a1\u5668\u53ef\u4ee5\u5feb\u901f\u6839\u636e\u8fd9\u4e9b\u4fe1\u606f\u5728\u6570\u636e\u5e93\u4e2d\u521b\u5efa\u8d39\u7528\u9879\u76ee\u3002\u6587\u4ef6\u683c\u5f0f\u4ee5\u53ca\u5404\u4e2a\u5b57\u6bb5\u7684\u89e3\u91ca\u8bf7\u53c2\u8003\u4e0b\u5217yaml\u6587\u4ef6\u7684\u6ce8\u91ca\u3002"]}),"\n","\n",(0,r.jsxs)(A,{children:[(0,r.jsx)(I,{value:"config/priceItems.yml",default:!0,children:(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-yaml",children:"default: # \u9ed8\u8ba4\u89c4\u5219\uff0c\u5bf9\u6240\u6709\u96c6\u7fa4\u548c\u79df\u6237\u751f\u6548\n  hpc01: # \u5bf9hpc01\u96c6\u7fa4\u7684...\n    compute: # compute\u5206\u533a\u7684...\n      low: # QOS\u4e3alow\u7684\u4efb\u52a1\n        id: HPC01 # \u8d39\u7528\u9879\u76eeID\u4e3aHPC01\n        price: '1.00' # \u57fa\u7840\u4ef7\u683c\u4e3a1.00\uff0c\u5b57\u7b26\u4e32\u5f62\u5f0f\n        amount: 'cpusAlloc' # \u8ba1\u8d39\u7b56\u7565\uff0c\u770b\u4e0a\u6587\n      normal:\n        id: HPC02\n        price: '2.00'\n        amount: 'cpusAlloc'\n      high:\n        id: HPC03\n        price: '3.00'\n        amount: 'cpusAlloc'\n    GPU: # \u5982\u679c\u6574\u4e2a\u5206\u533a\u7684\u8d39\u7528\u76f8\u540c\uff0c\u60a8\u4e5f\u53ef\u4ee5\u7ed9\u4e00\u6574\u4e2a\u5206\u533a\u5b9a\u4e49\u4e00\u4e2a\u8d39\u7528\u9879\u76ee\n      id: HPC04\n      price: '10.00'\n      amount: 'cpusAlloc'\ntenant_1: # \u5bf9\u79df\u6237tenant_1\u7684\u8d26\u6237\u7528\u6237\u53d1\u8d77\u7684\u4efb\u52a1\uff0c\u5728\u9ed8\u8ba4\u89c4\u5219\u7684\u57fa\u7840\u4e0a\uff0c\u8986\u76d6\u4ee5\u4e0b\u914d\u7f6e\n  hpc01:\n    GPU:\n      low:\n        id: HPC07 # \u5bf9\u79df\u6237tenant_1\u7684hpc01.GPU.low\u7684\u4efb\u52a1\uff0c\u4ef7\u683c\u4e3a12.00\n        price: '12.00'\n        amount: 'cpusAlloc'\n"})})}),(0,r.jsx)(I,{value:"config/priceItems.json",default:!0,children:(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-json",children:'{\n  "default": {\n    "hpc01": {\n      "compute": {\n        "low": {\n          "id": "HPC01",\n          "price": "1.00",\n          "amount": "cpusAlloc"\n         },\n        "normal": {\n          "id": "HPC02",\n          "price": "2.00",\n          "amount": "cpusAlloc"\n         },\n        "high": {\n          "id": "HPC03",\n          "price": "3.00",\n          "amount": "cpusAlloc"\n         }\n      },\n      "GPU": {\n        "low": {\n          "id": "HPC04",\n          "price": "10.00",\n          "amount": "cpusAlloc"\n         },\n        "normal": {\n          "id": "HPC05",\n          "price": "20.00",\n          "amount": "cpusAlloc"\n         },\n        "high": {\n          "id": "HPC06",\n          "price": "30.00",\n          "amount": "cpusAlloc"\n         }\n      }\n    }\n  },\n  "tenant_1": {\n    "hpc01": {\n      "GPU": {\n        "low": {\n          "id": "HPC07",\n          "price": "12.00",\n          "amount": "cpusAlloc"\n         }\n      }\n    }\n  }\n}\n'})})})]}),"\n",(0,r.jsx)(n.p,{children:"\u6ce8\u610f\u4e8b\u9879\uff1a"}),"\n",(0,r.jsxs)(n.ol,{children:["\n",(0,r.jsx)(n.li,{children:"\u6bcf\u4e2a\u8ba1\u8d39\u9879\u5e94\u8be5\u53ea\u51fa\u73b0\u4e00\u6b21\u3002\u5373\u4f7f\u591a\u4e2aQOS\u8d39\u7528\u76f8\u540c\uff0c\u4e5f\u5e94\u8be5\u5b9a\u4e49\u4e24\u4e2a\u8ba1\u8d39\u9879"}),"\n",(0,r.jsx)(n.li,{children:"\u6570\u636e\u5e93\u4e2d\u4e0d\u5b58\u5728\u5177\u6709\u76f8\u540c\u8ba1\u8d39\u9879\u540d\u7684\u884c"}),"\n"]}),"\n",(0,r.jsxs)(n.p,{children:["\u5728\u6570\u636e\u5e93\u6b63\u5728\u8fd0\u884c\u3001",(0,r.jsx)(n.code,{children:"docker-compose.yml"}),"\u914d\u7f6e\u7f16\u5199\u5b8c\u6210\u7684\u6761\u4ef6\u4e0b\uff0c\u8fd0\u884c\u4ee5\u4e0b\u547d\u4ee4\u5feb\u901f\u5728\u6570\u636e\u5e93\u4e2d\u521b\u5efa\u8d39\u7528\u9879\u4fe1\u606f\uff1a"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"docker compose run mis-server createPriceItems\n"})})]})}function q(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(T,{...e})}):T(e)}},92686:(e,n,t)=>{t.d(n,{A:()=>r});const r=t.p+"assets/images/edit-price-item-d984facac9485f1863b7a8f2382e8f2b.png"},80626:(e,n,t)=>{t.d(n,{A:()=>r});const r=t.p+"assets/images/price-table-1d232d50cbdc495a0d3bf3b0c11c0ed8.png"},5409:(e,n,t)=>{t.d(n,{R:()=>i,x:()=>c});var r=t(48318);const s={},l=r.createContext(s);function i(e){const n=r.useContext(l);return r.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:i(e.components),r.createElement(l.Provider,{value:n},e.children)}}}]);