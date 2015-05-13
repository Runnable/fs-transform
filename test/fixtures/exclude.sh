# RULE 1234
# {
#   action: "exclude",
#   files: [A.dmg, B.tar.gz, gamma.pajama]
# }
search_files=`find . -type f \( ! -name 'A.dmg' \) \( ! -name 'B.tar.gz' \) \( ! -name 'gamma.pajama' \)`
