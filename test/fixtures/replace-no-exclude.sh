# RULE 9000
# {
#   action: replace,
#   search: "absolutely",
#   replace: "probably"# }

results=$(grep -rL 'absolutely' $search_files)
excludes=""
if $results; then
  for name in $results do
    if [[ ! $excludes =~ $name ]]; then
      sed -i.last 's/absolutely/probably/g' $name || {
        warning "Rule 9000: could not replace 'absolutely' with 'probably' in $name"
      }
    fi
  done
else
  warning "Rule 9000: no search results to replace."
fi
