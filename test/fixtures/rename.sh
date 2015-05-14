# RULE 42
# {
#   action: "rename",
#   source: "foo.txt",
#   dest: "bar.rtf"
# }

mv foo.txt bar.rtf || {
  warning "Rule 42: unable to rename foo.txt to bar.rtf"
}
