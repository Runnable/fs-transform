#!/bin/bash

#
# Warning: this is a generated file, modifications may be overwritten.
#

_script_name=`basename $0`
search_files=`find . -type f | grep -v './.git'`
warning() { echo "($_script_name) WARNING" $1; }
error() { echo "($_script_name) ERROR" $1; exit 1; }

command -v cp >/dev/null 2>&1 || {
  error "Missing required command: cp";
}
command -v mv >/dev/null 2>&1 || {
  error "Missing required command: mv";
}
command -v grep >/dev/null 2>&1 || {
  error "Missing required command: grep";
}
command -v sed >/dev/null 2>&1 || {
  error "Missing required command: sed";
}
command -v diff >/dev/null 2>&1 || {
  error "Missing required command: diff";
}
command -v rm >/dev/null 2>&1 || {
  error "Missing required command: rm";
}
