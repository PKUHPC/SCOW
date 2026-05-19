"use client";

import { useIsFetching } from "@tanstack/react-query";
import NProgress from "nprogress";
import { useEffect, useRef } from "react";

const delay = 250;

export function TopProgressBar() {
  const isFetching = useIsFetching();

  const on = useRef(false);

  const timer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isFetching > 0) {
      if (on.current) {
        return;
      }

      on.current = true;
      timer.current = setTimeout(function () {
        NProgress.start();
      }, delay); // only show progress bar if it takes longer than the delay
    } else {
      on.current = false;
      clearTimeout(timer.current);
      NProgress.done();
    }
  }, [isFetching]);

  useEffect(() => {
    NProgress.configure({ showSpinner: false });
  }, []);

  return null;
}
