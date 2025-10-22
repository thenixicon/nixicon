# Database Setup Guide

## MongoDB Atlas Setup (Recommended)

### Step 1: Create MongoDB Atlas Account
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Click "Try Free"
3. Sign up with email or Google account

### Step 2: Create a Cluster
1. Choose **FREE** tier (M0 Sandbox)
2. Select **AWS** as provider
3. Choose region closest to you
4. Click "Create Cluster"

### Step 3: Create Database User
1. Go to "Database Access" in left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Create username and password (save these!)
5. Set privileges to "Read and write to any database"
6. Click "Add User"

### Step 4: Whitelist IP Address
1. Go to "Network Access" in left sidebar
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (0.0.0.0/0)
4. Click "Confirm"

### Step 5: Get Connection String
1. Go to "Clusters" in left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your database user password
6. Replace `<dbname>` with `nixicon`

### Step 6: Update Environment Variables
Add to your `.env` file:
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/nixicon?retryWrites=true&w=majority
```

## Alternative: Railway (All-in-One)

### Step 1: Connect GitHub
1. Go to [Railway](https://railway.app)
2. Sign up with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your nixicon repository

### Step 2: Add Database
1. In Railway dashboard, click "New"
2. Select "Database" → "MongoDB"
3. Railway will automatically create MongoDB instance
4. Copy the connection string from environment variables

### Step 3: Deploy
1. Railway will automatically deploy your app
2. Add environment variables in Railway dashboard
3. Your app will be live at a Railway URL

## Alternative: Render (All-in-One)

### Step 1: Connect GitHub
1. Go to [Render](https://render.com)
2. Sign up with GitHub
3. Click "New" → "Web Service"
4. Connect your GitHub repository

### Step 2: Add Database
1. Click "New" → "Database" → "MongoDB"
2. Choose free tier
3. Copy connection string

### Step 3: Configure App
1. Add environment variables
2. Set build command: `npm install`
3. Set start command: `node server.js`
4. Deploy

## Testing Your Database Connection

### Test Locally
```bash
# Start your app
npm run dev

# Check console for:
# ✅ Connected to MongoDB
```

### Test in Production
1. Deploy your app
2. Try registering a user
3. Check if user appears in MongoDB Atlas dashboard

## Environment Variables for Production

### For Vercel/Netlify + MongoDB Atlas
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/nixicon?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-here
STRIPE_SECRET_KEY=sk_live_your_live_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_stripe_key
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
DOMAIN=yourdomain.com
NODE_ENV=production
```

### For Railway/Render
- Add these in their respective dashboards
- They'll automatically inject them into your app

## Troubleshooting

### Connection Issues
- Check if IP is whitelisted in MongoDB Atlas
- Verify username/password are correct
- Ensure connection string is properly formatted

### Authentication Issues
- Make sure database user has proper permissions
- Check if password contains special characters (URL encode them)

### Production Issues
- Verify environment variables are set correctly
- Check MongoDB Atlas cluster is running
- Monitor connection limits (free tier has limits)

## Free Tier Limits

### MongoDB Atlas (M0)
- 512MB storage
- Shared RAM
- No backup retention
- Perfect for development/small apps

### Railway
- $5 credit monthly
- Enough for small apps
- Automatic scaling

### Render
- Free tier available
- Sleeps after inactivity
- Good for development

## Recommended Architecture

```
GitHub Repository
    ↓
Vercel/Netlify (Frontend)
    ↓
MongoDB Atlas (Database)
    ↓
Your Custom Domain
```

This setup gives you:
- ✅ Free hosting
- ✅ Free database
- ✅ Automatic deployments
- ✅ Custom domain support
- ✅ SSL certificates
- ✅ Global CDN
