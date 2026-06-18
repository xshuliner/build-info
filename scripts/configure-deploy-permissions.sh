#!/usr/bin/env bash
set -euo pipefail

# Idempotently prepare server directories for SSH-based GitHub Actions deploys.
# Usage:
#   sudo bash scripts/configure-deploy-permissions.sh
#   sudo bash scripts/configure-deploy-permissions.sh /path/one /path/two
#   DEPLOY_PATHS=$'/path/one\n/path/two' sudo -E bash scripts/configure-deploy-permissions.sh
#   DEPLOY_PATHS_FILE=/etc/deploy-paths sudo -E bash scripts/configure-deploy-permissions.sh
#   INSTALL_RSYNC=false sudo -E bash scripts/configure-deploy-permissions.sh
#   INSTALL_PM2=true sudo -E bash scripts/configure-deploy-permissions.sh
#   INSTALL_PNPM=true PNPM_VERSION=10.14.0 sudo -E bash scripts/configure-deploy-permissions.sh

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_GROUP="${DEPLOY_GROUP:-$DEPLOY_USER}"
DEPLOY_SHELL="${DEPLOY_SHELL:-/bin/bash}"
DEPLOY_PATHS_FILE="${DEPLOY_PATHS_FILE:-}"
ENABLE_ACL="${ENABLE_ACL:-true}"
INSTALL_RSYNC="${INSTALL_RSYNC:-true}"
INSTALL_PM2="${INSTALL_PM2:-false}"
INSTALL_PNPM="${INSTALL_PNPM:-$INSTALL_PM2}"
PNPM_VERSION="${PNPM_VERSION:-10.14.0}"
PM2_VERSION="${PM2_VERSION:-latest}"
SYSTEM_NODE_ROOT="${SYSTEM_NODE_ROOT:-/opt/xshuliner-node}"

DEFAULT_DEPLOY_PATHS=(
  "/var/www/orz2.online/html"
  "/opt/projectApi/prod/smart-express"
  "/opt/projectApi/uat/smart-express"
)

log() {
  printf '[deploy-perms] %s\n' "$*"
}

die() {
  printf '[deploy-perms] ERROR: %s\n' "$*" >&2
  exit 1
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    die "run as root, for example: sudo bash $0"
  fi
}

ensure_rsync() {
  if command -v rsync >/dev/null 2>&1; then
    log "rsync exists: $(command -v rsync)"
    return
  fi

  if [ "$INSTALL_RSYNC" != "true" ]; then
    die "rsync is required by release-deploy.yml server deploys. Install rsync on this server or rerun with INSTALL_RSYNC=true."
  fi

  log "Installing rsync."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y rsync
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y rsync
  elif command -v yum >/dev/null 2>&1; then
    yum install -y rsync
  elif command -v zypper >/dev/null 2>&1; then
    zypper --non-interactive install rsync
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache rsync
  elif command -v pacman >/dev/null 2>&1; then
    pacman -Sy --noconfirm rsync
  else
    die "rsync is required, but no supported package manager was found. Install rsync manually and rerun this script."
  fi

  command -v rsync >/dev/null 2>&1 || die "rsync installation finished but rsync is still not available in PATH"
  log "rsync installed: $(command -v rsync)"
}

resolve_path() {
  local value="$1"
  if command -v realpath >/dev/null 2>&1; then
    realpath "$value"
  else
    readlink -f "$value"
  fi
}

deploy_user_can_run() {
  local command="$1"
  run_as_deploy_user "cd /tmp && $command" >/dev/null 2>&1
}

link_node_bin() {
  local node_home="$1"
  local tool="$2"

  [ -x "$node_home/bin/$tool" ] || return 0
  ln -sf "$node_home/bin/$tool" "/usr/local/bin/$tool"
}

ensure_deploy_user_home_dirs() {
  local home_dir
  home_dir="$(getent passwd "$DEPLOY_USER" | awk -F: '{print $6}')"
  [ -n "$home_dir" ] || return 0

  mkdir -p "$home_dir/.pm2" "$home_dir/.local/share/pnpm" "$home_dir/.cache"
  chown -R "$DEPLOY_USER:$DEPLOY_GROUP" "$home_dir/.pm2" "$home_dir/.local" "$home_dir/.cache"
}

ensure_system_node_runtime() {
  if deploy_user_can_run "command -v node && command -v npm && node -v && npm -v"; then
    log "node/npm are already available to deploy user '$DEPLOY_USER'"
    return
  fi

  command -v node >/dev/null 2>&1 || die "node is required to prepare deploy tooling. Install Node.js first."
  command -v npm >/dev/null 2>&1 || die "npm is required to prepare deploy tooling. Install npm first."

  local node_exec node_home node_version node_dst
  node_exec="$(resolve_path "$(command -v node)")"
  node_home="$(dirname "$(dirname "$node_exec")")"
  node_version="$(node -p 'process.version')"

  if [ -x "$node_home/bin/node" ] && [ -x "$node_home/bin/npm" ]; then
    node_dst="$SYSTEM_NODE_ROOT/$node_version"
    if [ "$node_home" != "$node_dst" ]; then
      log "Copying Node runtime from $node_home to $node_dst."
      mkdir -p "$(dirname "$node_dst")"
      rsync -a --delete "$node_home"/ "$node_dst"/
      chown -R root:root "$node_dst"
      chmod -R a+rX "$SYSTEM_NODE_ROOT"
    fi

    link_node_bin "$node_dst" node
    link_node_bin "$node_dst" npm
    link_node_bin "$node_dst" npx
    link_node_bin "$node_dst" corepack
  else
    log "Using existing system Node runtime from $node_exec."
    ln -sf "$node_exec" /usr/local/bin/node
    ln -sf "$(resolve_path "$(command -v npm)")" /usr/local/bin/npm
    if command -v npx >/dev/null 2>&1; then
      ln -sf "$(resolve_path "$(command -v npx)")" /usr/local/bin/npx
    fi
    if command -v corepack >/dev/null 2>&1; then
      ln -sf "$(resolve_path "$(command -v corepack)")" /usr/local/bin/corepack
    fi
  fi

  hash -r

  if ! deploy_user_can_run "command -v node && command -v npm && node -v && npm -v"; then
    die "node/npm are still not available to deploy user '$DEPLOY_USER' after exposing them through /usr/local/bin"
  fi
  log "node/npm are available to deploy user '$DEPLOY_USER'"
}

install_npm_global() {
  local package_name="$1"
  PATH="/usr/local/bin:/usr/bin:/bin:$PATH" npm install -g "$package_name"
  hash -r
}

refresh_node_tool_links() {
  local node_exec node_home
  if [ -x /usr/local/bin/node ]; then
    node_exec="$(resolve_path /usr/local/bin/node)"
  else
    node_exec="$(resolve_path "$(command -v node)")"
  fi
  node_home="$(dirname "$(dirname "$node_exec")")"

  link_node_bin "$node_home" pnpm
  link_node_bin "$node_home" pm2
  link_node_bin "$node_home" pm2-runtime
  link_node_bin "$node_home" pm2-dev
}

ensure_pnpm() {
  if [ "$INSTALL_PNPM" != "true" ]; then
    return
  fi

  ensure_system_node_runtime

  if deploy_user_can_run "command -v pnpm && pnpm -v"; then
    log "pnpm is already available to deploy user '$DEPLOY_USER'"
    return
  fi

  log "Installing pnpm@$PNPM_VERSION."
  install_npm_global "pnpm@$PNPM_VERSION"
  refresh_node_tool_links

  deploy_user_can_run "command -v pnpm && pnpm -v" || die "pnpm is not available to deploy user '$DEPLOY_USER' after installation"
  log "pnpm is available to deploy user '$DEPLOY_USER'"
}

ensure_pm2() {
  if [ "$INSTALL_PM2" != "true" ]; then
    return
  fi

  ensure_system_node_runtime

  if deploy_user_can_run "command -v pm2 && pm2 -v"; then
    log "pm2 is already available to deploy user '$DEPLOY_USER'"
    return
  fi

  log "Installing pm2@$PM2_VERSION."
  install_npm_global "pm2@$PM2_VERSION"
  refresh_node_tool_links
  ensure_deploy_user_home_dirs

  deploy_user_can_run "command -v pm2 && pm2 -v" || die "pm2 is not available to deploy user '$DEPLOY_USER' after installation"
  log "pm2 is available to deploy user '$DEPLOY_USER'"
}

trim_line() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

load_paths() {
  DEPLOY_TARGET_PATHS=()

  if [ "$#" -gt 0 ]; then
    DEPLOY_TARGET_PATHS=("$@")
    return
  fi

  if [ -n "$DEPLOY_PATHS_FILE" ]; then
    [ -f "$DEPLOY_PATHS_FILE" ] || die "DEPLOY_PATHS_FILE does not exist: $DEPLOY_PATHS_FILE"
    local line path
    while IFS= read -r line || [ -n "$line" ]; do
      path="$(trim_line "$line")"
      case "$path" in
        ""|\#*) continue ;;
      esac
      DEPLOY_TARGET_PATHS+=("$path")
    done < "$DEPLOY_PATHS_FILE"
    return
  fi

  if [ -n "${DEPLOY_PATHS:-}" ]; then
    local line path
    while IFS= read -r line || [ -n "$line" ]; do
      path="$(trim_line "$line")"
      [ -n "$path" ] || continue
      DEPLOY_TARGET_PATHS+=("$path")
    done <<< "$DEPLOY_PATHS"
    return
  fi

  DEPLOY_TARGET_PATHS=("${DEFAULT_DEPLOY_PATHS[@]}")
}

normalize_path() {
  local path="$1"
  path="$(trim_line "$path")"
  path="${path%/}"

  [ -n "$path" ] || die "empty deploy path is not allowed"
  [[ "$path" = /* ]] || die "deploy path must be absolute: $path"

  case "$path" in
    /|/bin|/boot|/dev|/etc|/home|/lib|/lib64|/opt|/proc|/root|/run|/sbin|/sys|/tmp|/usr|/var|/var/www)
      die "refusing to manage broad system path: $path"
      ;;
  esac

  printf '%s' "$path"
}

ensure_group() {
  if getent group "$DEPLOY_GROUP" >/dev/null; then
    log "Group exists: $DEPLOY_GROUP"
  else
    log "Creating group: $DEPLOY_GROUP"
    groupadd "$DEPLOY_GROUP"
  fi
}

ensure_user() {
  if id -u "$DEPLOY_USER" >/dev/null 2>&1; then
    log "User exists: $DEPLOY_USER"
    usermod -a -G "$DEPLOY_GROUP" "$DEPLOY_USER"
  else
    log "Creating user: $DEPLOY_USER"
    useradd --create-home --shell "$DEPLOY_SHELL" --gid "$DEPLOY_GROUP" "$DEPLOY_USER"
  fi

  local current_shell
  current_shell="$(getent passwd "$DEPLOY_USER" | awk -F: '{print $7}')"
  case "$current_shell" in
    ""|*/nologin|*/false)
      log "Setting login shell for $DEPLOY_USER: $DEPLOY_SHELL"
      usermod --shell "$DEPLOY_SHELL" "$DEPLOY_USER"
      ;;
  esac

  local home_dir
  home_dir="$(getent passwd "$DEPLOY_USER" | awk -F: '{print $6}')"
  if [ -n "$home_dir" ]; then
    mkdir -p "$home_dir/.ssh"
    chown "$DEPLOY_USER:$DEPLOY_GROUP" "$home_dir" "$home_dir/.ssh"
    chmod 700 "$home_dir/.ssh"
    if [ -f "$home_dir/.ssh/authorized_keys" ]; then
      chown "$DEPLOY_USER:$DEPLOY_GROUP" "$home_dir/.ssh/authorized_keys"
      chmod 600 "$home_dir/.ssh/authorized_keys"
    fi
  fi
}

run_as_deploy_user() {
  local command="$1"
  if command -v runuser >/dev/null 2>&1; then
    runuser -u "$DEPLOY_USER" -- sh -c "$command"
  else
    su -s /bin/sh "$DEPLOY_USER" -c "$command"
  fi
}

verify_deploy_user_tool() {
  local tool="$1"
  if run_as_deploy_user "cd /tmp && command -v '$tool' >/dev/null 2>&1"; then
    log "$tool is available to deploy user '$DEPLOY_USER'"
    return
  fi

  die "$tool is not available to deploy user '$DEPLOY_USER' in a non-interactive shell"
}

configure_path() {
  local raw_path="$1"
  local path
  path="$(normalize_path "$raw_path")"

  if [ -L "$path" ]; then
    die "refusing to manage symlink path: $path"
  fi

  log "Configuring path: $path"
  mkdir -p "$path"

  chown -R "$DEPLOY_USER:$DEPLOY_GROUP" "$path"

  find "$path" -type d -exec chmod u+rwx,go+rx,go-w {} +
  find "$path" -type f -exec chmod u+rw,go+r,go-w {} +

  if [ "$ENABLE_ACL" = "true" ] && command -v setfacl >/dev/null 2>&1; then
    setfacl -R -m "u:${DEPLOY_USER}:rwX" "$path"
    setfacl -R -m "g:${DEPLOY_GROUP}:rX" "$path"
    find "$path" -type d -exec setfacl -m "d:u:${DEPLOY_USER}:rwX" -m "d:g:${DEPLOY_GROUP}:rX" {} +
  fi

  if command -v restorecon >/dev/null 2>&1; then
    restorecon -R "$path" >/dev/null 2>&1 || true
  fi

  if command -v runuser >/dev/null 2>&1; then
    # shellcheck disable=SC2016
    runuser -u "$DEPLOY_USER" -- sh -c 'test -w "$1" && touch "$1/.deploy-permission-test" && rm "$1/.deploy-permission-test"' sh "$path"
  else
    su -s /bin/sh "$DEPLOY_USER" -c "test -w '$path' && touch '$path/.deploy-permission-test' && rm '$path/.deploy-permission-test'"
  fi
}

main() {
  require_root
  load_paths "$@"

  [ "${#DEPLOY_TARGET_PATHS[@]}" -gt 0 ] || die "no deploy paths configured"

  ensure_rsync
  ensure_group
  ensure_user
  ensure_deploy_user_home_dirs
  ensure_pnpm
  ensure_pm2
  verify_deploy_user_tool rsync
  if [ "$INSTALL_PNPM" = "true" ]; then
    verify_deploy_user_tool pnpm
  fi
  if [ "$INSTALL_PM2" = "true" ]; then
    verify_deploy_user_tool pm2
  fi

  local path
  for path in "${DEPLOY_TARGET_PATHS[@]}"; do
    configure_path "$path"
  done

  log "Done. User '$DEPLOY_USER' can deploy to ${#DEPLOY_TARGET_PATHS[@]} path(s)."
}

main "$@"
