# tab-process-name

A [herdr](https://herdr.dev/) plugin that labels each tab `<number>
<foreground process>` — tmux's `automatic-rename` behavior for herdr.

Before: `1` · `2` · `3` — After: `1 zsh` · `2 nvim` · `3 claude`

## How it works

The plugin hooks herdr events (tab/pane created, focused, moved, closed, agent
status changes, workspace focus) and, on each event, walks every workspace and
relabels tabs through `herdr tab rename`.

A tab's process name is resolved from its focused pane (or first pane) via
`herdr pane process-info` — the name of the pane's foreground process
(`zsh`, `nvim`, `claude`, ...).

Manual renames are respected. A tab is only relabeled when its label is still
the herdr default (a bare number like `1`) or a label this plugin set earlier.
Rename a tab yourself and the plugin leaves it alone from then on; rename it
back to a number to hand it back to the plugin.

Because herdr emits no event when a shell simply runs a command, a label can
lag until the next herdr-level event (switching tabs or panes, agent status
changes, and so on). Source the optional [shell hook](#instant-updates-optional)
for instant updates instead.

## Requirements

- herdr `>= 0.7.0`
- [Node.js](https://nodejs.org/) 22.18 or newer on your `PATH`
- `jq` on your `PATH` (only needed for the optional shell hook)

The plugin is a single dependency-free TypeScript file that Node runs directly
via [type stripping](https://nodejs.org/api/typescript.html) — there is no
build step, and the code you review is exactly the code that runs.

## Install

```bash
herdr plugin install riq0h/tab-process-name
```

Labels sync automatically from the next herdr event on. To force a sync:

```bash
herdr plugin action invoke riq0h.tab-process-name.sync
```

Optionally bind the sync action to a key in your herdr config:

```toml
[[keys.command]]
key = "prefix+alt+n"
type = "plugin_action"
command = "riq0h.tab-process-name.sync"
description = "sync tab process names"
```

## Instant updates (optional)

For labels that update the moment a command starts or finishes, source the
bundled shell hook inside herdr panes. It renames the pane's tab directly on
every `preexec`/`precmd` (bypassing the manual-rename protection for that tab,
since running a command is the intent). Find the plugin root with
`herdr plugin list`, then add to your shell rc:

```zsh
# ~/.zshrc
[[ -n "$HERDR_ENV" ]] && source /path/to/tab-process-name/shell/hook.zsh
```

The hook is a no-op outside herdr, so sourcing it unconditionally is also
fine. The event-driven plugin keeps covering panes that don't run an
interactive shell (agents, one-off commands, other shells).

Only a zsh hook ships today; a bash equivalent (`preexec`/`PROMPT_COMMAND`)
is a reasonable follow-up contribution.

## Configuration

Configuration is optional. Create `config.json` in the plugin config
directory (`herdr plugin config-dir riq0h.tab-process-name` prints the path):

```json
{
  "overwrite_manual": false,
  "max_length": 0
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `overwrite_manual` | `false` | Relabel every tab, including tabs you renamed manually. |
| `max_length` | `0` | Truncate labels longer than this to `max_length` characters with a trailing `…`. `0` disables truncation. |

## Disable / uninstall

```bash
herdr plugin disable riq0h.tab-process-name   # keep installed, stop hooks
herdr plugin uninstall riq0h.tab-process-name
```

## Development

```bash
git clone https://github.com/riq0h/tab-process-name
herdr plugin link ./tab-process-name
herdr plugin action invoke riq0h.tab-process-name.sync
herdr plugin log list --plugin riq0h.tab-process-name
```

The logic lives in `sync.mts`. State lives in
`HERDR_PLUGIN_STATE_DIR/labels.json` (the labels the plugin set, used to tell
its own labels apart from yours). Deleting it is safe; the plugin re-adopts
tabs whose labels are bare numbers.

## Credit

Structure and conventions borrowed from
[dev-shimada/herdr-auto-tab-name](https://github.com/dev-shimada/herdr-auto-tab-name),
which does the same thing for working-directory-based labels instead of
process names.

## License

MIT
