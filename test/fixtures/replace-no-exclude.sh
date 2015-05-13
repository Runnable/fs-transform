# RULE 9000
# {
#   action: replace,
#   search: "absolutely",
#   replace: "probably"
# }

results=($(grep -rl 'absolutely' $search_files))
excludes=""
if ((${#results[@]} > 0)); then
  for name in $results
  do
    if [[ ! $excludes =~ $name ]]; then
      sed -i.last 's/absolutely/probably/g' $name || {
        warning "Rule 9000: could not replace 'absolutely' with 'probably' in $name"
      }
      rm -f $name.last
    fi
  done
else
  warning "Rule 9000: no search results to replace."
fi
