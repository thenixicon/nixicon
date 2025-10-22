# Vercel Deployment Guide for Nixicon Platform

## Overview
This guide will help you deploy your Nixicon platform to Vercel using serverless functions. The platform has been optimized for Vercel's serverless architecture.

## Prerequisites
- Vercel account
- MongoDB Atlas account (for production database)
- Stripe account (for payments)
- GitHub repository with your code

## Step 1: Environment Variables Setup

### Required Environment Variables
Set these in your Vercel dashboard under Project Settings > Environment Variables:

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/nixicon

# JWT Secret (generate a strong secret)
JWT_SECRET=your-super-secret-jwt-key-here

# Stripe (get from Stripe dashboard)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Email (for notifications)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Server Configuration
NODE_ENV=production
DOMAIN=yourdomain.com
FRONTEND_URL=https://yourdomain.com

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

### How to Get Environment Variables:

1. **MongoDB Atlas:**
   - Go to [MongoDB Atlas](https://cloud.mongodb.com)
   - Create a cluster
   - Get connection string from "Connect" > "Connect your application"

2. **Stripe:**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com)
   - Get API keys from "Developers" > "API keys"
   - Create webhook endpoint for `/api/payments/webhook`

3. **JWT Secret:**
   - Generate a strong secret: `openssl rand -base64 32`

## Step 2: Deploy to Vercel

### Option A: Deploy from GitHub (Recommended)

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Add Vercel serverless support"
   git push origin main
   ```

2. **Connect to Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect the configuration

3. **Configure Environment Variables:**
   - In Vercel dashboard, go to your project
   - Go to Settings > Environment Variables
   - Add all the environment variables listed above

### Option B: Deploy with Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Set Environment Variables:**
   ```bash
   vercel env add MONGODB_URI
   vercel env add JWT_SECRET
   # ... add all other variables
   ```

## Step 3: Configure Custom Domain (Optional)

1. **Add Domain in Vercel:**
   - Go to your project settings
   - Go to "Domains"
   - Add your custom domain

2. **Update DNS:**
   - Add CNAME record pointing to `cname.vercel-dns.com`
   - Or add A record pointing to Vercel's IP

3. **Update Environment Variables:**
   - Update `DOMAIN` and `FRONTEND_URL` with your custom domain

## Step 4: Test Your Deployment

### Health Check
Visit: `https://your-app.vercel.app/api/health`

Expected response:
```json
{
  "success": true,
  "message": "API is healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Test API Endpoints
```bash
# Test registration
curl -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Test login
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## Step 5: Configure Stripe Webhooks

1. **Create Webhook Endpoint:**
   - Go to Stripe Dashboard > Webhooks
   - Add endpoint: `https://your-app.vercel.app/api/payments/webhook`
   - Select events: `payment_intent.succeeded`, `invoice.payment_succeeded`, `customer.subscription.updated`

2. **Get Webhook Secret:**
   - Copy the webhook signing secret
   - Add it to your Vercel environment variables as `STRIPE_WEBHOOK_SECRET`

## Step 6: Monitor and Debug

### Vercel Dashboard
- Monitor function invocations
- Check logs for errors
- Monitor performance metrics

### Debugging
- Check function logs in Vercel dashboard
- Use `vercel logs` command
- Test locally with `vercel dev`

## Common Issues and Solutions

### 1. FUNCTION_INVOCATION_FAILED
**Cause:** Usually database connection issues or missing environment variables
**Solution:** 
- Check MongoDB connection string
- Verify all environment variables are set
- Check function logs for specific errors

### 2. Database Connection Timeouts
**Cause:** Cold starts and connection pooling issues
**Solution:**
- The code now includes connection caching
- MongoDB Atlas has connection limits
- Consider upgrading MongoDB Atlas plan

### 3. CORS Issues
**Cause:** Frontend and backend on different domains
**Solution:**
- Update CORS configuration in `server.js`
- Add your frontend domain to allowed origins

### 4. File Upload Issues
**Cause:** Vercel has limitations on file uploads
**Solution:**
- Use external storage (AWS S3, Cloudinary)
- Implement file upload via API routes
- Consider using Vercel's file upload limits

## Performance Optimization

### 1. Database Optimization
- Use MongoDB indexes (already configured in models)
- Implement connection pooling
- Use MongoDB Atlas M10+ for production

### 2. Function Optimization
- Keep functions lightweight
- Use connection caching
- Implement proper error handling

### 3. Caching
- Consider implementing Redis for session storage
- Use Vercel's edge caching for static content
- Implement API response caching

## Security Considerations

### 1. Environment Variables
- Never commit `.env` files
- Use Vercel's environment variable system
- Rotate secrets regularly

### 2. API Security
- Rate limiting is already implemented
- CORS is properly configured
- Helmet security headers are enabled

### 3. Database Security
- Use MongoDB Atlas with IP whitelisting
- Enable authentication
- Use connection string with credentials

## Monitoring and Maintenance

### 1. Health Monitoring
- Set up uptime monitoring
- Monitor API response times
- Track error rates

### 2. Database Monitoring
- Monitor MongoDB Atlas metrics
- Set up alerts for connection issues
- Regular backup verification

### 3. Performance Monitoring
- Use Vercel Analytics
- Monitor function execution times
- Track memory usage

## Troubleshooting Commands

```bash
# Check Vercel status
vercel status

# View logs
vercel logs

# Test locally
vercel dev

# Check environment variables
vercel env ls

# Redeploy
vercel --prod
```

## Support

If you encounter issues:
1. Check Vercel function logs
2. Verify environment variables
3. Test database connectivity
4. Check Stripe webhook configuration
5. Review CORS settings

Your Nixicon platform should now be successfully deployed on Vercel! 🚀
