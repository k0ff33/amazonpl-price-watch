# Deployment Design — Hetzner VPS + Dokploy (Same VPS)

**Date:** 2026-02-20
**Status:** Approved (Option 1: hcloud + cloud-init)

## Objective

Create secure, repeatable deployment scripts that provision one Hetzner VPS and bootstrap Dokploy on first boot.

## Constraints

- Budget target: `<$50/month`
- Single VPS for both Dokploy control plane and workloads (for now)
- Existing local repository and Docker-based services remain unchanged
- Existing uncommitted local changes in other worktrees must remain untouched

## Architecture

One provisioning entrypoint (`create-vps.sh`) orchestrates:

1. input/env validation
2. Hetzner firewall creation/reconciliation
3. cloud-init rendering
4. server creation with SSH key injection and protection
5. output of access and hardening verification steps

The server boots with cloud-init that applies a security baseline and installs Dokploy via the official install script.

## Files

- `scripts/deploy/hetzner/create-vps.sh`: idempotent provisioner
- `scripts/deploy/hetzner/check-security.sh`: post-provision validation
- `scripts/deploy/hetzner/cloud-init.yaml.tmpl`: cloud-init template
- `scripts/deploy/hetzner/.env.example`: required configuration template
- `docs/deployment/hetzner-dokploy.md`: operational runbook

## Security Baseline

Provision-time controls:

- Hetzner Cloud Firewall allows inbound only:
  - `22/tcp` from `SSH_ALLOWED_CIDRS`
  - `80/tcp` and `443/tcp` from internet
  - optional `3000/tcp` (Dokploy panel) only when explicitly enabled
- Server protection flags enabled (`delete`, `rebuild`)
- Only SSH key auth (`--ssh-key`), no password-based provisioning path

Host hardening via cloud-init:

- create non-root admin user with sudo
- disable root SSH login
- disable password and challenge-response SSH authentication
- install and configure `ufw`, `fail2ban`, `unattended-upgrades`
- install Docker + Dokploy
- keep Dokploy panel closed by default (access via SSH tunnel unless explicitly opened)

## Reliability & Operability

- Script supports re-runs without duplicating firewall rules
- Script emits clear outputs (server ID, IPv4, ssh command, tunnel command)
- `check-security.sh` validates critical controls after bootstrap:
  - sshd hardening flags
  - firewall attachment
  - fail2ban active
  - unattended upgrades enabled
  - Dokploy container health

## Non-Goals (Current Phase)

- Kubernetes/k3s/KEDA setup
- multi-VPS distribution
- full Terraform/Ansible IaC conversion
- automatic app deployment into Dokploy after panel setup

## Rollout Sequence

1. Fill `scripts/deploy/hetzner/.env` from template
2. Run `create-vps.sh`
3. Wait for cloud-init completion
4. Access Dokploy through SSH tunnel and finish onboarding
5. Run `check-security.sh` and resolve any failed checks

## Future Path

When scaling needs increase:

1. move Dokploy control plane to separate VPS
2. attach additional worker VPS nodes
3. optionally migrate to k3s+KEDA if queue-based autoscaling becomes mandatory
