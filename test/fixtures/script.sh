#!/bin/bash

#
# Warning: this is a generated file, modifications may be overwritten.
#

# Global script variables
script_name=`basename $0`
global_exclude="./$script_name"
rule_count=1

# Color Codes
Clear='\e[0m'
Red='\e[1;31m'
Yellow='\e[1;33m'
White='\e[1;37m'

# Logging functions
log() {
  printf "(${White}${script_name}${Clear}) $1\n";
}

warning() {
  printf "(${White}${script_name}${Clear}) ${Yellow}WARNING${Clear} $1\n"
}

error() {
  printf "(${White}${script_name}${Clear}) ${Red}ERROR${Clear} $1\n"
  exit 1;
}

# Ensure needed commands are installed
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
command -v rm >/dev/null 2>&1 || {
  error "Missing required command: rm";
}

# File rename.
# Arguments:
#   $1 - Source file
#   $2 - Destination file
function rename {
  log "Rule $rule_count: Renaming file $1 to $2"
  mv $1 $2 || {
    warning "Rule $rule_count: unable to rename $1 to $2"
  }
  ((rule_count++))
}

# Performs a file copy
# Arguments:
#   $1 - Source file
#   $2 - Destination file
function copy {
  log "Rule $rule_count: Copying file $1 to $2"
  cp $1 $2 || {
    warning "Rule $rule_count: unable to copy $1 to $2"
  }
  ((rule_count++))
}

# Performs a find-and-replace rule.
# Arguments:
#   $1 - Search pattern
#   $2 - Replace text
#   $3 - Local exclusions
function replace {
  local git_pattern='.git/'
  log "Rule $rule_count: Replacing instances of '$1' with '$2'"
  for name in $(eval "grep -rlI '$1' .")
  do
    # Always exclude .git/ files
    if [[ $name =~ $git_pattern ]]; then continue; fi

    # Exclude files from the global and local exclude lists
    local exclude_list="$global_exclude $3"
    local execute=1
    for exclude_file in $exclude_list
    do
      if [[ $name == $exclude_file ]]; then
        execute=0
        break;
      fi
    done
    if [[ $execute == 0 ]]; then continue; fi

    # Perform the search and replace
    log "--- sed -i.last 's/$1/$2/g' $name"
    sed -i.last "s/$1/$2/g" $name || {
      warning "Rule $rule_count: could not replace '$1' with '$2' in $name"
    }
    rm -f $name.last
  done
  ((rule_count++))
}

###########################  BEGIN Transformation Rules ########################

# RULE 1
# {
#   action: replace,
#   search: "\sum",
#   replace: "\prod"
# }

replace '\\sum' '\\prod' ''

# RULE 2
# {
#   action: "copy",
#   source: "A",
#   dest: "A-copy"
# }

copy A A-copy

# RULE 3
# {
#   action: "copy",
#   source: "B",
#   dest: "B-copy"
# }

copy B B-copy

# RULE 4
# {
#   action: "rename",
#   source: "sub/C",
#   dest: "sub/C-rename"
# }

rename sub/C sub/C-rename
