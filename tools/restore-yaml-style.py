#!/usr/bin/env python3
"""Put back the original text of the YAML blocks a tool rewrote without changing.

Some global scripts (record-cycle-time.sh, bp-timing.sh) load a state file and
write it back with yaml.dump. The data survives; comments, the leading ---,
folded scalars and line wrapping do not (BUG-005). This tool compares the
file with an earlier copy, one top-level block at a time. A block whose data
is equal gets its old text back. A block whose data changed, and a block that
is new, keep the text as written. Nothing here changes data: the result must
load to the same data as the input, or the file is left alone.

Usage: restore-yaml-style.py FILE (--from SNAPSHOT | --base REV)
  --from SNAPSHOT  a copy of FILE taken before the script ran
  --base REV       read the old text from git, for example HEAD
Exit: 0 done or nothing to do, 2 bad input (FILE is not modified).
"""
import argparse
import os
import re
import subprocess
import sys

try:
    import yaml
except ImportError:
    sys.exit("restore-yaml-style: PyYAML is required")

KEY = re.compile(r"^([A-Za-z_][\w.-]*):")


def split(text):
    """Return (preamble, [(key, block_text), ...]) for top-level keys."""
    preamble, blocks = [], []
    for line in text.splitlines(keepends=True):
        m = KEY.match(line)
        if m:
            blocks.append([m.group(1), line])
        elif blocks:
            blocks[-1][1] += line
        else:
            preamble.append(line)
    return "".join(preamble), [(k, t) for k, t in blocks]


def restore(old, new):
    old_pre, old_blocks = split(old)
    new_pre, new_blocks = split(new)
    old_by_key = dict(old_blocks)
    out = [old_pre if old_pre.strip() else new_pre]
    for key, text in new_blocks:
        before = old_by_key.get(key)
        if before is not None and yaml.safe_load(before) == yaml.safe_load(text):
            text = before
        if not text.endswith("\n"):
            text += "\n"
        out.append(text)
    return "".join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("file")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--from", dest="snapshot")
    src.add_argument("--base")
    a = ap.parse_args()
    try:
        new = open(a.file).read()
        if a.snapshot:
            old = open(a.snapshot).read()
        else:
            d, name = os.path.dirname(a.file) or ".", os.path.basename(a.file)
            old = subprocess.run(["git", "-C", d, "show", f"{a.base}:./{name}"],
                                 capture_output=True, text=True, check=True).stdout
        data_new = yaml.safe_load(new)
        yaml.safe_load(old)
        result = restore(old, new)
        if yaml.safe_load(result) != data_new:
            raise ValueError("restored text would change the data")
    except (OSError, subprocess.CalledProcessError, yaml.YAMLError, ValueError) as e:
        print(f"restore-yaml-style: {e}", file=sys.stderr)
        sys.exit(2)
    if result != new:
        open(a.file, "w").write(result)


if __name__ == "__main__":
    main()
