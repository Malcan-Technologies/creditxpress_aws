# SSH Access Quick Reference Card

## Server Information

| Server | IP Address | SSH User | Purpose |
|--------|------------|----------|---------|
| **VPS** | `100.85.61.82` | `root` | Cloud backend, APIs, databases |
| **On-Prem** | `100.76.8.62` | `admin-kapital` | DocuSeal, Signing Orchestrator, MTSA |

## Connection Commands

```bash
# VPS (Cloud Server)
ssh root@100.85.61.82

# On-Premise Server
ssh admin-kapital@100.76.8.62
```

## For Administrators: Grant Access

### Quick Setup (Recommended)
```bash
cd /Users/ivan/Documents/creditxpress
bash scripts/setup-ssh-access.sh
```

### Manual Setup
```bash
# Get user's public key first, then:

# VPS
ssh root@100.85.61.82
echo "USER_PUBLIC_KEY" >> ~/.ssh/authorized_keys

# On-Prem
ssh admin-kapital@100.76.8.62
echo "USER_PUBLIC_KEY" >> ~/.ssh/authorized_keys
```

## For New Users: Get Your Public Key

```bash
# Generate key (if you don't have one)
ssh-keygen -t ed25519 -C "your-email@example.com"

# Display your PUBLIC key to send to admin
cat ~/.ssh/id_ed25519.pub
```

## SSH Config Shortcuts

Add to `~/.ssh/config`:

```
Host kredit-vps
    HostName 100.85.61.82
    User root
    IdentityFile ~/.ssh/id_ed25519

Host kredit-onprem
    HostName 100.76.8.62
    User admin-kapital
    IdentityFile ~/.ssh/id_ed25519
```

Then connect with:
```bash
ssh kredit-vps
ssh kredit-onprem
```

## Troubleshooting

### Check Tailscale
```bash
tailscale status
ping 100.85.61.82    # VPS
ping 100.76.8.62     # On-Prem
```

### Test with Verbose Output
```bash
ssh -vvv root@100.85.61.82           # VPS
ssh -vvv admin-kapital@100.76.8.62   # On-Prem
```

### Fix Key Permissions
```bash
chmod 600 ~/.ssh/id_ed25519
chmod 700 ~/.ssh
```

## Management Commands

### Revoke SSH Access
```bash
cd /Users/ivan/Documents/creditxpress
bash scripts/revoke-ssh-access.sh
```
Interactive menu to:
- Remove keys by line number
- Search and remove by email
- View current keys
- Restore from backup

### Audit SSH Access
```bash
cd /Users/ivan/Documents/creditxpress
bash scripts/audit-ssh-access.sh
```
Generates comprehensive report with:
- All keys and fingerprints
- Login history
- Failed attempts
- Security recommendations

### View Authorized Keys
```bash
ssh root@100.85.61.82 'cat ~/.ssh/authorized_keys'
ssh admin-kapital@100.76.8.62 'cat ~/.ssh/authorized_keys'
```

### View Login History
```bash
ssh root@100.85.61.82 'last -20'
ssh admin-kapital@100.76.8.62 'last -20'
```

### Manual Backup
```bash
ssh root@100.85.61.82 'cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.backup'
ssh admin-kapital@100.76.8.62 'cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.backup'
```
*Note: Scripts automatically backup before changes*

---

**⚠️ Security Reminder**: Only share PUBLIC keys (`.pub` files). Never share private keys!

**📖 Full Documentation**: See `SSH_ACCESS_SETUP_GUIDE.md` for complete setup and troubleshooting guide.

