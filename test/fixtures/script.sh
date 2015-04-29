#!/bin/sh

#
# Warning: this is a generated file, modifications may be overwritten.
#

# Check to ensure required commands are available
command -v cp >/dev/null 2>&1 || { echo "Required command: cp -- Please install it before running this script."; exit 1; }
command -v mv >/dev/null 2>&1 || { echo "Required command: mv -- Please install it before running this script."; exit 1; }
command -v grep >/dev/null 2>&1 || { echo "Required command: grep -- Please install it before running this script."; exit 1; }
command -v sed >/dev/null 2>&1 || { echo "Required command: sed -- Please install it before running this script."; exit 1; }
command -v diff >/dev/null 2>&1 || { echo "Required command: diff -- Please install it before running this script."; exit 1; }
command -v rm >/dev/null 2>&1 || { echo "Required command: rm -- Please install it before running this script."; exit 1; }
# END Required command check

# from rule: {"action":"replace","search":"\\sum","replace":"\\prod"}
sed -i.last '2s/\\sum/\\prod/g' $ROOT/sub/C

# from rule: {"action":"copy","source":"A","dest":"A-copy"}
cp $ROOT/A $ROOT/A-copy

# from rule: {"action":"copy","source":"B","dest":"B-copy"}
cp $ROOT/B $ROOT/B-copy

# from rule: {"action":"rename","source":"sub/C","dest":"sub/C-rename"}
mv $ROOT/sub/C $ROOT/sub/C-rename
