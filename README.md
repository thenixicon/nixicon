# Nixicon Platform

AI-powered no-code platform that lets African creators design and preview digital tools instantly. When ready, Nixicon's in-house dev team builds and deploys complete production apps for Play Store, App Store, or web hosting.

## Features

### For Creators
- **AI Builder**: Describe your idea and watch it come alive — no coding, just clarity
- **Project Management**: Track your projects from idea to deployment
- **Real-time Chat**: Communicate with assigned developers
- **Payment Integration**: Secure payments with Stripe
- **Mobile Responsive**: Works perfectly on all devices

### For Developers
- **Admin Dashboard**: Manage projects, assign developers, track progress
- **Project Assignment**: Get assigned to projects based on expertise
- **Status Updates**: Update project status and communicate with clients
- **Analytics**: Track performance and project metrics

### For Admins
- **Complete Control**: Manage users, projects, and developers
- **Analytics Dashboard**: View platform statistics and revenue
- **Developer Management**: Add and manage development team
- **Project Oversight**: Monitor all projects and assignments

## Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose
- **JWT** for authentication
- **Socket.io** for real-time communication
- **Stripe** for payments
- **Nodemailer** for email notifications

### Frontend
- **Vanilla JavaScript** (ES6+)
- **CSS3** with custom properties
- **Responsive Design** with mobile-first approach
- **Real-time Updates** with Socket.io client

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Stripe account (for payments)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nixicon
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017/nixicon
   JWT_SECRET=your-super-secret-jwt-key-here
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   - Main site: http://localhost:3000
   - Admin dashboard: http://localhost:3000/admin.html

## Project Structure

```
nixicon/
├── models/                 # MongoDB models
│   ├── User.js
│   └── Project.js
├── routes/                 # API routes
│   ├── auth.js
│   ├── projects.js
│   ├── admin.js
│   ├── payments.js
│   └── chat.js
├── middleware/             # Custom middleware
│   └── auth.js
├── public/                 # Static files
│   └── images/
├── uploads/                # File uploads
├── index.html              # Main website
├── admin.html              # Admin dashboard
├── styles.css              # Global styles
├── app.js                  # Frontend JavaScript
├── server.js               # Express server
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/change-password` - Change password

### Projects
- `GET /api/projects` - Get user's projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get single project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/ai-generate` - Generate features with AI
- `POST /api/projects/:id/communication` - Add project communication

### Admin
- `GET /api/admin/dashboard` - Get dashboard stats
- `GET /api/admin/projects` - Get all projects
- `PUT /api/admin/projects/:id/assign` - Assign developer
- `PUT /api/admin/projects/:id/status` - Update project status
- `GET /api/admin/developers` - Get all developers
- `POST /api/admin/developers` - Create developer
- `GET /api/admin/analytics` - Get analytics data

### Payments
- `POST /api/payments/create-payment-intent` - Create Stripe payment
- `POST /api/payments/confirm-payment` - Confirm payment
- `GET /api/payments/history` - Get payment history
- `POST /api/payments/create-subscription` - Create subscription

### Chat
- `GET /api/chat/projects/:id/messages` - Get project messages
- `POST /api/chat/projects/:id/messages` - Send message
- `PUT /api/chat/projects/:id/messages/:msgId/read` - Mark as read
- `GET /api/chat/conversations` - Get user conversations

## Database Schema

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (user/developer/admin),
  avatar: String,
  phone: String,
  country: String,
  isVerified: Boolean,
  stripeCustomerId: String,
  subscription: {
    plan: String,
    status: String,
    currentPeriodEnd: Date
  },
  preferences: {
    notifications: Object,
    theme: String
  }
}
```

### Project Model
```javascript
{
  title: String,
  description: String,
  owner: ObjectId (User),
  assignedDeveloper: ObjectId (User),
  status: String,
  priority: String,
  category: String,
  platform: [String],
  features: [Object],
  design: Object,
  technical: Object,
  timeline: Object,
  budget: Object,
  files: [Object],
  communication: [Object],
  deployment: Object,
  aiGenerated: Object
}
```

## Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start server.js --name nixicon
pm2 startup
pm2 save
```

### Using Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/nixicon
JWT_SECRET=your-production-jwt-secret
STRIPE_SECRET_KEY=sk_live_your_live_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_stripe_key
EMAIL_USER=your-production-email
EMAIL_PASS=your-production-email-password
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@nixicon.com or join our Discord community.

## Roadmap

- [ ] AI-powered prototype generation
- [ ] Advanced project templates
- [ ] Mobile app for iOS/Android
- [ ] White-label solution for agencies
- [ ] Advanced analytics and reporting
- [ ] Integration with popular design tools
- [ ] Automated testing and deployment
- [ ] Multi-language support

---

**Built with ❤️ in Africa for African creators**
