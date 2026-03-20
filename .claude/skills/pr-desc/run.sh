#!/bin/bash
OP=$1
BASE=${2:-master}

case $OP in
  base)
    echo "$BASE"
    ;;
  log)
    git log "$BASE"...HEAD --oneline
    ;;
  stat)
    git diff "$BASE"...HEAD --stat
    ;;
  diff)
    git diff "$BASE"...HEAD
    ;;
esac
