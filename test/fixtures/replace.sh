# RULE 55
# {
#   action: replace,
#   search: "whut",
#   replace: "wat",
#   excludes: [A.dmg, B.tar.gz]
# }

replace 'whut' 'wat' './A.dmg ./B.tar.gz'
