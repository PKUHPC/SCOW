"use strict";(self.webpackChunk_scow_docs=self.webpackChunk_scow_docs||[]).push([[1458],{4852:(e,n,t)=>{t.d(n,{Zo:()=>s,kt:()=>d});var o=t(9231);function r(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function a(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);n&&(o=o.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,o)}return t}function i(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?a(Object(t),!0).forEach((function(n){r(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):a(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function l(e,n){if(null==e)return{};var t,o,r=function(e,n){if(null==e)return{};var t,o,r={},a=Object.keys(e);for(o=0;o<a.length;o++)t=a[o],n.indexOf(t)>=0||(r[t]=e[t]);return r}(e,n);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(o=0;o<a.length;o++)t=a[o],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(r[t]=e[t])}return r}var p=o.createContext({}),c=function(e){var n=o.useContext(p),t=n;return e&&(t="function"==typeof e?e(n):i(i({},n),e)),t},s=function(e){var n=c(e.components);return o.createElement(p.Provider,{value:n},e.children)},g="mdxType",u={inlineCode:"code",wrapper:function(e){var n=e.children;return o.createElement(o.Fragment,{},n)}},m=o.forwardRef((function(e,n){var t=e.components,r=e.mdxType,a=e.originalType,p=e.parentName,s=l(e,["components","mdxType","originalType","parentName"]),g=c(t),m=r,d=g["".concat(p,".").concat(m)]||g[m]||u[m]||a;return t?o.createElement(d,i(i({ref:n},s),{},{components:t})):o.createElement(d,i({ref:n},s))}));function d(e,n){var t=arguments,r=n&&n.mdxType;if("string"==typeof e||r){var a=t.length,i=new Array(a);i[0]=m;var l={};for(var p in n)hasOwnProperty.call(n,p)&&(l[p]=n[p]);l.originalType=e,l[g]="string"==typeof e?e:r,i[1]=l;for(var c=2;c<a;c++)i[c]=t[c];return o.createElement.apply(null,i)}return o.createElement.apply(null,t)}m.displayName="MDXCreateElement"},9964:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>p,contentTitle:()=>i,default:()=>u,frontMatter:()=>a,metadata:()=>l,toc:()=>c});var o=t(5675),r=(t(9231),t(4852));const a={sidebar_position:2,title:"Go"},i="Go\u793a\u4f8b",l={unversionedId:"integration/scow-api-hook/examples/go",id:"integration/scow-api-hook/examples/go",title:"Go",description:"\u793a\u4f8b\u9879\u76ee\uff1ahttps://github.com/PKUHPC/scow-go-demo",source:"@site/docs/integration/scow-api-hook/examples/go.md",sourceDirName:"integration/scow-api-hook/examples",slug:"/integration/scow-api-hook/examples/go",permalink:"/SCOW/pr-preview/pr-610/docs/integration/scow-api-hook/examples/go",draft:!1,editUrl:"https://github.com/PKUHPC/SCOW/edit/main/website/docs/integration/scow-api-hook/examples/go.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2,title:"Go"},sidebar:"integration",previous:{title:"\u4f7f\u7528\u793a\u4f8b",permalink:"/SCOW/pr-preview/pr-610/docs/category/\u4f7f\u7528\u793a\u4f8b"}},p={},c=[{value:"\u51c6\u5907\u73af\u5883",id:"\u51c6\u5907\u73af\u5883",level:2},{value:"\u4f7f\u7528Buf\u83b7\u53d6Proto\u6587\u4ef6\u5e76\u751f\u6210\u4ee3\u7801",id:"\u4f7f\u7528buf\u83b7\u53d6proto\u6587\u4ef6\u5e76\u751f\u6210\u4ee3\u7801",level:2},{value:"\u4f7f\u7528SCOW API",id:"\u4f7f\u7528scow-api",level:2},{value:"\u5b9e\u73b0\u5e76\u6ce8\u518cSCOW Hook",id:"\u5b9e\u73b0\u5e76\u6ce8\u518cscow-hook",level:2}],s={toc:c},g="wrapper";function u(e){let{components:n,...t}=e;return(0,r.kt)(g,(0,o.Z)({},s,t,{components:n,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"go\u793a\u4f8b"},"Go\u793a\u4f8b"),(0,r.kt)("p",null,"\u793a\u4f8b\u9879\u76ee\uff1a",(0,r.kt)("a",{parentName:"p",href:"https://github.com/PKUHPC/scow-go-demo"},"https://github.com/PKUHPC/scow-go-demo")),(0,r.kt)("h2",{id:"\u51c6\u5907\u73af\u5883"},"\u51c6\u5907\u73af\u5883"),(0,r.kt)("p",null,"\u60a8\u9700\u8981\uff1a"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"\u5b89\u88c5\u597dGo\u8bed\u8a00\u5f00\u53d1\u5de5\u5177\u94fe\uff08",(0,r.kt)("a",{parentName:"li",href:"https://go.dev/"},"Go\u8bed\u8a00\u5b98\u7f51"),"\uff09"),(0,r.kt)("li",{parentName:"ul"},"\u5b89\u88c5Buf CLI\uff08",(0,r.kt)("a",{parentName:"li",href:"https://buf.build/docs/installation/"},"\u5b98\u7f51\u6587\u6863"),"\uff09"),(0,r.kt)("li",{parentName:"ul"},"\u6709\u4e00\u4e2aGo\u9879\u76ee")),(0,r.kt)("p",null,"\u60a8\u53ef\u4ee5\u901a\u8fc7",(0,r.kt)("inlineCode",{parentName:"p"},"go mod init"),"\u547d\u4ee4\uff0c\u521d\u59cb\u5316\u4e00\u4e2aGo\u9879\u76ee\uff0c\u5047\u8bbe\u6a21\u5757\u540d\u4e3a",(0,r.kt)("inlineCode",{parentName:"p"},"github.com/PKUHPC/scow-go-demo")),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"go mod init github.com/PKUHPC/scow-go-demo\n")),(0,r.kt)("h2",{id:"\u4f7f\u7528buf\u83b7\u53d6proto\u6587\u4ef6\u5e76\u751f\u6210\u4ee3\u7801"},"\u4f7f\u7528Buf\u83b7\u53d6Proto\u6587\u4ef6\u5e76\u751f\u6210\u4ee3\u7801"),(0,r.kt)("p",null,"\u521b\u5efa",(0,r.kt)("inlineCode",{parentName:"p"},"buf.gen.yaml"),"\u6587\u4ef6\uff0c\u5185\u5bb9\u5982\u4e0b\uff1a"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-yaml",metastring:'title="buf.gen.yaml"',title:'"buf.gen.yaml"'},"version: v1\nmanaged:\n  enabled: true\n  go_package_prefix:\n    # \u9879\u76ee\u6a21\u5757\u540d+\u751f\u6210\u8def\u5f84\uff08plugins\u4e2dout\uff09\n    default: github.com/PKUHPC/scow-go-demo/gen/go\n    except:\n        - buf.build/googleapis/googleapis\nplugins:\n  - plugin: buf.build/protocolbuffers/go\n    out: gen/go\n    opt: paths=source_relative\n  - plugin: buf.build/grpc/go\n    out: gen/go\n    opt: paths=source_relative,require_unimplemented_servers=false\n\n")),(0,r.kt)("p",null,"\u6307\u5b9a\u9700\u8981\u4f7f\u7528\u7684SCOW\u7684\u7248\u672c\uff0c\u751f\u6210\u4ee3\u7801"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"# \u901a\u8fc7#\u540e\u7684\u53c2\u6570\u786e\u8ba4SCOW\u7248\u672c\uff0c\u53ef\u8f93\u5165\u5206\u652f\uff08branch=master\uff09, SCOW Tag\u53f7\uff08tag=v0.4.0\uff09\n# \u4e0d\u5199\u9ed8\u8ba4\u4f7f\u7528SCOW\u7684master\u5206\u652f\u7248\u672c\nbuf generate --template buf.gen.yaml https://github.com/PKUHPC/SCOW.git#subdir=protos,branch=master\n")),(0,r.kt)("h2",{id:"\u4f7f\u7528scow-api"},"\u4f7f\u7528SCOW API"),(0,r.kt)("p",null,"\u7f16\u5199Go\u4ee3\u7801\u4f7f\u7528\u8c03\u7528SCOW API\u7684\u4ee3\u7801"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-go",metastring:'title="api.go"',title:'"api.go"'},'package main\n\nimport (\n    "context"\n    "log"\n\n    "github.com/PKUHPC/scow-go-demo/gen/go/server"\n    "google.golang.org/grpc"\n    "google.golang.org/grpc/credentials/insecure"\n)\n\nfunc main() {\n  // \u5047\u8bbemis-server\u5728192.168.88.100:7571\u4e0a\u76d1\u542c\n    conn, err := grpc.Dial("192.168.88.100:7571", grpc.WithTransportCredentials(insecure.NewCredentials()))\n\n  if err != nil {\n    panic(err)\n  }\n\n  // \u751f\u6210AccountServiceClient\n    client := server.NewAccountServiceClient(conn)\n\n  // \u8c03\u7528`GetAccounts` RPC\uff0c\u83b7\u53d6\u6240\u6709\u8d26\u6237\n    resp, err := client.GetAccounts(context.Background(), &server.GetAccountsRequest{})\n\n    if err != nil {\n        panic(err)\n    }\n\n    log.Printf("Account list: %v", resp)\n}\n')),(0,r.kt)("p",null,"\u4e0b\u8f7d\u4f9d\u8d56\u5e76\u8fd0\u884c"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"go mod tidy\ngo run api.go\n")),(0,r.kt)("h2",{id:"\u5b9e\u73b0\u5e76\u6ce8\u518cscow-hook"},"\u5b9e\u73b0\u5e76\u6ce8\u518cSCOW Hook"),(0,r.kt)("p",null,"\u521b\u5efa\u4e00\u4e2a",(0,r.kt)("inlineCode",{parentName:"p"},"hook.go"),"\u6587\u4ef6\uff0c\u5b9e\u73b0HookServiceServer (protos/hook/hook.proto)"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-go",metastring:'title="hook.go"',title:'"hook.go"'},'package main\n\nimport (\n    "context"\n    "log"\n    "net"\n\n    "github.com/PKUHPC/scow-go-demo/gen/go/hook"\n    "google.golang.org/grpc"\n    "google.golang.org/protobuf/encoding/protojson"\n)\n\ntype MyHookServer struct{}\n\nfunc (s *MyHookServer) OnEvent(ctx context.Context, req *hook.OnEventRequest) (*hook.OnEventResponse, error) {\n\n    log.Printf("Received event: %+v", protojson.Format(req))\n\n    return &hook.OnEventResponse{}, nil\n}\n\nfunc main() {\n\n    addr := "0.0.0.0:5000"\n\n    lis, err := net.Listen("tcp", addr)\n    if err != nil {\n        log.Fatalf("failed to listen: %v", err)\n    }\n    var opts []grpc.ServerOption\n    grpcServer := grpc.NewServer(opts...)\n\n    server := MyHookServer{}\n\n    hook.RegisterHookServiceServer(grpcServer, &server)\n    log.Printf("Listening at %s", addr)\n\n    grpcServer.Serve(lis)\n}\n\n')),(0,r.kt)("p",null,"\u4e0b\u8f7d\u4f9d\u8d56\u5e76\u8fd0\u884c"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"go mod tidy\ngo run hook.go\n")),(0,r.kt)("p",null,"\u4fee\u6539",(0,r.kt)("inlineCode",{parentName:"p"},"config/common.yaml"),"\u6587\u4ef6\uff0c\u914d\u7f6eHook Server\u7684\u5730\u5740"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-yaml",metastring:'title="config/common.yaml"',title:'"config/common.yaml"'},"scowHook:\n  url: localhost:5000\n")),(0,r.kt)("p",null,"\u91cd\u542fSCOW\u3002\u5f53SCOW\u6709\u76f8\u5173\u4e8b\u4ef6\u53d1\u751f\u65f6\uff0cSCOW\u4f1a\u8c03\u7528Hook Server\u3002"))}u.isMDXComponent=!0}}]);