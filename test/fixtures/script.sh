#!/bin/bash

#
# Warning: this is a generated file, modifications may be overwritten.
#

_script_name=`basename $0`
search_files='.'
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

# RULE 1
# {
#   action: replace,
#   search: "\sum",
#   replace: "\prod"
# }

results=($(grep -rlI '\\sum' $search_files))
excludes=""
if ((${#results[@]} > 0)); then
  for name in $results
  do
    if [[ ! $excludes =~ $name ]]; then
      sed -i.last 's/\\sum/\\prod/g' $name || {
        warning "Rule 1: could not replace '\\sum' with '\\prod' in $name"
      }
      rm -f $name.last
    fi
  done
else
  warning "Rule 1: no search results to replace."
fi

# RULE 2
# {
#   action: "copy",
#   source: "A",
#   dest: "A-copy"
# }

cp A A-copy || {
  warning "Rule 2: unable to copy A to A-copy"
}

# RULE 3
# {
#   action: "copy",
#   source: "B",
#   dest: "B-copy"
# }

cp B B-copy || {
  warning "Rule 3: unable to copy B to B-copy"
}

# RULE 4
# {
#   action: "rename",
#   source: "sub/C",
#   dest: "sub/C-rename"
# }

mv sub/C sub/C-rename || {
  warning "Rule 4: unable to rename sub/C to sub/C-rename"
}
