# SSH Access Setup Guide for Kredit Infrastructure

## Overview
This guide explains how to grant SSH access to new users for Kredit's cloud and on-premise servers via Tailscale network.

## Server Details
### VPS (Cloud Server)
- **Tailscale IP**: `100.85.61.82`
- **SSH User**: `root`
- **Purpose**: Main cloud backend, admin panel, customer frontend

### On-Premise Server
- **Tailscale IP**: `100.76.8.62`
- **SSH User**: `admin-kapital`
- **Purpose**: DocuSeal, Signing Orchestrator, MTSA services

**Network**: Both servers accessible via Tailscale private network only

---

## For System Administrator (You)

### Option 1: Using the Automated Script (Recommended)

1. Run the setup script:
   ```bash
   cd /Users/ivan/Documents/creditxpress
   bash scripts/setup-ssh-access.sh
   ```

2. Select which server(s) to grant access to:
   - Option 1: VPS only
   - Option 2: On-Prem only
   - Option 3: Both servers

3. Follow the prompts to paste the user's public key

4. Send the generated instructions to the new user

### Option 2: Manual Setup

1. **Get the user's public key**
   - Ask the new user to send their SSH public key (content of `~/.ssh/id_ed25519.pub` or `~/.ssh/id_rsa.pub`)

2. **For VPS Access:**
   ```bash
   # SSH into the VPS
   ssh root@100.85.61.82
   
   # Backup existing authorized_keys
   cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.backup.$(date +%Y%m%d_%H%M%S)
   
   # Add the new user's public key
   echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
   
   # Ensure correct permissions
   chmod 600 ~/.ssh/authorized_keys
   chmod 700 ~/.ssh
   
   # Verify
   tail -5 ~/.ssh/authorized_keys
   ```

3. **For On-Prem Access:**
   ```bash
   # SSH into the On-Prem server
   ssh admin-kapital@100.76.8.62
   
   # Backup existing authorized_keys
   cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.backup.$(date +%Y%m%d_%H%M%S)
   
   # Add the new user's public key
   echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
   
   # Ensure correct permissions
   chmod 600 ~/.ssh/authorized_keys
   chmod 700 ~/.ssh
   
   # Verify
   tail -5 ~/.ssh/authorized_keys
   ```

### Managing Access

#### Revoking Access (Recommended Method)

Use the automated revocation script:
```bash
cd /Users/ivan/Documents/creditxpress
bash scripts/revoke-ssh-access.sh
```

**Revocation options:**
1. **List and revoke by line number** - Shows all keys with line numbers
2. **Revoke by email/comment** - Search for keys by user's email
3. **Revoke by partial key match** - Match part of the key string
4. **View only** - Just view current keys without revoking
5. **Restore from backup** - Undo previous revocations

**Features:**
- Automatic backups before any changes
- Works across both VPS and On-Prem servers
- Interactive and safe
- Can revoke from one or both servers

#### Audit SSH Access

Generate comprehensive security audit:
```bash
cd /Users/ivan/Documents/creditxpress
bash scripts/audit-ssh-access.sh
```

**Audit includes:**
- All authorized keys with fingerprints
- Recent login activity
- Failed login attempts
- Current SSH sessions
- SSH configuration status
- Backup history
- Security recommendations

The audit generates a timestamped report file you can review and archive.

#### Manual Key Management

**View all authorized keys (VPS):**
```bash
ssh root@100.85.61.82 'cat ~/.ssh/authorized_keys'
```

**View all authorized keys (On-Prem):**
```bash
ssh admin-kapital@100.76.8.62 'cat ~/.ssh/authorized_keys'
```

**Remove a specific key manually:**
```bash
# On VPS
ssh root@100.85.61.82
nano ~/.ssh/authorized_keys  # Delete the specific line

# On On-Prem
ssh admin-kapital@100.76.8.62
nano ~/.ssh/authorized_keys  # Delete the specific line
```

**List authorized keys with line numbers:**
```bash
# VPS
ssh root@100.85.61.82 'grep -n "" ~/.ssh/authorized_keys'

# On-Prem
ssh admin-kapital@100.76.8.62 'grep -n "" ~/.ssh/authorized_keys'
```

---

## For New Users

### Prerequisites
1. **Tailscale Access**: You must be connected to the Kredit Tailscale network
2. **SSH Key Pair**: You need an SSH key pair (public and private key)

### Step 1: Generate SSH Key Pair (if you don't have one)

**Recommended (ED25519):**
```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
```

**Alternative (RSA):**
```bash
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
```

When prompted:
- Press Enter to save in default location (`~/.ssh/id_ed25519` or `~/.ssh/id_rsa`)
- Enter a passphrase (recommended) or press Enter for no passphrase

### Step 2: Send Your Public Key to Administrator

**View your public key:**
```bash
cat ~/.ssh/id_ed25519.pub
# or
cat ~/.ssh/id_rsa.pub
```

**Copy and send the entire output** to the system administrator. It should look like:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... your-email@example.com
```

⚠️ **IMPORTANT**: Never share your private key (the file without `.pub`)!

### Step 3: Connect to Server(s)

Once the administrator has added your public key:

1. **Ensure Tailscale is running:**
   ```bash
   tailscale status
   ```

2. **Connect to the appropriate server:**
   
   **VPS (Cloud Server):**
   ```bash
   ssh root@100.85.61.82
   ```
   
   **On-Premise Server:**
   ```bash
   ssh admin-kapital@100.76.8.62
   ```

3. **First-time connection**: You'll see a message about host authenticity. Type `yes` to continue.

### Step 4: Optional - Create SSH Config Aliases

For easier access, add this to your `~/.ssh/config`:

```bash
# Create or edit the config file
nano ~/.ssh/config
```

Add the following (customize based on which servers you have access to):
```
# Kredit VPS (Cloud Server)
Host kredit-vps
    HostName 100.85.61.82
    User root
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3

# Kredit On-Premise Server
Host kredit-onprem
    HostName 100.76.8.62
    User admin-kapital
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Then you can connect simply with:
```bash
ssh kredit-vps        # Connect to cloud VPS
ssh kredit-onprem     # Connect to on-premise server
```

---

## Troubleshooting

### "Permission denied (publickey)" Error

**Check 1: Tailscale Connection**
```bash
tailscale status
# Ensure you see the VPS (100.85.61.82) in the list
```

**Check 2: SSH Key Permissions**
```bash
chmod 600 ~/.ssh/id_ed25519
chmod 700 ~/.ssh
```

**Check 3: Verify Correct Key**
```bash
# Test which key is being used
ssh -v root@100.85.61.82
# Look for "Offering public key" lines
```

**Check 4: Specify Key Explicitly**
```bash
# For VPS
ssh -i ~/.ssh/id_ed25519 root@100.85.61.82

# For On-Prem
ssh -i ~/.ssh/id_ed25519 admin-kapital@100.76.8.62
```

### "Connection refused" or "Connection timeout"

**Verify Tailscale:**
```bash
# Check if Tailscale is running
tailscale status

# Ping the servers
ping 100.85.61.82      # VPS
ping 100.76.8.62       # On-Prem
```

### Multiple SSH Keys

If you have multiple SSH keys, specify which one to use:
```bash
# VPS
ssh -i ~/.ssh/id_ed25519 root@100.85.61.82

# On-Prem
ssh -i ~/.ssh/id_ed25519 admin-kapital@100.76.8.62
```

Or add `IdentityFile` to your SSH config as shown above.

### Different Users for Different Servers

Note that VPS uses `root` user while On-Prem uses `admin-kapital`. Make sure you use the correct username for each server.

---

## Security Best Practices

### For Administrators:
1. **Regular Audits**: Run `audit-ssh-access.sh` monthly to review all keys and activity
2. **Key Comments**: Encourage users to include identifying info (email) in their key comments
3. **Backup**: Always backup `authorized_keys` before modifications (scripts do this automatically)
4. **Monitoring**: Monitor SSH login attempts in `/var/log/auth.log`
5. **Access Reviews**: Quarterly review of who needs access to which servers
6. **Prompt Revocation**: Use `revoke-ssh-access.sh` immediately when someone leaves or changes roles
7. **Documentation**: Keep a record of when keys were added/removed and why

### For Users:
1. **Protect Private Key**: Never share your private key file
2. **Use Passphrase**: Protect your private key with a strong passphrase
3. **Unique Keys**: Use different keys for different systems (optional but recommended)
4. **Key Rotation**: Rotate your keys annually
5. **Report Compromise**: Immediately notify admin if your private key may be compromised
6. **Secure Storage**: Keep private keys only on trusted devices

### Recommended Maintenance Schedule

**Monthly:**
- Run `audit-ssh-access.sh` and review the report
- Check for any unusual login activity

**Quarterly:**
- Review all authorized keys with team
- Remove keys for anyone who no longer needs access
- Verify key comments are up to date

**Annually:**
- Request all users to rotate their SSH keys
- Full security review of SSH configuration
- Archive old audit reports

---

## Additional Commands

### View SSH Login History
```bash
# VPS
ssh root@100.85.61.82 'last -20'

# On-Prem
ssh admin-kapital@100.76.8.62 'last -20'
```

### Check SSH Configuration
```bash
# VPS
ssh root@100.85.61.82 'cat /etc/ssh/sshd_config | grep -E "PubkeyAuthentication|PasswordAuthentication"'

# On-Prem
ssh admin-kapital@100.76.8.62 'cat /etc/ssh/sshd_config | grep -E "PubkeyAuthentication|PasswordAuthentication"'
```

### Test SSH Connection (Verbose)
```bash
# VPS
ssh -vvv root@100.85.61.82

# On-Prem
ssh -vvv admin-kapital@100.76.8.62
```

---

## Support

If you continue to have issues:
1. Verify with administrator that your public key was added correctly to the intended server(s)
2. Check Tailscale network connectivity: 
   - `tailscale ping 100.85.61.82` (VPS)
   - `tailscale ping 100.76.8.62` (On-Prem)
3. Provide verbose SSH output to administrator:
   - VPS: `ssh -vvv root@100.85.61.82 2>&1 | tee ssh-debug-vps.log`
   - On-Prem: `ssh -vvv admin-kapital@100.76.8.62 2>&1 | tee ssh-debug-onprem.log`

## Server Access Matrix

| Server | IP | User | Purpose | Common Tasks |
|--------|-------|------|---------|--------------|
| VPS | 100.85.61.82 | root | Cloud backend, APIs, databases | Backend deployments, database migrations, log review |
| On-Prem | 100.76.8.62 | admin-kapital | DocuSeal, Signing Orchestrator, MTSA | Document signing, certificate management, MTSA operations |

