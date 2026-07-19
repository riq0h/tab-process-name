# tab-process-name: rename the herdr tab to the running command the moment
# it starts/finishes, mirroring tmux's automatic-rename. Optional companion
# to the event-driven plugin (sync.mts) — herdr emits no event when a shell
# simply runs a command, so this gives instant updates instead of waiting
# for the next herdr-level event.
#
# No number is involved (see sync.mts for why), so unlike a numbering
# scheme there's nothing to look up or cache here — just set the label.
#
# Source this file from ~/.zshrc (only takes effect inside herdr panes).

if [[ -n "$HERDR_ENV" && -n "$HERDR_TAB_ID" ]]; then
  _herdr_tpn_rename() {
    local herdr_bin="${HERDR_BIN_PATH:-herdr}"
    "$herdr_bin" tab rename "$HERDR_TAB_ID" "$1" >/dev/null 2>&1
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
