#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
TEMPLATE_FILE="${SCRIPT_DIR}/cloud-init.yaml"
DRY_RUN="false"

usage() {
  cat <<USAGE
Usage:
  $(basename "$0") [--env-file <path>] [--dry-run]

Required env vars:
  HCLOUD_SERVER_NAME
  HCLOUD_SSH_KEY_NAME
  TAILSCALE_AUTH_KEY
  ADMIN_CONSOLE_PASSWORD
USAGE
}

log() {
  printf '[create-vps] %s\n' "$*"
}

die() {
  printf '[create-vps] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

escape_sed_replacement() {
  # Escape characters that are special for both sed replacement and shell expansion.
  printf '%s' "$1" | sed -e 's/[$&|\\]/\\&/g'
}

render_cloud_init() {
  local out_file="$1"
  local admin_username_esc
  local tailscale_auth_key_esc
  local tailscale_hostname_esc
  local admin_console_password_hash
  local admin_console_password_hash_esc
  local admin_ssh_public_key_esc

  admin_username_esc="$(escape_sed_replacement "${ADMIN_USERNAME}")"
  tailscale_auth_key_esc="$(escape_sed_replacement "${TAILSCALE_AUTH_KEY}")"
  tailscale_hostname_esc="$(escape_sed_replacement "${TAILSCALE_HOSTNAME}")"
  admin_console_password_hash="$(printf '%s' "${ADMIN_CONSOLE_PASSWORD}" | openssl passwd -6 -stdin)"
  admin_console_password_hash_esc="$(escape_sed_replacement "${admin_console_password_hash}")"
  admin_ssh_public_key_esc="$(escape_sed_replacement "${ADMIN_SSH_PUBLIC_KEY}")"

  sed \
    -e "s|__ADMIN_USERNAME__|${admin_username_esc}|g" \
    -e "s|__TAILSCALE_AUTH_KEY__|${tailscale_auth_key_esc}|g" \
    -e "s|__TAILSCALE_HOSTNAME__|${tailscale_hostname_esc}|g" \
    -e "s|__ADMIN_CONSOLE_PASSWORD_HASH__|${admin_console_password_hash_esc}|g" \
    -e "s|__ADMIN_SSH_PUBLIC_KEY__|${admin_ssh_public_key_esc}|g" \
    "${TEMPLATE_FILE}" >"${out_file}"

  log "Rendered cloud-init to ${out_file}"
}

firewall_has_port_rule() {
  local port="$1"

  hcloud firewall describe "${HCLOUD_FIREWALL_NAME}" -o json | jq -e \
    --arg port "${port}" \
    '.rules[]? | select(.direction == "in" and .protocol == "tcp" and (.port // "") == $port)' \
    >/dev/null
}

ensure_firewall() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    log "Would ensure firewall ${HCLOUD_FIREWALL_NAME} with inbound 80/tcp and 443/tcp"
    log "Public SSH (22/tcp) stays closed; SSH is Tailscale-only"
    return
  fi

  if hcloud firewall describe "${HCLOUD_FIREWALL_NAME}" >/dev/null 2>&1; then
    log "Using existing firewall: ${HCLOUD_FIREWALL_NAME}"
  else
    hcloud firewall create \
      --name "${HCLOUD_FIREWALL_NAME}" \
      --label "app=${HCLOUD_LABEL_APP}" \
      --label "env=${HCLOUD_LABEL_ENV}" \
      --label "managed-by=liskobot-script" >/dev/null
    log "Created firewall: ${HCLOUD_FIREWALL_NAME}"
  fi

  if ! firewall_has_port_rule 80; then
    hcloud firewall add-rule "${HCLOUD_FIREWALL_NAME}" \
      --direction in \
      --protocol tcp \
      --port 80 \
      --source-ips 0.0.0.0/0 \
      --source-ips ::/0 >/dev/null
    log "Added firewall rule: 80/tcp"
  fi

  if ! firewall_has_port_rule 443; then
    hcloud firewall add-rule "${HCLOUD_FIREWALL_NAME}" \
      --direction in \
      --protocol tcp \
      --port 443 \
      --source-ips 0.0.0.0/0 \
      --source-ips ::/0 >/dev/null
    log "Added firewall rule: 443/tcp"
  fi

  if firewall_has_port_rule 22; then
    die "Firewall ${HCLOUD_FIREWALL_NAME} allows 22/tcp. Remove that rule to keep SSH Tailscale-only."
  fi
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --env-file)
      [[ -n "${2:-}" ]] || die "--env-file needs a value"
      ENV_FILE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

[[ -f "${ENV_FILE}" ]] || die "Env file not found: ${ENV_FILE}"
[[ -f "${TEMPLATE_FILE}" ]] || die "Template not found: ${TEMPLATE_FILE}"

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

HCLOUD_SERVER_NAME="${HCLOUD_SERVER_NAME:-}"
HCLOUD_SSH_KEY_NAME="${HCLOUD_SSH_KEY_NAME:-}"
TAILSCALE_AUTH_KEY="${TAILSCALE_AUTH_KEY:-}"
ADMIN_CONSOLE_PASSWORD="${ADMIN_CONSOLE_PASSWORD:-}"

[[ -n "${HCLOUD_SERVER_NAME}" ]] || die "HCLOUD_SERVER_NAME is required"
[[ -n "${HCLOUD_SSH_KEY_NAME}" ]] || die "HCLOUD_SSH_KEY_NAME is required"
[[ -n "${TAILSCALE_AUTH_KEY}" ]] || die "TAILSCALE_AUTH_KEY is required"
[[ -n "${ADMIN_CONSOLE_PASSWORD}" ]] || die "ADMIN_CONSOLE_PASSWORD is required"

HCLOUD_SERVER_TYPE="${HCLOUD_SERVER_TYPE:-cax21}"
HCLOUD_LOCATION="${HCLOUD_LOCATION:-fsn1}"
HCLOUD_IMAGE="${HCLOUD_IMAGE:-ubuntu-24.04}"
HCLOUD_FIREWALL_NAME="${HCLOUD_FIREWALL_NAME:-liskobot-fw}"
HCLOUD_ENABLE_BACKUP="${HCLOUD_ENABLE_BACKUP:-true}"
HCLOUD_LABEL_APP="${HCLOUD_LABEL_APP:-liskobot}"
HCLOUD_LABEL_ENV="${HCLOUD_LABEL_ENV:-production}"
ADMIN_USERNAME="${ADMIN_USERNAME:-deploy}"
TAILSCALE_HOSTNAME="${TAILSCALE_HOSTNAME:-${HCLOUD_SERVER_NAME}}"

require_command hcloud
require_command jq
require_command sed
require_command mktemp
require_command openssl

rendered_cloud_init="$(mktemp)"
trap 'rm -f "${rendered_cloud_init}"' EXIT

ensure_firewall

create_cmd=(
  hcloud server create
  --name "${HCLOUD_SERVER_NAME}"
  --type "${HCLOUD_SERVER_TYPE}"
  --location "${HCLOUD_LOCATION}"
  --image "${HCLOUD_IMAGE}"
  --ssh-key "${HCLOUD_SSH_KEY_NAME}"
  --firewall "${HCLOUD_FIREWALL_NAME}"
  --user-data-from-file "${rendered_cloud_init}"
  --enable-protection delete
  --enable-protection rebuild
  --label "app=${HCLOUD_LABEL_APP}"
  --label "env=${HCLOUD_LABEL_ENV}"
  --label "managed-by=liskobot-script"
)

if [[ "${HCLOUD_ENABLE_BACKUP}" == "true" ]]; then
  create_cmd+=(--enable-backup)
fi

if ! hcloud ssh-key describe "${HCLOUD_SSH_KEY_NAME}" >/dev/null 2>&1; then
  die "SSH key not found in Hetzner: ${HCLOUD_SSH_KEY_NAME}"
fi

ADMIN_SSH_PUBLIC_KEY="$(hcloud ssh-key describe "${HCLOUD_SSH_KEY_NAME}" -o json | jq -r '.public_key // empty')"
[[ -n "${ADMIN_SSH_PUBLIC_KEY}" ]] || die "Could not read public key for ${HCLOUD_SSH_KEY_NAME}"

render_cloud_init "${rendered_cloud_init}"

if [[ "${DRY_RUN}" == "true" ]]; then
  log "Dry run mode enabled"
  log "Create command: $(printf '%q ' "${create_cmd[@]}")"
  exit 0
fi

if hcloud server describe "${HCLOUD_SERVER_NAME}" >/dev/null 2>&1; then
  die "Server already exists: ${HCLOUD_SERVER_NAME}"
fi

result_json="$("${create_cmd[@]}" -o json)"
server_ipv4="$(printf '%s' "${result_json}" | jq -r '.server.public_net.ipv4.ip // empty')"

[[ -n "${server_ipv4}" ]] || die "Failed to parse server IPv4 from create output"

log "Server created: ${HCLOUD_SERVER_NAME} (${server_ipv4})"
cat <<NEXT
[create-vps] Next steps:
[create-vps] 1. In Hetzner Console, run: cloud-init status --wait
[create-vps] 2. Web console login is enabled for ${ADMIN_USERNAME} using your configured password
[create-vps] 3. Connect over Tailscale: ssh ${ADMIN_USERNAME}@${TAILSCALE_HOSTNAME}
[create-vps] 4. Tunnel Dokploy: ssh -L 3000:localhost:3000 ${ADMIN_USERNAME}@${TAILSCALE_HOSTNAME}
[create-vps] 5. Verify: scripts/deploy/hetzner/check-security.sh ${TAILSCALE_HOSTNAME} ${ADMIN_USERNAME} ${HCLOUD_SERVER_NAME}
NEXT
