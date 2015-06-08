# RULE 5678
# {
#   action: replace,
#   search: "yes",
#   replace: "no",
#   exclude: [./file.txt, ./somefile.txt, ./somefile2.txt, ./yarfile.txt]
# }

replace 'yes' 'no' './file.txt ./somefile.txt ./somefile2.txt ./yarfile.txt'
