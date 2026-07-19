# tab-process-name: rename the herdr tab to "<number> <running command>"
# the moment a command starts/finishes, mirroring tmux's automatic-rename.
# Optional companion to the event-driven plugin (sync.mts) — herdr emits no
# event when a shell simply runs a command, so this gives instant updates.
# Source this file from ~/.zshrc (only takes effect inside herdr panes).
#
# Requires jq on PATH.

if [[ -n "$HERDR_ENV" && -n "$HERDR_TAB_ID" ]]; then
  typeset -g _herdr_tpn_number=""

  _herdr_tpn_resolve_number() {
    local herdr_bin="${HERDR_BIN_PATH:-herdr}"
    _herdr_tpn_number=$("$herdr_bin" tab get "$HERDR_TAB_ID" 2>/dev/null \
      | command jq -r '.result.tab.number // empty' 2>/dev/null)
  }

  _herdr_tpn_rename() {
    [[ -z "$_herdr_tpn_number" ]] && _herdr_tpn_resolve_number
    [[ -z "$_herdr_tpn_number" ]] && return
    local herdr_bin="${HERDR_BIN_PATH:-herdr}"
    "$herdr_bin" tab rename "$HERDR_TAB_ID" "${_herdr_tpn_number} $1" >/dev/null 2>&1
  }

  _herdr_tpn_preexec() {
    _herdr_tpn_rename "${1%% *}"
  }

  _herdr_tpn_precmd() {
    _herdr_tpn_rename "zsh"
  }

  autoload -Uz add-zsh-hook
  add-zsh-hook preexec _herdr_tpn_preexec
  add-zsh-hook precmd _herdr_tpn_precmd
  _herdr_tpn_precmd
fi
