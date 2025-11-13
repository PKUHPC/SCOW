import Icon from "@ant-design/icons";
import React, { LegacyRef } from "react";

// 定义图标组件的接口以接受样式属性

// 提交作业的SVG
const submitJobSVG = () => (
  <svg width="1em" height="1.1em" viewBox="0 0 80 85" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5 2.5H62C63.3807 2.5 64.5 3.61929 64.5 5V11.9118V43.6765
    V70C64.5 71.3807 63.3807 72.5 62 72.5H5C3.61929 72.5 2.5 71.3807 2.5 70
    V5C2.5 3.61929 3.61929 2.5 5 2.5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
    />
    <path
      opacity="0.2"
      d="M20 13.5H75C76.3807 13.5 77.5 14.6193 77.5 16V22.7529
    V54.0941V80C77.5 81.3807 76.3807 82.5 75 82.5H20C18.6193 82.5 17.5 81.3807 17.5 80
    V16C17.5 14.6193 18.6193 13.5 20 13.5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
    />
    <path d="M15.2354 22H50.5295" stroke="white" strokeWidth="5" strokeLinecap="round" />
    <path d="M15.2354 37.8823H41.7059" stroke="white" strokeWidth="5" strokeLinecap="round" />
    <path d="M15.2354 53.7646H32.8824" stroke="white" strokeWidth="5" strokeLinecap="round" />
    <circle opacity="0.8" cx="60" cy="65" r="17" fill="white" />
    <path d="M54 65L66 65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M60 59L60 71" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const SubmitJobIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={submitJobSVG} {...props} ref={ref} />
));

// 未结束作业的SVG
const runningJobSVG = () => (
  <svg width="1em" height="1.1em" viewBox="0 0 80 85" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5 2.5H62C63.3807 2.5 64.5 3.61929 64.5 5V11.9118V43.6765V70C64.5 71.3807 63.3807 72.5 62 72.5
    H5C3.61929 72.5 2.5 71.3807 2.5 70V5C2.5 3.61929 3.61929 2.5 5 2.5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
    />
    <path
      opacity="0.2"
      d="M20 13.5H75C76.3807 13.5 77.5 14.6193 77.5 16V22.7529V54.0941V80
    C77.5 81.3807 76.3807 82.5 75 82.5H20C18.6193 82.5 17.5 81.3807 17.5 80V16C17.5 14.6193 18.6193 13.5 20 13.5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
    />
    <path d="M15.2354 22H50.5295" stroke="white" strokeWidth="5" strokeLinecap="round" />
    <path d="M15.2354 37.8823H41.7059" stroke="white" strokeWidth="5" strokeLinecap="round" />
    <path d="M15.2354 53.7646H32.8824" stroke="white" strokeWidth="5" strokeLinecap="round" />
    <circle opacity="0.8" cx="60" cy="65" r="17" fill="white" />
    <path d="M59.0001 60L59 68.5H67.4627" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const RunningJobIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={runningJobSVG} {...props} ref={ref} />
));

// 所有作业的SVG
const allJobsSVG = () => (
  <svg width="1em" height="1.1em" viewBox="0 0 80 85" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect opacity="0.2" x="9.125" y="13" width="70.875" height="72" rx="5" fill="currentColor" />
    <rect x="2.5" y="2.5" width="27" height="27" rx="2.5" fill="currentColor" stroke="currentColor" strokeWidth="5" />
    <rect
      x="2.5"
      y="40.4331"
      width="27"
      height="27"
      rx="2.5"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="5"
    />
    <rect x="40.5" y="2.5" width="27" height="27" rx="2.5" fill="currentColor" stroke="currentColor" strokeWidth="5" />
    <path d="M44.5498 49.4004H72.0581" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <path d="M44.5498 59.5774H66.3667" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <path d="M44.5498 69.7544H57.8297" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

export const AllJobsIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={allJobsSVG} {...props} ref={ref} />
));

// 作业模板SVG
const templateJobSVG = () => (
  <svg width="1em" height="1.1em" viewBox="0 0 80 85" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect
      opacity="0.2"
      x="2.5"
      y="2.5"
      width="75"
      height="80"
      rx="2.5"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="5"
    />
    <rect x="7" y="5" width="66" height="21" rx="2" fill="currentColor" />
    <rect x="7" y="32" width="40" height="28" rx="2" fill="currentColor" />
    <rect x="7" y="66" width="40" height="14" rx="2" fill="currentColor" />
    <rect width="20" height="48" rx="2" transform="matrix(-1 0 0 1 73 32)" fill="currentColor" />
  </svg>
);

export const TemplatejobIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={templateJobSVG} {...props} ref={ref} />
));

// shellSVG

const shellSVG = () => (
  <svg width="1em" height="1.1em" viewBox="0 0 80 85" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="10" width="72" height="75" rx="5" fill="currentColor" fillOpacity="0.2" />
    <rect x="2.5" y="2.5" width="67" height="69" rx="2.5" fill="currentColor" stroke="currentColor" strokeWidth="5" />
    <line y1="21.5" x2="72" y2="21.5" stroke="white" strokeWidth="3" />
    <ellipse cx="10.8815" cy="10.8296" rx="2.52257" ry="2.5" fill="white" />
    <ellipse cx="19.2403" cy="10.8296" rx="2.52257" ry="2.5" fill="white" />
    <ellipse cx="27.5992" cy="10.8296" rx="2.52257" ry="2.5" fill="white" />
    <path
      d="M18.5752 42.0227L29.7204 50.76
L18.5752 59.5113"
      stroke="white"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M37.1504 56.75H53.8682" stroke="white" strokeWidth="5" strokeLinecap="round" />
  </svg>

);

export const ShellIcon: React.ForwardRefExoticComponent<{}> = React.forwardRef((props,
  ref: LegacyRef<HTMLSpanElement> | undefined) => (
  <Icon component={shellSVG} {...props} ref={ref} />
));
