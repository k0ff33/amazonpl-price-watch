#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  $(basename "$0") <server-host-or-ip> [admin-user] [server-name]

Example:
  $(basename "$0") liskobot-prod deploy liskobot-prod
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

[[ "$#" -ge 1 ]] || {
  usage >&2
  exit 1
}

HOST="$1"
ADMIN_USER="${2:-deploy}"
SERVER_NAME="${3:-}"

SSH_OPTS=(
  -o BatchMode=yes
  -o ConnectTimeout=12
  -o StrictHostKeyChecking=accept-new
)

pass_count=0
fail_count=0

pass() {
  printf '[check-security] PASS: %s\n' "$1"
  pass_count=$((pass_count + 1))
}

fail() {
  printf '[check-security] FAIL: %s\n' "$1"
  fail_count=$((fail_count + 1))
}

run_remote() {
  local cmd="$1"
  ssh "${SSH_OPTS[@]}" "${ADMIN_USER}@${HOST}" "sudo bash -lc $(printf '%q' "${cmd}")"
}

assert_remote() {
  local name="$1"
  local cmd="$2"

  if run_remote "${cmd}" >/dev/null 2>&1; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

if ! ssh "${SSH_OPTS[@]}" "${ADMIN_USER}@${HOST}" true >/dev/null 2>&1; then
  printf '[check-security] ERROR: cannot connect to %s@%s\n' "${ADMIN_USER}" "${HOST}" >&2
  exit 1
fi

assert_remote "PermitRootLogin disabled" "grep -R '^PermitRootLogin no$' /etc/ssh/sshd_config /etc/ssh/sshd_config.d >/dev/null"
assert_remote "PasswordAuthentication disabled" "grep -R '^PasswordAuthentication no$' /etc/ssh/sshd_config /etc/ssh/sshd_config.d >/dev/null"
assert_remote "KbdInteractiveAuthentication disabled" "grep -R '^KbdInteractiveAuthentication no$' /etc/ssh/sshd_config /etc/ssh/sshd_config.d >/dev/null"
assert_remote "tailscaled active" "systemctl is-active tailscaled >/dev/null"
assert_remote "Tailscale has IPv4" "tailscale ip -4 | grep -qE '.'"
assert_remote "UFW active" "ufw status | grep -q 'Status: active'"
assert_remote "UFW allows SSH on tailscale0" "ufw status | grep -Eq '22/tcp.*ALLOW IN.*tailscale0'"
assert_remote "UFW does not allow OpenSSH globally" "! ufw status | grep -q 'OpenSSH'"
assert_remote "fail2ban active" "systemctl is-active fail2ban >/dev/null"
assert_remote "unattended-upgrades enabled" "grep -Eq 'Unattended-Upgrade \"1\"' /etc/apt/apt.conf.d/20auto-upgrades"
assert_remote "Dokploy container running" "docker ps --format '{{.Image}} {{.Names}}' | grep -qi dokploy"

if [[ -n "${SERVER_NAME}" ]] && command -v hcloud >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  if hcloud server describe "${SERVER_NAME}" -o json | jq -e '.public_net.firewalls | length > 0' >/dev/null; then
    pass "Hetzner firewall attached (${SERVER_NAME})"
  else
    fail "Hetzner firewall attached (${SERVER_NAME})"
  fi
fi

printf '[check-security] Summary: %d passed, %d failed\n' "${pass_count}" "${fail_count}"

[[ "${fail_count}" -eq 0 ]]
