#!/bin/sh

#
# Warning: this is a generated file, modifications may be overwritten.
#

# from rule: {"action":"replace","search":"\\sum","replace":"\\prod"}
sed -i.last '2s/\\sum/\\prod/g' $ROOT/sub/C

# from rule: {"action":"copy","source":"A","dest":"A-copy"}
cp $ROOT/A $ROOT/A-copy

# from rule: {"action":"copy","source":"B","dest":"B-copy"}
cp $ROOT/B $ROOT/B-copy

# from rule: {"action":"rename","source":"sub/C","dest":"sub/C-rename"}
mv $ROOT/sub/C $ROOT/sub/C-rename
