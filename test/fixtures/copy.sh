# RULE 102
# {
#   action: "copy",
#   source: "foo.txt",
#   dest: "bar.rtf"
# }

cp foo.txt bar.rtf || {
  warning "Rule 102: unable to copy foo.txt to bar.rtf"
}
