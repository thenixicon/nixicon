const nodemailer = require('nodemailer');
require('dotenv').config();

// Create reusable transporter
let transporter = null;

// Initialize email transporter if credentials are provided
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// Email templates
const EmailService = {
  // Send verification email
  async sendVerificationEmail(user, token) {
    if (!transporter) {
      console.warn('Email not configured - verification email not sent');
      return null;
    }
    
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    
    const mailOptions = {
      from: `"Nixicon" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Verify Your Nixicon Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7A1D36, #3B0E1C); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #7A1D36; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to Nixicon!</h1>
            </div>
            <div class="content">
              <h2>Hi ${user.name}!</h2>
              <p>Thank you for joining Nixicon. We're excited to help you build amazing apps!</p>
              <p>To complete your registration and start creating projects, please verify your email address by clicking the button below:</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${verificationUrl}" style="color: #7A1D36; word-break: break-all;">${verificationUrl}</a>
              </p>
              <p style="margin-top: 30px;">This verification link will expire in 24 hours.</p>
            </div>
            <div class="footer">
              <p>If you didn't create this account, please ignore this email.</p>
              <p>&copy; 2025 Nixicon Technologies. Built with ❤️ in Africa.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Verification email sent:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  },

  // Send welcome email
  async sendWelcomeEmail(user) {
    if (!transporter) {
      console.warn('Email not configured - welcome email not sent');
      return null;
    }
    
    const mailOptions = {
      from: `"Nixicon" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Welcome to Nixicon! Let\'s Build Something Amazing',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7A1D36, #3B0E1C); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #7A1D36; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 Your Account is Verified!</h1>
            </div>
            <div class="content">
              <h2>Hi ${user.name}!</h2>
              <p>Great news! Your email has been verified and your Nixicon account is now active.</p>
              <h3>What you can do now:</h3>
              <ul>
                <li>✨ Create your first project</li>
                <li>🤖 Use our AI builder to generate features</li>
                <li>📊 Track your projects from idea to deployment</li>
                <li>💬 Communicate with your assigned developers</li>
              </ul>
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="button">Start Building Now</a>
              </div>
              <p style="margin-top: 30px; color: #666;">Need help? Check out our documentation or reach out to support.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Welcome email sent to:', user.email);
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }
  },

  // Send password reset email
  async sendPasswordResetEmail(user, token) {
    if (!transporter) {
      console.warn('Email not configured - password reset email not sent');
      return null;
    }
    
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: `"Nixicon" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Reset Your Nixicon Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7A1D36, #3B0E1C); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #7A1D36; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hi ${user.name}!</h2>
              <p>We received a request to reset your password. Click the button below to reset it:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                If you didn't request this, please ignore this email. Your password will remain unchanged.
              </p>
              <p style="margin-top: 20px; color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Password reset email sent to:', user.email);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }
};

module.exports = EmailService;
