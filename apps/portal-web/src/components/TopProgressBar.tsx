import { finallyEvent, prefetchEvent } from "@ddadaal/next-typed-api-routes-runtime/lib/client";
import { isServer } from "@scow/lib-web/build/utils/isServer";
import Router from "next/router";
import NProgress from "nprogress";

NProgress.configure({ showSpinner: false });

let timer: NodeJS.Timeout;
let state: string;
let activeRequests = 0;
const delay = 250;

function load() {
  if (state === "loading") {
    return;
  }

  state = "loading";

  timer = setTimeout(function () {
    NProgress.start();
  }, delay); // only show progress bar if it takes longer than the delay
}

function stop() {
  if (activeRequests > 0) {
    return;
  }

  state = "stop";

  clearTimeout(timer);
  NProgress.done();
}

Router.events.on("routeChangeStart", load);
Router.events.on("routeChangeComplete", stop);
Router.events.on("routeChangeError", stop);

export function incrementRequest() {
  activeRequests++;
  load();
}

export function decrementRequest() {
  activeRequests--;
  stop();
}

// register HTTP request loading
if (!isServer()) {
  prefetchEvent.register(incrementRequest);
  finallyEvent.register(decrementRequest);
}

export default function Dummy() {
  return null;
}
