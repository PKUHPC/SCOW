"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[4675],{9681:(e,t,a)=>{a.d(t,{Z:()=>_});var l=a(9231),n=a(9841),r=a(4420),s=a(4334),o=a(2493),i=a(5842);const c="sidebar_Msx0",m="sidebarItemTitle_NuYd",u="sidebarItemList_XOAs",d="sidebarItem_hHhz",g="sidebarItemLink_yYpL",p="sidebarItemLinkActive_DUr3";function h(e){let{sidebar:t}=e;return l.createElement("aside",{className:"col col--3"},l.createElement("nav",{className:(0,n.Z)(c,"thin-scrollbar"),"aria-label":(0,i.I)({id:"theme.blog.sidebar.navAriaLabel",message:"Blog recent posts navigation",description:"The ARIA label for recent posts in the blog sidebar"})},l.createElement("div",{className:(0,n.Z)(m,"margin-bottom--md")},t.title),l.createElement("ul",{className:(0,n.Z)(u,"clean-list")},t.items.map((e=>l.createElement("li",{key:e.permalink,className:d},l.createElement(o.Z,{isNavLink:!0,to:e.permalink,className:g,activeClassName:p},e.title)))))))}var f=a(1934);function E(e){let{sidebar:t}=e;return l.createElement("ul",{className:"menu__list"},t.items.map((e=>l.createElement("li",{key:e.permalink,className:"menu__list-item"},l.createElement(o.Z,{isNavLink:!0,to:e.permalink,className:"menu__link",activeClassName:"menu__link--active"},e.title)))))}function b(e){return l.createElement(f.Zo,{component:E,props:e})}function v(e){let{sidebar:t}=e;const a=(0,s.i)();return null!=t&&t.items.length?"mobile"===a?l.createElement(b,{sidebar:t}):l.createElement(h,{sidebar:t}):null}function _(e){const{sidebar:t,toc:a,children:s,...o}=e,i=t&&t.items.length>0;return l.createElement(r.Z,o,l.createElement("div",{className:"container margin-vert--lg"},l.createElement("div",{className:"row"},l.createElement(v,{sidebar:t}),l.createElement("main",{className:(0,n.Z)("col",{"col--7":i,"col--9 col--offset-1":!i}),itemScope:!0,itemType:"http://schema.org/Blog"},s),a&&l.createElement("div",{className:"col col--2"},a))))}},9339:(e,t,a)=>{a.d(t,{Z:()=>R});var l=a(9231),n=a(9841),r=a(6114),s=a(7023);function o(e){let{children:t,className:a}=e;const{frontMatter:n,assets:o}=(0,r.C)(),{withBaseUrl:i}=(0,s.C)(),c=o.image??n.image;return l.createElement("article",{className:a,itemProp:"blogPost",itemScope:!0,itemType:"http://schema.org/BlogPosting"},c&&l.createElement("meta",{itemProp:"image",content:i(c,{absolute:!0})}),t)}var i=a(2493);const c="title_EOpX";function m(e){let{className:t}=e;const{metadata:a,isBlogPostPage:s}=(0,r.C)(),{permalink:o,title:m}=a,u=s?"h1":"h2";return l.createElement(u,{className:(0,n.Z)(c,t),itemProp:"headline"},s?m:l.createElement(i.Z,{itemProp:"url",to:o},m))}var u=a(5842),d=a(2218);const g="container_zzbB";function p(e){let{readingTime:t}=e;const a=function(){const{selectMessage:e}=(0,d.c)();return t=>{const a=Math.ceil(t);return e(a,(0,u.I)({id:"theme.blog.post.readingTime.plurals",description:'Pluralized label for "{readingTime} min read". Use as much plural forms (separated by "|") as your language support (see https://www.unicode.org/cldr/cldr-aux/charts/34/supplemental/language_plural_rules.html)',message:"One min read|{readingTime} min read"},{readingTime:a}))}}();return l.createElement(l.Fragment,null,a(t))}function h(e){let{date:t,formattedDate:a}=e;return l.createElement("time",{dateTime:t,itemProp:"datePublished"},a)}function f(){return l.createElement(l.Fragment,null," \xb7 ")}function E(e){let{className:t}=e;const{metadata:a}=(0,r.C)(),{date:s,formattedDate:o,readingTime:i}=a;return l.createElement("div",{className:(0,n.Z)(g,"margin-vert--md",t)},l.createElement(h,{date:s,formattedDate:o}),void 0!==i&&l.createElement(l.Fragment,null,l.createElement(f,null),l.createElement(p,{readingTime:i})))}function b(e){return e.href?l.createElement(i.Z,e):l.createElement(l.Fragment,null,e.children)}function v(e){let{author:t,className:a}=e;const{name:r,title:s,url:o,imageURL:i,email:c}=t,m=o||c&&`mailto:${c}`||void 0;return l.createElement("div",{className:(0,n.Z)("avatar margin-bottom--sm",a)},i&&l.createElement(b,{href:m,className:"avatar__photo-link"},l.createElement("img",{className:"avatar__photo",src:i,alt:r})),r&&l.createElement("div",{className:"avatar__intro",itemProp:"author",itemScope:!0,itemType:"https://schema.org/Person"},l.createElement("div",{className:"avatar__name"},l.createElement(b,{href:m,itemProp:"url"},l.createElement("span",{itemProp:"name"},r))),s&&l.createElement("small",{className:"avatar__subtitle",itemProp:"description"},s)))}const _="authorCol_HVxu",N="imageOnlyAuthorRow_LaBl",P="imageOnlyAuthorCol_eJjw";function Z(e){let{className:t}=e;const{metadata:{authors:a},assets:s}=(0,r.C)();if(0===a.length)return null;const o=a.every((e=>{let{name:t}=e;return!t}));return l.createElement("div",{className:(0,n.Z)("margin-top--md margin-bottom--sm",o?N:"row",t)},a.map(((e,t)=>l.createElement("div",{className:(0,n.Z)(!o&&"col col--6",o?P:_),key:t},l.createElement(v,{author:{...e,imageURL:s.authorsImageUrls[t]??e.imageURL}})))))}function k(){return l.createElement("header",null,l.createElement(m,null),l.createElement(E,null),l.createElement(Z,null))}var T=a(2363),C=a(1376);function w(e){let{children:t,className:a}=e;const{isBlogPostPage:s}=(0,r.C)();return l.createElement("div",{id:s?T.blogPostContainerID:void 0,className:(0,n.Z)("markdown",a),itemProp:"articleBody"},l.createElement(C.Z,null,t))}var y=a(1132),B=a(9902),L=a(9675);function M(){return l.createElement("b",null,l.createElement(u.Z,{id:"theme.blog.post.readMore",description:"The label used in blog post item excerpts to link to full blog posts"},"Read More"))}function I(e){const{blogPostTitle:t,...a}=e;return l.createElement(i.Z,(0,L.Z)({"aria-label":(0,u.I)({message:"Read more about {title}",id:"theme.blog.post.readMoreLabel",description:"The ARIA label for the link to full blog posts from excerpts"},{title:t})},a),l.createElement(M,null))}const x="blogPostFooterDetailsFull_jSLb";function F(){const{metadata:e,isBlogPostPage:t}=(0,r.C)(),{tags:a,title:s,editUrl:o,hasTruncateMarker:i}=e,c=!t&&i,m=a.length>0;return m||c||o?l.createElement("footer",{className:(0,n.Z)("row docusaurus-mt-lg",t&&x)},m&&l.createElement("div",{className:(0,n.Z)("col",{"col--9":c})},l.createElement(B.Z,{tags:a})),t&&o&&l.createElement("div",{className:"col margin-top--sm"},l.createElement(y.Z,{editUrl:o})),c&&l.createElement("div",{className:(0,n.Z)("col text--right",{"col--3":m})},l.createElement(I,{blogPostTitle:s,to:e.permalink}))):null}function R(e){let{children:t,className:a}=e;const s=function(){const{isBlogPostPage:e}=(0,r.C)();return e?void 0:"margin-bottom--xl"}();return l.createElement(o,{className:(0,n.Z)(s,a)},l.createElement(k,null),l.createElement(w,null,t),l.createElement(F,null))}},1132:(e,t,a)=>{a.d(t,{Z:()=>m});var l=a(9231),n=a(5842),r=a(9626),s=a(9675),o=a(9841);const i="iconEdit_WkHJ";function c(e){let{className:t,...a}=e;return l.createElement("svg",(0,s.Z)({fill:"currentColor",height:"20",width:"20",viewBox:"0 0 40 40",className:(0,o.Z)(i,t),"aria-hidden":"true"},a),l.createElement("g",null,l.createElement("path",{d:"m34.5 11.7l-3 3.1-6.3-6.3 3.1-3q0.5-0.5 1.2-0.5t1.1 0.5l3.9 3.9q0.5 0.4 0.5 1.1t-0.5 1.2z m-29.5 17.1l18.4-18.5 6.3 6.3-18.4 18.4h-6.3v-6.2z"})))}function m(e){let{editUrl:t}=e;return l.createElement("a",{href:t,target:"_blank",rel:"noreferrer noopener",className:r.k.common.editThisPage},l.createElement(c,null),l.createElement(n.Z,{id:"theme.common.editThisPage",description:"The link label to edit the current page"},"Edit this page"))}},4657:(e,t,a)=>{a.d(t,{Z:()=>s});var l=a(9231),n=a(9841),r=a(2493);function s(e){const{permalink:t,title:a,subLabel:s,isNext:o}=e;return l.createElement(r.Z,{className:(0,n.Z)("pagination-nav__link",o?"pagination-nav__link--next":"pagination-nav__link--prev"),to:t},s&&l.createElement("div",{className:"pagination-nav__sublabel"},s),l.createElement("div",{className:"pagination-nav__label"},a))}},3708:(e,t,a)=>{a.d(t,{Z:()=>c});var l=a(9231),n=a(9841),r=a(2493);const s="tag_yXe2",o="tagRegular_Jult",i="tagWithCount__q3k";function c(e){let{permalink:t,label:a,count:c}=e;return l.createElement(r.Z,{href:t,className:(0,n.Z)(s,c?i:o)},a,c&&l.createElement("span",null,c))}},9902:(e,t,a)=>{a.d(t,{Z:()=>c});var l=a(9231),n=a(9841),r=a(5842),s=a(3708);const o="tags_CQWp",i="tag_p7Pp";function c(e){let{tags:t}=e;return l.createElement(l.Fragment,null,l.createElement("b",null,l.createElement(r.Z,{id:"theme.tags.tagsListLabel",description:"The label alongside a tag list"},"Tags:")),l.createElement("ul",{className:(0,n.Z)(o,"padding--none","margin-left--sm")},t.map((e=>{let{label:t,permalink:a}=e;return l.createElement("li",{key:a,className:i},l.createElement(s.Z,{label:t,permalink:a}))}))))}},6114:(e,t,a)=>{a.d(t,{C:()=>o,n:()=>s});var l=a(9231),n=a(5678);const r=l.createContext(null);function s(e){let{children:t,content:a,isBlogPostPage:n=!1}=e;const s=function(e){let{content:t,isBlogPostPage:a}=e;return(0,l.useMemo)((()=>({metadata:t.metadata,frontMatter:t.frontMatter,assets:t.assets,toc:t.toc,isBlogPostPage:a})),[t,a])}({content:a,isBlogPostPage:n});return l.createElement(r.Provider,{value:s},t)}function o(){const e=(0,l.useContext)(r);if(null===e)throw new n.i6("BlogPostProvider");return e}},2218:(e,t,a)=>{a.d(t,{c:()=>c});var l=a(9231),n=a(7010);const r=["zero","one","two","few","many","other"];function s(e){return r.filter((t=>e.includes(t)))}const o={locale:"en",pluralForms:s(["one","other"]),select:e=>1===e?"one":"other"};function i(){const{i18n:{currentLocale:e}}=(0,n.Z)();return(0,l.useMemo)((()=>{try{return function(e){const t=new Intl.PluralRules(e);return{locale:e,pluralForms:s(t.resolvedOptions().pluralCategories),select:e=>t.select(e)}}(e)}catch(t){return console.error(`Failed to use Intl.PluralRules for locale "${e}".\nDocusaurus will fallback to the default (English) implementation.\nError: ${t.message}\n`),o}}),[e])}function c(){const e=i();return{selectMessage:(t,a)=>function(e,t,a){const l=e.split("|");if(1===l.length)return l[0];l.length>a.pluralForms.length&&console.error(`For locale=${a.locale}, a maximum of ${a.pluralForms.length} plural forms are expected (${a.pluralForms.join(",")}), but the message contains ${l.length}: ${e}`);const n=a.select(t),r=a.pluralForms.indexOf(n);return l[Math.min(r,l.length-1)]}(a,t,e)}}},3253:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),t.default=function(e,t){const{trailingSlash:a,baseUrl:l}=t;if(e.startsWith("#"))return e;if(void 0===a)return e;const[n]=e.split(/[#?]/),r="/"===n||n===l?n:(s=n,a?function(e){return e.endsWith("/")?e:`${e}/`}(s):function(e){return e.endsWith("/")?e.slice(0,-1):e}(s));var s;return e.replace(n,r)}},2363:function(e,t,a){var l=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0}),t.applyTrailingSlash=t.blogPostContainerID=void 0,t.blogPostContainerID="post-content";var n=a(3253);Object.defineProperty(t,"applyTrailingSlash",{enumerable:!0,get:function(){return l(n).default}})}}]);