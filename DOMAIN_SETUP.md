# Domain Setup Guide - nixicon.online

## Overview
You can't "transfer" a domain to GitHub, but you can easily connect your `www.nixicon.online` domain to your platform hosted on Vercel (which connects to GitHub).

## Option 1: Vercel + Namecheap (Recommended)

### Step 1: Deploy to Vercel
1. Go to [Vercel](https://vercel.com)
2. Sign up with GitHub account
3. Click "New Project"
4. Import your nixicon repository
5. Deploy (takes 2-3 minutes)

### Step 2: Add Domain to Vercel
1. In Vercel dashboard, go to your project
2. Click "Settings" → "Domains"
3. Add both:
   - `nixicon.online`
   - `www.nixicon.online`
4. Vercel will show DNS records to add

### Step 3: Update DNS in Namecheap
1. Login to Namecheap
2. Go to "Domain List" → "Manage" for nixicon.online
3. Go to "Advanced DNS"
4. Delete existing A records
5. Add these records:

```
Type: A Record
Host: @
Value: 76.76.19.61
TTL: Automatic

Type: CNAME
Host: www
Value: cname.vercel-dns.com
TTL: Automatic
```

### Step 4: Wait for Propagation
- DNS changes take 5-60 minutes
- Check with: `nslookup nixicon.online`

## Option 2: Netlify + Namecheap

### Step 1: Deploy to Netlify
1. Go to [Netlify](https://netlify.com)
2. Connect GitHub repository
3. Deploy automatically

### Step 2: Add Domain
1. Go to "Domain Settings"
2. Add `nixicon.online` and `www.nixicon.online`
3. Get DNS records from Netlify

### Step 3: Update Namecheap DNS
```
Type: A Record
Host: @
Value: 75.2.60.5
TTL: Automatic

Type: CNAME
Host: www
Value: nixicon-online.netlify.app
TTL: Automatic
```

## Option 3: Railway + Namecheap

### Step 1: Deploy to Railway
1. Go to [Railway](https://railway.app)
2. Connect GitHub repository
3. Deploy with MongoDB

### Step 2: Add Domain
1. Go to "Settings" → "Domains"
2. Add your domain
3. Get DNS records

### Step 3: Update Namecheap DNS
Use the DNS records Railway provides

## Environment Variables for Production

Add these to your hosting platform:

```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/nixicon
JWT_SECRET=your-super-secret-jwt-key-here
STRIPE_SECRET_KEY=sk_live_your_live_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_stripe_key
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
DOMAIN=nixicon.online
FRONTEND_URL=https://nixicon.online
NODE_ENV=production
```

## DNS Configuration Details

### A Record (Root Domain)
- **Type**: A
- **Host**: @
- **Value**: [Hosting provider IP]
- **TTL**: 300 (5 minutes)

### CNAME Record (WWW)
- **Type**: CNAME
- **Host**: www
- **Value**: [Hosting provider CNAME]
- **TTL**: 300 (5 minutes)

### Optional: Redirect WWW to Root
- **Type**: URL Redirect
- **Host**: www
- **Value**: https://nixicon.online
- **TTL**: 300

## Testing Your Setup

### 1. Check DNS Propagation
```bash
# Check if DNS is working
nslookup nixicon.online
nslookup www.nixicon.online

# Check from different locations
# Use: https://dnschecker.org
```

### 2. Test Your Site
- Visit `https://nixicon.online`
- Visit `https://www.nixicon.online`
- Both should show your Nixicon platform

### 3. Test SSL Certificate
- Check for green lock icon
- Verify certificate is valid
- Test HTTPS redirect

## Troubleshooting

### DNS Not Working
- Wait 24-48 hours for full propagation
- Check DNS records are correct
- Clear browser cache
- Try different DNS servers

### SSL Issues
- Wait for automatic SSL certificate
- Check domain is properly configured
- Verify DNS is pointing correctly

### Site Not Loading
- Check if hosting platform is running
- Verify environment variables
- Check application logs

## Recommended Architecture

```
GitHub Repository
    ↓
Vercel/Netlify (Hosting)
    ↓
MongoDB Atlas (Database)
    ↓
nixicon.online (Your Domain)
```

## Cost Breakdown

| Service | Cost | What You Get |
|---------|------|--------------|
| Domain (Namecheap) | $10-15/year | Your domain name |
| Vercel | FREE | Hosting + SSL + CDN |
| MongoDB Atlas | FREE | Database (512MB) |
| **Total** | **$10-15/year** | **Complete platform** |

## Next Steps After Setup

1. **Test everything works**
2. **Set up MongoDB Atlas** (see DATABASE_SETUP.md)
3. **Configure environment variables**
4. **Test user registration**
5. **Test project creation**
6. **Set up admin dashboard**

## Support

If you need help:
- Check hosting platform documentation
- Verify DNS settings in Namecheap
- Test with different browsers
- Check hosting platform logs

Your Nixicon platform will be live at `https://nixicon.online`! 🚀
