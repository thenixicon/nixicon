# Deployment Guide

## GitHub Setup

1. **Create a new repository on GitHub**
   - Repository name: `nixicon-platform`
   - Description: "AI-powered no-code platform for African creators"
   - Make it public or private as needed

2. **Initialize git and push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Complete Nixicon platform"
   git branch -M main
   git remote add origin https://github.com/yourusername/nixicon-platform.git
   git push -u origin main
   ```

## Domain Setup

### 1. DNS Configuration
Point your domain to your server:
- **A Record**: `@` → Your server IP
- **A Record**: `www` → Your server IP
- **CNAME**: `api` → `yourdomain.com` (optional for API subdomain)

### 2. SSL Certificate
```bash
# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Server Setup (Ubuntu 20.04+)

### 1. Update system and install dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx nodejs npm git pm2 mongodb
```

### 2. Clone repository
```bash
cd /var/www
sudo git clone https://github.com/yourusername/nixicon-platform.git
sudo chown -R $USER:$USER nixicon-platform
cd nixicon-platform
```

### 3. Install dependencies
```bash
npm install --production
```

### 4. Environment setup
```bash
cp env.example .env
nano .env
```

Update `.env` with your production values:
```env
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/nixicon
JWT_SECRET=your-super-secure-jwt-secret-here
STRIPE_SECRET_KEY=sk_live_your_live_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_stripe_key
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
DOMAIN=yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### 5. Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/nixicon
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/nixicon /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Start the application
```bash
pm2 start server.js --name nixicon
pm2 startup
pm2 save
```

### 7. Setup MongoDB
```bash
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

## Docker Deployment (Alternative)

If you prefer Docker:

1. **Install Docker and Docker Compose**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

2. **Deploy with Docker Compose**
```bash
docker-compose up -d
```

## Monitoring and Maintenance

### 1. Monitor application
```bash
pm2 status
pm2 logs nixicon
pm2 monit
```

### 2. Backup MongoDB
```bash
# Create backup script
sudo nano /usr/local/bin/backup-mongodb.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --db nixicon --out /var/backups/mongodb/nixicon_$DATE
find /var/backups/mongodb -name "nixicon_*" -mtime +7 -delete
```

```bash
sudo chmod +x /usr/local/bin/backup-mongodb.sh
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-mongodb.sh
```

### 3. Update application
```bash
cd /var/www/nixicon
git pull origin main
npm ci --production
pm2 restart nixicon
```

## Security Checklist

- [ ] SSL certificate installed and auto-renewing
- [ ] Firewall configured (UFW)
- [ ] MongoDB secured with authentication
- [ ] Environment variables secured
- [ ] Regular backups scheduled
- [ ] Monitoring setup
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers enabled

## Performance Optimization

1. **Enable Gzip compression** (already in nginx.conf)
2. **Setup CDN** for static assets
3. **Database indexing** for better performance
4. **Redis caching** for session management
5. **Load balancing** for high traffic

## Troubleshooting

### Common Issues

1. **Application won't start**
   ```bash
   pm2 logs nixicon
   node server.js  # Run directly to see errors
   ```

2. **Database connection issues**
   ```bash
   sudo systemctl status mongodb
   mongosh --eval "db.adminCommand('ping')"
   ```

3. **Nginx issues**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   sudo tail -f /var/log/nginx/error.log
   ```

4. **SSL issues**
   ```bash
   sudo certbot certificates
   sudo certbot renew --dry-run
   ```

## Support

For deployment issues:
- Check logs: `pm2 logs nixicon`
- Monitor resources: `htop` or `pm2 monit`
- Test API: `curl https://yourdomain.com/api/auth/me`

Your Nixicon platform should now be live at `https://yourdomain.com`! 🚀
