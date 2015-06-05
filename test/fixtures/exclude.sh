# RULE 1234
# {
#   action: "exclude",
#   files: [A.dmg, B.tar.gz, gamma.pajama]
# }
search_files=`find . -type f | grep -v './.git' | grep -v '^./A.dmg$' | grep -v '^./B.tar.gz$' | grep -v '^./gamma.pajama$'`
