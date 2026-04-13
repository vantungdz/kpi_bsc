import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private gmail: any;

  constructor(private configService: ConfigService) {
    this.initializeGmail();
  }

  private async initializeGmail() {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GOOGLE_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      this.logger.warn(
        'Google OAuth2 credentials not configured. Email functionality will be disabled.',
      );
      return;
    }

    try {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });

      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      this.logger.log('Gmail API initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Gmail API:', error);
    }
  }

  async sendPasswordResetEmail(
    email: string,
    resetLink: string,
  ): Promise<boolean> {
    if (!this.gmail) {
      this.logger.error(
        'Gmail API not initialized. Please check Google OAuth2 configuration.',
      );
      return false;
    }

    try {
      const message = this.createEmailMessage(email, resetLink);

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message,
        },
      });

      this.logger.log(
        `Password reset email sent successfully to ${email}. Message ID: ${response.data.id}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}:`,
        error,
      );
      return false;
    }
  }

  private createEmailMessage(email: string, resetLink: string): string {
    const subject = 'Password Reset Request - KPI System';
    const htmlContent = this.generatePasswordResetEmailTemplate(resetLink);

    const message = [
      `To: ${email}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      htmlContent,
    ].join('\n');

    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private generatePasswordResetEmailTemplate(resetLink: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
          }
          .content {
            margin-bottom: 30px;
          }
          .reset-button {
            display: inline-block;
            background-color: #3498db;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
            transition: background-color 0.3s;
          }
          .reset-button:hover {
            background-color: #2980b9;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #666;
            font-size: 14px;
          }
          .link {
            word-break: break-all;
            color: #3498db;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">KPI System</div>
            <h1>Password Reset Request</h1>
          </div>
          
          <div class="content">
            <p>Hello,</p>
            <p>You have requested to reset your password for your KPI System account.</p>
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="reset-button">Reset Password</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong>
              <ul>
                <li>This link will expire in 1 hour</li>
                <li>This link can only be used once</li>
                <li>If you didn't request this reset, please ignore this email</li>
              </ul>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p class="link">${resetLink}</p>
          </div>
          
          <div class="footer">
            <p>This email was sent from KPI System</p>
            <p>If you have any questions, please contact your system administrator</p>
            <p>© ${new Date().getFullYear()} KPI System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
