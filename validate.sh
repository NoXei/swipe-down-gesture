#!/bin/sh
set -eu

glib-compile-schemas schemas
for file in extension.js gesture-adapter.js window-manager.js prefs.js; do
    node --check "$file"
done

python3 -m json.tool metadata.json >/dev/null
printf '%s\n' 'Static validation passed.'
