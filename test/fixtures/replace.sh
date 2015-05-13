# RULE 55
# {
#   action: replace,
#   search: "whut",
#   replace: "wat",
#   excludes: [A.dmg, B.tar.gz]
# }

results=($(grep -rl 'whut' $search_files))
excludes="A.dmg B.tar.gz"
if ((${#results[@]} > 0)); then
  for name in $results
  do
    if [[ ! $excludes =~ $name ]]; then
      sed -i.last 's/whut/wat/g' $name || {
        warning "Rule 55: could not replace 'whut' with 'wat' in $name"
      }
      rm -f $name.last
    fi
  done
else
  warning "Rule 55: no search results to replace."
fi
