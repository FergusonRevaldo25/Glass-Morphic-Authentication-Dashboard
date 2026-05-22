# 🚀 Glass Morphic Authentication Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Node.js Version](https://img.shields.io/badge/node.js-18.x-green.svg)](https://nodejs.org/) [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15.x-blue.svg)](https://www.postgresql.org/) [![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)

A modern, production-ready authentication dashboard with glass morphic design, behavioral CAPTCHA, complete user management, and real-time analytics.

![Dashboard Preview](https://via.placeholder.com/800x400?text=Glass+Morphic+Dashboard)

## ✨ Features

### 🔐 Authentication
- **Behavioral CAPTCHA** - No annoying puzzles! Verifies humans through natural interactions
- **Two-Factor Authentication (2FA)** - Demo implementation with 6-digit codes
- **JWT Sessions** - Secure token-based authentication
- **Password Hashing** - bcrypt for secure password storage
- **Session Persistence** - "Remember me" functionality

### 👥 User Management
- **Full CRUD Operations** - Create, Read, Update, Delete users
- **Search & Filter** - Find users by name, email, or status
- **Pagination** - 10 users per page with navigation
- **Status Management** - Activate/deactivate user accounts
- **Admin Roles** - Assign admin privileges

### 📊 Dashboard
- **Real-time Stats** - Total users, active sessions, daily signups
- **Activity Feed** - Track all user actions with timestamps
- **Leaderboard** - Weekly top active users
- **Notifications** - In-app notification system
- **Activity Chart** - Visual representation of 7-day activity

### 👤 Profile Management
- **Profile Picture Upload** - Image upload with automatic optimization (Sharp)
- **Bio & Location** - User profile customization
- **Password Change** - Secure password updates
- **Login Statistics** - Track login count and last activity

### 📈 Analytics & Export
- **User Growth Chart** - Visual user acquisition tracking
- **CSV Export** - Export user data for reporting
- **Top Users List** - Most active users leaderboard

### 🎨 UI/UX
- **Glass Morphic Design** - Modern frosted glass effect
- **Dark/Light Mode** - Theme switching with localStorage persistence
- **Responsive Layout** - Works perfectly on desktop, tablet, and mobile
- **Smooth Animations** - Hover effects, transitions, and micro-interactions

## 🛠️ Tech Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Glass morphic effects, animations, responsive design
- **JavaScript (ES6+)** - Vanilla JS, no frameworks
- **Chart.js** - Beautiful activity charts
- **Font Awesome 6** - Icons

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **PostgreSQL** - Primary database (also supports SQLite)
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **Multer** - File upload handling
- **Sharp** - Image optimization
- **UUID** - Unique identifiers

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v15 or higher) or SQLite
- npm or yarn package manager

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/glass-auth-dashboard.git
cd glass-auth-dashboard
```

### 2. Install dependencies

```bash
npm install
```

### 3. Database Setup

PostgreSQL (Recommended)

```sql
-- Create database
CREATE DATABASE auth_dashboard;

-- Tables will be created automatically on server start
```

SQLite (Alternative)

```bash
# No setup needed - SQLite database will be created automatically
npm install sqlite3
```

### 4. Environment Configuration

Create a .env file:

```env
# Database Configuration (PostgreSQL)
DB_USER=postgres
DB_HOST=localhost
DB_NAME=auth_dashboard
DB_PASSWORD=your_password
DB_PORT=5432

# JWT Secret
JWT_SECRET=your-super-secret-key-change-this

# Server Port
PORT=3000
```

### 5. Start the Application

Terminal 1 - Backend Server
```bash
npm start
# or
node server.js
```

Terminal 2 - Frontend Server
```bash
npx serve .
# or
python -m http.server 5500
```

### 6. Access the Application

Open your browser and navigate to: http://localhost:5500

📁 Project Structure

```
glass-auth-dashboard/
├── index.html          # Main HTML file
├── style.css           # All styling (glass morphic + responsive)
├── script.js           # Frontend logic + CAPTCHA + API calls
├── server.js           # Node.js backend with all endpoints
├── package.json        # Dependencies and scripts
├── .env               # Environment variables (not in repo)
├── .gitignore         # Git ignore rules
├── uploads/           # User profile pictures
└── README.md          # Documentation
```

🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/signup | User registration |
| POST | /api/login | User login |
| POST | /api/logout | User logout |
| GET | /api/dashboard-data | Dashboard statistics |
| GET | /api/profile | Get user profile |
| PUT | /api/update-profile | Update user profile |
| POST | /api/upload-avatar | Upload profile picture |
| GET | /api/admin/users | Get all users |
| POST | /api/admin/users | Add new user |
| PUT | /api/admin/users/:id | Update user |
| DELETE | /api/admin/users/:id | Delete user |
| GET | /api/export-users | Export users as CSV |
| GET | /api/activity-chart | Get chart data |
| GET | /api/leaderboard | Get top users |

🎯 Features in Action

Behavioral CAPTCHA
Tracks mouse movements, clicks, keystrokes, and time spent

No user interaction required - works silently in background

Score-based verification (0.6+ threshold)

Glass Morphic Design
backdrop-filter: blur() effects

Semi-transparent backgrounds

Floating animated shapes

Smooth hover transitions

Dark/Light Mode
Theme preference saved in localStorage

Smooth color transitions

Readable contrast in both modes

🔒 Security Features
Password hashing with bcrypt (10 rounds)

JWT tokens with expiration

Session management

SQL injection prevention (parameterized queries)

XSS protection (HTML escaping)

File upload validation (type & size limits)

Image optimization to prevent malicious files

🧪 Testing
Test Accounts
| Email | Password | Role |
|---|---|---|
| admin@example.com | Admin123! | Admin |
| user@example.com | User123! | Regular User |

2FA Demo
Use demo@example.com with any password to trigger 2FA demo. Enter code: 123456

🚢 Deployment
Deploy to Render (Backend)
Push code to GitHub

Create new Web Service on Render

Connect your repository

Set environment variables

Deploy!

Deploy to Vercel/Netlify (Frontend)
Upload index.html, style.css, script.js

Configure redirects for SPA

Deploy!

Database (Supabase - Free PostgreSQL)
Create Supabase account

Create new project

Get connection string

Update .env with Supabase credentials

🤝 Contributing
Contributions are welcome! Please follow these steps:

Fork the repository

Create a feature branch (git checkout -b feature/AmazingFeature)

Commit changes (git commit -m 'Add AmazingFeature')

Push to branch (git push origin feature/AmazingFeature)

Open a Pull Request

📝 License
This project is licensed under the MIT License - see the LICENSE file for details.

🙏 Acknowledgments
Font Awesome for icons

Chart.js for charts

Google Fonts for Montserrat font

Pexels for background images

📧 Contact
Your Name - @yourtwitter - email@example.com

Project Link: https://github.com/yourusername/glass-auth-dashboard

⭐ Show Your Support
Give a ⭐️ if this project helped you!

Built with ❤️ using Node.js, Express, PostgreSQL, and Glass Morphic CSS

text

## 🚀 **Git Commands to Push**

```bash
# Initialize git repository (if not already)
git init

# Add all files
git add .
git add -f uploads/.gitkeep  # Include the empty folder structure

# Commit with message
git commit -m "Initial commit: Glass Morphic Authentication Dashboard

- Complete authentication system with JWT
- Glass morphic UI with dark/light mode
- Behavioral CAPTCHA for bot protection
- User management CRUD operations
- Profile management with image upload
- Real-time dashboard with analytics
- Activity tracking and notifications
- Export users as CSV
- Responsive design"

# Add remote repository (replace with your GitHub URL)
git remote add origin https://github.com/YOUR_USERNAME/glass-auth-dashboard.git

# Push to GitHub
git branch -M main
git push -u origin main
```

📝 Create a LICENSE file (MIT License)

```text
MIT License

Copyright (c) 2024 [Your Name]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

🌟 Your GitHub Repository Will Show:
⭐ Professional README with badges

📁 Clean project structure

🔧 Complete working code

📝 MIT License

🚀 Deployment instructions

📊 Feature showcase

🎨 Beautiful glass morphic demo

🎉 After Pushing to GitHub:
Share your repository: Send the link to recruiters!

Enable GitHub Pages: Settings → Pages → Deploy from main

Add to portfolio: Include in your resume and LinkedIn

Star your own repo: It encourages others!

Your dashboard is ready for the world! 🌍 🚀

This response is AI-generated and for reference purposes only.
