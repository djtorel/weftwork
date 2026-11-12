# story: e06s02
# Held-out case: a command that exits 0 after it edited a tracked file.
# The gate must reject it, since the tree changed under the command.
echo changed >> tracked.txt
exit 0
