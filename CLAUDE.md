After editing UI files, run a Rams quick_review on them with via set to rules, and fix what it flags.

Verify UI changes in a real browser with the `agent-browser` CLI against the local dev server; `agent-browser skills get core` has the usage. The Claude in Chrome extension runs on a different machine and cannot reach localhost.

Redirect every `agent-browser` call's output to a file (`agent-browser open <url> > log 2>&1 < /dev/null; cat log`). Its first call spawns a daemon that inherits stdout, so a pipe (`| tail`) or captured output waits until the daemon exits an hour later and the command looks hung.
