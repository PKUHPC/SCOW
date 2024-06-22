"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[9048],{45487:(e,t,n)=>{n.r(t),n.d(t,{default:()=>be});var a=n(48318),o=n(46601),i=n(59539),s=n(7582),l=n(57367),c=n(7963),r=n(80050),d=n(84429),u=n(55563);const m={backToTopButton:"backToTopButton_mket",backToTopButtonShow:"backToTopButtonShow_tycI"};var b=n(49214);function h(){const{shown:e,scrollToTop:t}=function(e){let{threshold:t}=e;const[n,o]=(0,a.useState)(!1),i=(0,a.useRef)(!1),{startScroll:s,cancelScroll:l}=(0,d.gk)();return(0,d.Mq)(((e,n)=>{let{scrollY:a}=e;const s=n?.scrollY;s&&(i.current?i.current=!1:a>=s?(l(),o(!1)):a<t?o(!1):a+window.innerHeight<document.documentElement.scrollHeight&&o(!0))})),(0,u.$)((e=>{e.location.hash&&(i.current=!0,o(!1))})),{shown:n,scrollToTop:()=>s(0)}}({threshold:300});return(0,b.jsx)("button",{"aria-label":(0,r.T)({id:"theme.BackToTopButton.buttonAriaLabel",message:"Scroll back to top",description:"The ARIA label for the back to top button"}),className:(0,o.A)("clean-btn",s.G.common.backToTopButton,m.backToTopButton,e&&m.backToTopButtonShow),type:"button",onClick:t})}var p=n(35750),x=n(66325),f=n(78848),j=n(30357),_=n(24412);function g(e){return(0,b.jsx)("svg",{width:"20",height:"20","aria-hidden":"true",...e,children:(0,b.jsxs)("g",{fill:"#7a7a7a",children:[(0,b.jsx)("path",{d:"M9.992 10.023c0 .2-.062.399-.172.547l-4.996 7.492a.982.982 0 01-.828.454H1c-.55 0-1-.453-1-1 0-.2.059-.403.168-.551l4.629-6.942L.168 3.078A.939.939 0 010 2.528c0-.548.45-.997 1-.997h2.996c.352 0 .649.18.828.45L9.82 9.472c.11.148.172.347.172.55zm0 0"}),(0,b.jsx)("path",{d:"M19.98 10.023c0 .2-.058.399-.168.547l-4.996 7.492a.987.987 0 01-.828.454h-3c-.547 0-.996-.453-.996-1 0-.2.059-.403.168-.551l4.625-6.942-4.625-6.945a.939.939 0 01-.168-.55 1 1 0 01.996-.997h3c.348 0 .649.18.828.45l4.996 7.492c.11.148.168.347.168.55zm0 0"})]})})}const v={collapseSidebarButton:"collapseSidebarButton_c5RZ",collapseSidebarButtonIcon:"collapseSidebarButtonIcon_gDab"};function A(e){let{onClick:t}=e;return(0,b.jsx)("button",{type:"button",title:(0,r.T)({id:"theme.docs.sidebar.collapseButtonTitle",message:"Collapse sidebar",description:"The title attribute for collapse button of doc sidebar"}),"aria-label":(0,r.T)({id:"theme.docs.sidebar.collapseButtonAriaLabel",message:"Collapse sidebar",description:"The title attribute for collapse button of doc sidebar"}),className:(0,o.A)("button button--secondary button--outline",v.collapseSidebarButton),onClick:t,children:(0,b.jsx)(g,{className:v.collapseSidebarButtonIcon})})}var C=n(27914),k=n(47479);const S=Symbol("EmptyContext"),T=a.createContext(S);function N(e){let{children:t}=e;const[n,o]=(0,a.useState)(null),i=(0,a.useMemo)((()=>({expandedItem:n,setExpandedItem:o})),[n]);return(0,b.jsx)(T.Provider,{value:i,children:t})}var I=n(29805),y=n(11100),B=n(93789),L=n(91972);function w(e){let{collapsed:t,categoryLabel:n,onClick:a}=e;return(0,b.jsx)("button",{"aria-label":t?(0,r.T)({id:"theme.DocSidebarItem.expandCategoryAriaLabel",message:"Expand sidebar category '{label}'",description:"The ARIA label to expand the sidebar category"},{label:n}):(0,r.T)({id:"theme.DocSidebarItem.collapseCategoryAriaLabel",message:"Collapse sidebar category '{label}'",description:"The ARIA label to collapse the sidebar category"},{label:n}),"aria-expanded":!t,type:"button",className:"clean-btn menu__caret",onClick:a})}function E(e){let{item:t,onItemClick:n,activePath:i,level:c,index:r,...d}=e;const{items:u,label:m,collapsible:h,className:p,href:x}=t,{docs:{sidebar:{autoCollapseCategories:f}}}=(0,j.p)(),_=function(e){const t=(0,L.A)();return(0,a.useMemo)((()=>e.href&&!e.linkUnlisted?e.href:!t&&e.collapsible?(0,l.Nr)(e):void 0),[e,t])}(t),g=(0,l.w8)(t,i),v=(0,y.ys)(x,i),{collapsed:A,setCollapsed:C}=(0,I.u)({initialState:()=>!!h&&(!g&&t.collapsed)}),{expandedItem:N,setExpandedItem:E}=function(){const e=(0,a.useContext)(T);if(e===S)throw new k.dV("DocSidebarItemsExpandedStateProvider");return e}(),M=function(e){void 0===e&&(e=!A),E(e?null:r),C(e)};return function(e){let{isActive:t,collapsed:n,updateCollapsed:o}=e;const i=(0,k.ZC)(t);(0,a.useEffect)((()=>{t&&!i&&n&&o(!1)}),[t,i,n,o])}({isActive:g,collapsed:A,updateCollapsed:M}),(0,a.useEffect)((()=>{h&&null!=N&&N!==r&&f&&C(!0)}),[h,N,r,C,f]),(0,b.jsxs)("li",{className:(0,o.A)(s.G.docs.docSidebarItemCategory,s.G.docs.docSidebarItemCategoryLevel(c),"menu__list-item",{"menu__list-item--collapsed":A},p),children:[(0,b.jsxs)("div",{className:(0,o.A)("menu__list-item-collapsible",{"menu__list-item-collapsible--active":v}),children:[(0,b.jsx)(B.A,{className:(0,o.A)("menu__link",{"menu__link--sublist":h,"menu__link--sublist-caret":!x&&h,"menu__link--active":g}),onClick:h?e=>{n?.(t),x?M(!1):(e.preventDefault(),M())}:()=>{n?.(t)},"aria-current":v?"page":void 0,role:h&&!x?"button":void 0,"aria-expanded":h&&!x?!A:void 0,href:h?_??"#":_,...d,children:m}),x&&h&&(0,b.jsx)(w,{collapsed:A,categoryLabel:m,onClick:e=>{e.preventDefault(),M()}})]}),(0,b.jsx)(I.N,{lazy:!0,as:"ul",className:"menu__list",collapsed:A,children:(0,b.jsx)(V,{items:u,tabIndex:A?-1:0,onItemClick:n,activePath:i,level:c+1})})]})}var M=n(30531),H=n(54270);const R={menuExternalLink:"menuExternalLink_LTRr"};function G(e){let{item:t,onItemClick:n,activePath:a,level:i,index:c,...r}=e;const{href:d,label:u,className:m,autoAddBaseUrl:h}=t,p=(0,l.w8)(t,a),x=(0,M.A)(d);return(0,b.jsx)("li",{className:(0,o.A)(s.G.docs.docSidebarItemLink,s.G.docs.docSidebarItemLinkLevel(i),"menu__list-item",m),children:(0,b.jsxs)(B.A,{className:(0,o.A)("menu__link",!x&&R.menuExternalLink,{"menu__link--active":p}),autoAddBaseUrl:h,"aria-current":p?"page":void 0,to:d,...x&&{onClick:n?()=>n(t):void 0},...r,children:[u,!x&&(0,b.jsx)(H.A,{})]})},u)}const P={menuHtmlItem:"menuHtmlItem_kLD_"};function W(e){let{item:t,level:n,index:a}=e;const{value:i,defaultStyle:l,className:c}=t;return(0,b.jsx)("li",{className:(0,o.A)(s.G.docs.docSidebarItemLink,s.G.docs.docSidebarItemLinkLevel(n),l&&[P.menuHtmlItem,"menu__list-item"],c),dangerouslySetInnerHTML:{__html:i}},a)}function D(e){let{item:t,...n}=e;switch(t.type){case"category":return(0,b.jsx)(E,{item:t,...n});case"html":return(0,b.jsx)(W,{item:t,...n});default:return(0,b.jsx)(G,{item:t,...n})}}function F(e){let{items:t,...n}=e;const a=(0,l.Y)(t,n.activePath);return(0,b.jsx)(N,{children:a.map(((e,t)=>(0,b.jsx)(D,{item:e,index:t,...n},t)))})}const V=(0,a.memo)(F),Y={menu:"menu_dEPY",menuWithAnnouncementBar:"menuWithAnnouncementBar_scNb"};function z(e){let{path:t,sidebar:n,className:i}=e;const l=function(){const{isActive:e}=(0,C.Mj)(),[t,n]=(0,a.useState)(e);return(0,d.Mq)((t=>{let{scrollY:a}=t;e&&n(0===a)}),[e]),e&&t}();return(0,b.jsx)("nav",{"aria-label":(0,r.T)({id:"theme.docs.sidebar.navAriaLabel",message:"Docs sidebar",description:"The ARIA label for the sidebar navigation"}),className:(0,o.A)("menu thin-scrollbar",Y.menu,l&&Y.menuWithAnnouncementBar,i),children:(0,b.jsx)("ul",{className:(0,o.A)(s.G.docs.docSidebarMenu,"menu__list"),children:(0,b.jsx)(V,{items:n,activePath:t,level:1})})})}const U="sidebar_qLg2",q="sidebarWithHideableNavbar_ORQj",Z="sidebarHidden_RJoM",O="sidebarLogo_GYUm";function J(e){let{path:t,sidebar:n,onCollapse:a,isHidden:i}=e;const{navbar:{hideOnScroll:s},docs:{sidebar:{hideable:l}}}=(0,j.p)();return(0,b.jsxs)("div",{className:(0,o.A)(U,s&&q,i&&Z),children:[s&&(0,b.jsx)(_.A,{tabIndex:-1,className:O}),(0,b.jsx)(z,{path:t,sidebar:n}),l&&(0,b.jsx)(A,{onClick:a})]})}const K=a.memo(J);var X=n(46931),Q=n(88442);const $=e=>{let{sidebar:t,path:n}=e;const a=(0,Q.M)();return(0,b.jsx)("ul",{className:(0,o.A)(s.G.docs.docSidebarMenu,"menu__list"),children:(0,b.jsx)(V,{items:t,activePath:n,onItemClick:e=>{"category"===e.type&&e.href&&a.toggle(),"link"===e.type&&a.toggle()},level:1})})};function ee(e){return(0,b.jsx)(X.GX,{component:$,props:e})}const te=a.memo(ee);function ne(e){const t=(0,f.l)(),n="desktop"===t||"ssr"===t,a="mobile"===t;return(0,b.jsxs)(b.Fragment,{children:[n&&(0,b.jsx)(K,{...e}),a&&(0,b.jsx)(te,{...e})]})}const ae={expandButton:"expandButton_EkTf",expandButtonIcon:"expandButtonIcon_zxgy"};function oe(e){let{toggleSidebar:t}=e;return(0,b.jsx)("div",{className:ae.expandButton,title:(0,r.T)({id:"theme.docs.sidebar.expandButtonTitle",message:"Expand sidebar",description:"The ARIA label and title attribute for expand button of doc sidebar"}),"aria-label":(0,r.T)({id:"theme.docs.sidebar.expandButtonAriaLabel",message:"Expand sidebar",description:"The ARIA label and title attribute for expand button of doc sidebar"}),tabIndex:0,role:"button",onKeyDown:t,onClick:t,children:(0,b.jsx)(g,{className:ae.expandButtonIcon})})}const ie={docSidebarContainer:"docSidebarContainer_nc4M",docSidebarContainerHidden:"docSidebarContainerHidden__s9J",sidebarViewport:"sidebarViewport_FCil"};function se(e){let{children:t}=e;const n=(0,c.t)();return(0,b.jsx)(a.Fragment,{children:t},n?.name??"noSidebar")}function le(e){let{sidebar:t,hiddenSidebarContainer:n,setHiddenSidebarContainer:i}=e;const{pathname:l}=(0,x.zy)(),[c,r]=(0,a.useState)(!1),d=(0,a.useCallback)((()=>{c&&r(!1),!c&&(0,p.O)()&&r(!0),i((e=>!e))}),[i,c]);return(0,b.jsx)("aside",{className:(0,o.A)(s.G.docs.docSidebarContainer,ie.docSidebarContainer,n&&ie.docSidebarContainerHidden),onTransitionEnd:e=>{e.currentTarget.classList.contains(ie.docSidebarContainer)&&n&&r(!0)},children:(0,b.jsx)(se,{children:(0,b.jsxs)("div",{className:(0,o.A)(ie.sidebarViewport,c&&ie.sidebarViewportHidden),children:[(0,b.jsx)(ne,{sidebar:t,path:l,onCollapse:d,isHidden:c}),c&&(0,b.jsx)(oe,{toggleSidebar:d})]})})})}const ce={docMainContainer:"docMainContainer_ZWqf",docMainContainerEnhanced:"docMainContainerEnhanced_L0iF",docItemWrapperEnhanced:"docItemWrapperEnhanced_XlKL"};function re(e){let{hiddenSidebarContainer:t,children:n}=e;const a=(0,c.t)();return(0,b.jsx)("main",{className:(0,o.A)(ce.docMainContainer,(t||!a)&&ce.docMainContainerEnhanced),children:(0,b.jsx)("div",{className:(0,o.A)("container padding-top--md padding-bottom--lg",ce.docItemWrapper,t&&ce.docItemWrapperEnhanced),children:n})})}const de={docRoot:"docRoot_kL5f",docsWrapper:"docsWrapper_ZINP"};function ue(e){let{children:t}=e;const n=(0,c.t)(),[o,i]=(0,a.useState)(!1);return(0,b.jsxs)("div",{className:de.docsWrapper,children:[(0,b.jsx)(h,{}),(0,b.jsxs)("div",{className:de.docRoot,children:[n&&(0,b.jsx)(le,{sidebar:n.items,hiddenSidebarContainer:o,setHiddenSidebarContainer:i}),(0,b.jsx)(re,{hiddenSidebarContainer:o,children:t})]})]})}var me=n(3758);function be(e){const t=(0,l.B5)(e);if(!t)return(0,b.jsx)(me.A,{});const{docElement:n,sidebarName:a,sidebarItems:r}=t;return(0,b.jsx)(i.e3,{className:(0,o.A)(s.G.page.docsDocPage),children:(0,b.jsx)(c.V,{name:a,items:r,children:(0,b.jsx)(ue,{children:n})})})}},3758:(e,t,n)=>{n.d(t,{A:()=>l});n(48318);var a=n(46601),o=n(80050),i=n(36290),s=n(49214);function l(e){let{className:t}=e;return(0,s.jsx)("main",{className:(0,a.A)("container margin-vert--xl",t),children:(0,s.jsx)("div",{className:"row",children:(0,s.jsxs)("div",{className:"col col--6 col--offset-3",children:[(0,s.jsx)(i.A,{as:"h1",className:"hero__title",children:(0,s.jsx)(o.A,{id:"theme.NotFound.title",description:"The title of the 404 page",children:"Page Not Found"})}),(0,s.jsx)("p",{children:(0,s.jsx)(o.A,{id:"theme.NotFound.p1",description:"The first paragraph of the 404 page",children:"We could not find what you were looking for."})}),(0,s.jsx)("p",{children:(0,s.jsx)(o.A,{id:"theme.NotFound.p2",description:"The 2nd paragraph of the 404 page",children:"Please contact the owner of the site that linked you to the original URL and let them know their link is broken."})})]})})})}}}]);