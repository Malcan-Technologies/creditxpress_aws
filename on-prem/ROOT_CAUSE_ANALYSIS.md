# Root Cause Analysis - Tailscale Connectivity Issues

## Critical Findings from Logs

### 1. **Tailscale Interface Going DOWN**
```
Nov 04 03:00:45 opg-srv systemd-networkd[1111]: tailscale0: Link DOWN
Nov 04 03:05:09 opg-srv systemd-networkd[1111]: tailscale0: Link DOWN
```

**Impact**: When the `tailscale0` interface goes DOWN, all Tailscale traffic stops. This is the **root cause** of connectivity failures.

### 2. **Connection Reset Pattern**
Both VPS and on-prem show repeated "connection reset by peer" errors:
- VPS: `timeout opening (TCP 100.85.61.82:xxx => 100.76.8.62:4010)`
- On-prem: `read tcp4 192.168.0.100:xxx->172.237.72.8:443: read: connection reset by peer`

**Pattern**: Connections work briefly, then fail when interface goes DOWN.

### 3. **DNS Resolution Timeouts**
```
read udp 127.0.0.1:45062->127.0.0.53:53: i/o timeout
```

**Impact**: Even local DNS queries are timing out, suggesting network stack issues.

### 4. **Intermittent TCP Connectivity**
Test results: Port 4010 works 1 out of 5 times
- First attempt: ✅ OK
- Subsequent attempts: ❌ FAILED

**Pattern**: Works immediately after Tailscale restart, then fails.

## Root Cause Hypothesis

### Primary Issue: **Network Interface Instability**

The `tailscale0` interface is going DOWN intermittently, causing:
1. All Tailscale traffic to stop
2. TCP connections to timeout
3. Monitoring script to detect failure and restart Tailscale
4. Cycle repeats

### Possible Causes:

#### 1. **Network Driver/Kernel Issues**
- Bond interface (`bond0`) may have driver issues
- Kernel networking stack problems
- Interface bonding misconfiguration

#### 2. **Router/Network Equipment**
- TP-Link Omada router may be dropping connections
- Network switch issues
- Cable/connectivity problems

#### 3. **systemd-networkd Issues**
- Network manager may be interfering with Tailscale
- Interface management conflicts
- Network state machine issues

#### 4. **Resource Exhaustion**
- Network buffer exhaustion
- Connection limit reached
- Memory/CPU issues affecting networking

## Evidence Supporting Each Theory

### Network Driver Issues:
- `ethtool` errors on bond0
- Interface statistics showing errors/drops

### Router Issues:
- UPnP working but UDP still blocked intermittently
- Connection resets from router side
- TP-Link Omada router may have aggressive connection tracking

### systemd-networkd Issues:
- `tailscale0: Link DOWN` messages from systemd-networkd
- Network manager may be managing Tailscale interface incorrectly

## Next Steps to Diagnose

1. **Check network interface statistics**:
   ```bash
   ethtool -S bond0
   ip -s link show tailscale0
   ```

2. **Check for network manager conflicts**:
   ```bash
   systemctl status systemd-networkd
   systemctl status NetworkManager
   ```

3. **Monitor interface state changes**:
   ```bash
   journalctl -u systemd-networkd -f
   ```

4. **Check router connection tracking**:
   - TP-Link Omada may have aggressive connection limits
   - Check router logs for connection resets

5. **Test direct network connectivity**:
   ```bash
   ping -c 100 8.8.8.8  # Test internet connectivity
   ping -c 100 192.168.0.1  # Test router connectivity
   ```

## Immediate Actions

1. **Disable systemd-networkd management of Tailscale**:
   ```bash
   # Create networkd config to ignore tailscale0
   sudo mkdir -p /etc/systemd/network
   sudo tee /etc/systemd/network/tailscale0.network > /dev/null <<EOF
   [Match]
   Name=tailscale0
   
   [Network]
   DHCP=no
   LinkLocalAddressing=no
   EOF
   ```

2. **Check router connection tracking settings**:
   - Log into TP-Link Omada router
   - Check connection tracking/stateful firewall settings
   - Look for connection limits or timeouts

3. **Monitor interface state**:
   ```bash
   watch -n 1 'ip link show tailscale0'
   ```

## Questions to Answer

1. **Why is tailscale0 interface going DOWN?**
   - Is it systemd-networkd?
   - Is it a kernel issue?
   - Is it a driver problem?

2. **What triggers the interface to go DOWN?**
   - Network errors?
   - Resource exhaustion?
   - Router resetting connections?

3. **Is the router the root cause?**
   - TP-Link Omada connection tracking
   - Firewall rules
   - NAT timeout settings

