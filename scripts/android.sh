#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Use a compatible installed JDK without changing the user's shell configuration.
if [[ "$(uname -s)" == Darwin ]] && /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
  export JAVA_HOME
  JAVA_HOME="$(/usr/libexec/java_home -v 21)"
fi
exec npx react-native run-android "$@"
