#!/bin/sh

echo "=== Container Starting ===" >&2
echo "Working directory: $(pwd)" >&2
echo "Node version: $(node --version)" >&2
echo "Files in server:" >&2
ls -la server/ >&2

echo "=== Running test-startup.js ===" >&2
node server/test-startup.js
echo "=== Script exited with code: $? ===" >&2
