# DBeaver Database Connections

## Development Environment

### Connection Details
- **Host**: `localhost` (or your dev machine IP)
- **Port**: `5434`
- **Database**: `agreements_db`
- **Username**: `agreements_user`
- **Password**: `agreements_password`
- **SSL Mode**: `Disable`

### Connection Steps
1. Open DBeaver
2. Click "New Database Connection" (+)
3. Select "PostgreSQL"
4. Fill in connection details:
   ```
   Server Host: localhost
   Port: 5434
   Database: agreements_db
   Username: agreements_user
   Password: agreements_password
   ```
5. Test Connection
6. Click "Finish"

---

## Production Environment (On-Prem Server)

### Connection Details
- **Host**: `192.168.0.100` (or your on-prem server IP)
- **Port**: `5434`
- **Database**: `agreements_db`
- **Username**: `agreements_user`
- **Password**: `[FROM_ENV_FILE]` (set in env.production)
- **SSL Mode**: `Disable` (internal network)

### SSH Tunnel Connection (Recommended for Security)
If connecting from outside the on-prem network:

1. **SSH Tunnel Settings**:
   ```
   SSH Host: sign.kredit.my (or your server domain)
   SSH Port: 22
   SSH User: admin-kapital
   SSH Private Key: [your SSH key]
   ```

2. **Database Settings** (via tunnel):
   ```
   Server Host: localhost
   Port: 5434
   Database: agreements_db
   Username: agreements_user
   Password: [FROM_ENV_FILE]
   ```

### Direct Connection (On-Prem Network Only)
If you're on the same network as the server:
```
Server Host: 192.168.0.100
Port: 5434
Database: agreements_db
Username: agreements_user
Password: [FROM_ENV_FILE]
```

---

## Connection Commands

### Check if Database is Running
```bash
# Development
docker ps | grep agreements-postgres-dev

# Production
docker ps | grep agreements-postgres-prod
```

### Connect via psql (Terminal)
```bash
# Development
psql -h localhost -p 5434 -U agreements_user -d agreements_db

# Production (on server)
psql -h localhost -p 5434 -U agreements_user -d agreements_db
```

### View Database Logs
```bash
# Development
docker logs agreements-postgres-dev

# Production
docker logs agreements-postgres-prod
```

---

## Important Notes

1. **Port 5434**: Used to avoid conflicts with main VPS database (usually 5432)
2. **Localhost Only**: Production DB only accepts connections from localhost (127.0.0.1)
3. **Environment Variables**: Production password is stored in `env.production` file
4. **Network Access**: Development DB is accessible from any IP, production is restricted
5. **SSL**: Currently disabled for simplicity on internal networks

---

## Troubleshooting

### Connection Refused
- Check if containers are running: `docker ps`
- Check port mapping: `docker port agreements-postgres-[dev|prod]`
- Verify firewall settings on production server

### Authentication Failed
- Verify username/password in environment files
- Check if environment variables are loaded correctly
- View container logs for authentication errors

### Database Not Found
- Confirm database name is `agreements_db`
- Check if database was created during container startup
- Run database migrations if needed
