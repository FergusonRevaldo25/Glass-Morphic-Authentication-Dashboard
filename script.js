// ============ MODERN BEHAVIORAL CAPTCHA ============
class BehavioralCaptcha {
  constructor(containerId, scoreInputId, statusId, messageId) {
    this.containerId = containerId;
    this.scoreInputId = scoreInputId;
    this.statusId = statusId;
    this.messageId = messageId;
    this.startTime = Date.now();
    this.mouseMovements = [];
    this.clicks = 0;
    this.keyPresses = 0;
    this.focusEvents = 0;
    this.scrollEvents = 0;
    this.verified = false;
    this.score = 0;
    this.interval = null;
    this.initTracking();
    this.startAnalysis();
  }

  initTracking() {
    document.addEventListener("mousemove", (e) => {
      this.mouseMovements.push({
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      });
      if (this.mouseMovements.length > 500) this.mouseMovements.shift();
    });
    document.addEventListener("click", () => this.clicks++);
    document.addEventListener("keydown", () => this.keyPresses++);
    document.querySelectorAll("input").forEach((input) => {
      input.addEventListener("focus", () => this.focusEvents++);
    });
    window.addEventListener("scroll", () => this.scrollEvents++);
  }

  calculateScore() {
    const timeSpent = Date.now() - this.startTime;
    const mouseComplexity = this.mouseMovements.length;
    let uniquePositions = 0;
    let lastX = null,
      lastY = null;
    for (let move of this.mouseMovements) {
      if (move.x !== lastX || move.y !== lastY) {
        uniquePositions++;
        lastX = move.x;
        lastY = move.y;
      }
    }
    let score = 0;
    if (timeSpent > 5000) score += 0.25;
    else if (timeSpent > 3000) score += 0.2;
    else if (timeSpent > 1000) score += 0.1;
    if (mouseComplexity > 30) score += 0.25;
    else if (mouseComplexity > 15) score += 0.2;
    else if (mouseComplexity > 5) score += 0.1;
    if (uniquePositions > 20) score += 0.2;
    else if (uniquePositions > 10) score += 0.15;
    if (this.clicks > 0) score += 0.1;
    if (this.keyPresses > 3) score += 0.1;
    if (this.focusEvents > 0) score += 0.1;
    return Math.min(score, 1.0);
  }

  startAnalysis() {
    this.interval = setInterval(() => {
      this.score = this.calculateScore();
      const scoreInput = document.getElementById(this.scoreInputId);
      if (scoreInput) scoreInput.value = this.score;
      const statusElement = document.getElementById(this.statusId);
      const messageElement = document.getElementById(this.messageId);
      if (this.score >= 0.6 && !this.verified) {
        this.verified = true;
        if (statusElement) {
          statusElement.classList.add("verified");
          statusElement.innerHTML =
            '<i class="fa-solid fa-check-circle"></i> <span>Human verified ✓</span>';
        }
        if (messageElement) messageElement.textContent = "Human verified ✓";
        showToast("✓ Human verification passed", "success");
        this.stopAnalysis();
      } else if (this.score < 0.3 && this.score > 0) {
        if (statusElement) {
          statusElement.classList.add("failed");
          statusElement.innerHTML =
            '<i class="fa-solid fa-triangle-exclamation"></i> <span>Bot-like behavior detected</span>';
        }
        if (messageElement)
          messageElement.textContent = "Please interact naturally";
      } else if (!this.verified && this.score >= 0.3) {
        if (statusElement) {
          statusElement.classList.remove("failed");
          statusElement.innerHTML =
            '<i class="fa-solid fa-spinner fa-pulse"></i> <span>Analyzing behavior...</span>';
        }
        if (messageElement)
          messageElement.textContent = "Verifying you're human...";
      }
    }, 2000);
  }

  stopAnalysis() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  isVerified() {
    return this.verified && this.score >= 0.6;
  }
  getScore() {
    return this.score;
  }
}

// API Base
const API_BASE = window.API_BASE || "http://localhost:3000/api";

// Global variables
let loginCaptcha = null,
  registerCaptcha = null;
let require2FA = false,
  pendingLoginData = null;
let activityOffset = 0;
let autoRefreshInterval = null;
let userChart = null;
let activityChart = null;

// User management variables
let allUsers = [];
let currentPage = 1;
const usersPerPage = 10;
let currentDeleteUserId = null;

// Helper function to escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Show toast message
function showToast(message, type = "error") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// ============ UI Functions ============
function switchForm(type) {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const title = document.getElementById("formTitle");
  const buttons = document.querySelectorAll(".toggle-btn");

  if (type === "login") {
    loginForm.classList.add("active");
    registerForm.classList.remove("active");
    title.textContent = "Welcome Back";
    buttons[0].classList.add("active");
    buttons[1].classList.remove("active");
    document.getElementById("twofaSection").classList.remove("show");
    require2FA = false;
  } else {
    loginForm.classList.remove("active");
    registerForm.classList.add("active");
    title.textContent = "Create Account";
    buttons[0].classList.remove("active");
    buttons[1].classList.add("active");
  }
  clearAllErrors();
}

function togglePassword(inputId, iconElement) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    iconElement.classList.remove("fa-eye-slash");
    iconElement.classList.add("fa-eye");
  } else {
    input.type = "password";
    iconElement.classList.remove("fa-eye");
    iconElement.classList.add("fa-eye-slash");
  }
}

function checkPasswordStrength() {
  const password = document.getElementById("regPassword").value;
  const fill = document.getElementById("strengthFill");
  const text = document.getElementById("strengthText");
  let strength = 0,
    color = "#ff4444",
    message = "Very Weak";
  if (password.length >= 6) strength++;
  if (password.length >= 10) strength++;
  if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
  if (password.match(/[0-9]/)) strength++;
  if (password.match(/[^a-zA-Z0-9]/)) strength++;
  if (strength === 0) {
    message = "Enter a password";
    color = "#ddd";
    strength = 0;
  } else if (strength <= 2) {
    message = "Weak";
    color = "#ff4444";
    strength = 25;
  } else if (strength === 3) {
    message = "Fair";
    color = "#ffaa44";
    strength = 50;
  } else if (strength === 4) {
    message = "Good";
    color = "#44ff44";
    strength = 75;
  } else {
    message = "Strong!";
    color = "#00cc00";
    strength = 100;
  }
  if (fill) fill.style.width = strength + "%";
  if (fill) fill.style.backgroundColor = color;
  if (text) text.textContent = message;
  if (text) text.style.color = color;
}

function socialLogin(provider) {
  showToast(
    `${provider.charAt(0).toUpperCase() + provider.slice(1)} login demo - OAuth integration ready`,
    "info",
  );
}

function clearAllErrors() {
  document
    .querySelectorAll(".error-msg")
    .forEach((el) => el.classList.remove("show"));
}

function getOTPCode() {
  let code = "";
  document
    .querySelectorAll(".otp-input")
    .forEach((input) => (code += input.value));
  return code;
}

function verify2FA() {
  const code = getOTPCode();
  if (code === "123456") {
    showToast("✅ 2FA verified! Login successful!", "success");
    document.getElementById("twofaSection").classList.remove("show");
    document
      .querySelectorAll(".otp-input")
      .forEach((input) => (input.value = ""));
    require2FA = false;
    performLogin(pendingLoginData.email, pendingLoginData.password);
  } else {
    document.getElementById("otpError").textContent =
      "Invalid 2FA code. Use 123456";
    document.getElementById("otpError").classList.add("show");
  }
}

// ============ Dashboard Functions ============
function showDashboard() {
  const authContainer = document.getElementById("authContainer");
  const dashboardContainer = document.getElementById("dashboardContainer");
  if (authContainer) authContainer.style.display = "none";
  if (dashboardContainer) dashboardContainer.style.display = "block";
  startClock();
  loadDashboardData();
  loadRecentSignups();
  loadTopUsers();
  loadLeaderboard();
  loadNotifications();
  loadActivityChart();
  loadSavedTheme();
}

function showAuth() {
  const authContainer = document.getElementById("authContainer");
  const dashboardContainer = document.getElementById("dashboardContainer");
  if (authContainer) authContainer.style.display = "flex";
  if (dashboardContainer) dashboardContainer.style.display = "none";
}

function startClock() {
  setInterval(() => {
    const clock = document.getElementById("realTimeClock");
    if (clock) clock.textContent = new Date().toLocaleTimeString();
  }, 1000);
}

function loadSavedTheme() {
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
    const icon = document.querySelector("#darkModeToggle i");
    if (icon) icon.classList.replace("fa-moon", "fa-sun");
  }
}

// ============ SWITCH PAGE FUNCTION (FIXED) ============
function switchPage(page) {
  // Update active nav item
  document.querySelectorAll(".nav-item").forEach((item) => {
    if (item.getAttribute("data-page") === page) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Hide all content sections
  const contents = [
    "dashboardContent",
    "profileContent",
    "analyticsContent",
    "usersContent",
    "settingsContent",
  ];
  contents.forEach((contentId) => {
    const el = document.getElementById(contentId);
    if (el) el.style.display = "none";
  });

  // Show selected content
  const selectedContent = document.getElementById(`${page}Content`);
  if (selectedContent) {
    selectedContent.style.display = "block";
  }

  // Update page title
  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) {
    const titles = {
      dashboard: "Dashboard",
      profile: "Profile",
      analytics: "Analytics",
      users: "User Management",
      settings: "Settings",
    };
    pageTitle.textContent =
      titles[page] || page.charAt(0).toUpperCase() + page.slice(1);
  }

  // Load page-specific data
  if (page === "profile") {
    loadProfileData();
  } else if (page === "analytics") {
    loadTopUsers();
  } else if (page === "users") {
    loadUsers();
  }
}

// ============ Dashboard Data Loading ============
async function loadDashboardData() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/dashboard-data`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed");
    const data = await response.json();

    const totalUsers = document.getElementById("totalUsers");
    const streakDays = document.getElementById("streakDays");
    const activeSessions = document.getElementById("activeSessions");
    const totalActivities = document.getElementById("totalActivities");
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");

    if (totalUsers) totalUsers.textContent = data.stats?.totalUsers || 0;
    if (streakDays) streakDays.textContent = data.user?.streakDays || 0;
    if (activeSessions)
      activeSessions.textContent = data.stats?.activeSessions || 0;
    if (totalActivities)
      totalActivities.textContent = data.stats?.totalActivities || 0;
    if (userName) userName.textContent = data.user?.name || "User";
    if (userEmail) userEmail.textContent = data.user?.email || "";

    const feed = document.getElementById("activityFeed");
    if (feed && data.activities?.length) {
      feed.innerHTML = data.activities
        .map(
          (a) => `
        <div class="activity-item">
          <i class="fas ${a.action.includes("Login") ? "fa-sign-in-alt" : a.action.includes("Avatar") ? "fa-camera" : "fa-user-plus"}"></i>
          <div><strong>${escapeHtml(a.action)}</strong><p>${escapeHtml(a.details)}</p><small>${a.time}</small></div>
        </div>
      `,
        )
        .join("");
    } else if (feed) {
      feed.innerHTML = '<div class="activity-item">No activities yet</div>';
    }

    if (data.user?.avatar) {
      const userAvatar = document.querySelector(".user-avatar");
      if (userAvatar) {
        userAvatar.innerHTML = `<img src="${data.user.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
      }
    }
  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

async function loadRecentSignups() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/recent-signups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    const container = document.getElementById("recentSignups");
    if (container && data.users?.length) {
      container.innerHTML = data.users
        .map(
          (u) => `
        <div class="recent-user">
          <div class="user-small-avatar">${escapeHtml(u.name.charAt(0).toUpperCase())}</div>
          <div class="user-info"><strong>${escapeHtml(u.name)}</strong><small>${escapeHtml(u.email)}</small></div>
        </div>
      `,
        )
        .join("");
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadTopUsers() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/top-users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    const container = document.getElementById("topUsersList");
    if (container && data.users?.length) {
      container.innerHTML = data.users
        .map(
          (u, i) => `
        <div class="recent-user"><div class="user-small-avatar">${i + 1}</div><div><strong>${escapeHtml(u.name)}</strong><small>${u.login_count} logins</small></div></div>
      `,
        )
        .join("");
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadLeaderboard() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/leaderboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    const container = document.getElementById("leaderboardList");
    if (container && data.leaderboard) {
      container.innerHTML = data.leaderboard
        .map(
          (user, idx) => `
        <div class="leaderboard-item">
          <div class="leaderboard-rank">${idx + 1}</div>
          <div class="leaderboard-name">${escapeHtml(user.name)}</div>
          <div class="leaderboard-score">${user.activity_count} activities</div>
        </div>
      `,
        )
        .join("");
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadNotifications() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/dashboard-data`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    const container = document.getElementById("notificationsList");
    const badge = document.getElementById("notificationBadge");

    if (container && data.notifications) {
      const unreadCount = data.notifications.filter((n) => !n.is_read).length;
      if (badge) badge.textContent = unreadCount > 0 ? unreadCount : "";

      container.innerHTML = data.notifications
        .map(
          (n) => `
        <div class="notification-item ${!n.is_read ? "unread" : ""}" onclick="markNotificationRead(${n.id})">
          <div class="notification-icon"><i class="fas fa-bell"></i></div>
          <div class="notification-content">
            <div class="notification-title">${escapeHtml(n.title)}</div>
            <div class="notification-message">${escapeHtml(n.message)}</div>
          </div>
        </div>
      `,
        )
        .join("");
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadActivityChart() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/activity-chart`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    const ctx = document.getElementById("activityChart");
    if (ctx && data.chartData && data.chartData.length > 0) {
      if (activityChart) activityChart.destroy();
      activityChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: data.chartData.map((d) =>
            new Date(d.date).toLocaleDateString(),
          ),
          datasets: [
            {
              label: "Activities",
              data: data.chartData.map((d) => d.count),
              borderColor: "#a17eff",
              backgroundColor: "rgba(161, 126, 255, 0.1)",
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              labels: {
                color: document.body.classList.contains("light-mode")
                  ? "#1a1a2e"
                  : "white",
              },
            },
          },
          scales: {
            y: {
              ticks: {
                color: document.body.classList.contains("light-mode")
                  ? "#1a1a2e"
                  : "white",
              },
              grid: { color: "rgba(255,255,255,0.1)" },
            },
            x: {
              ticks: {
                color: document.body.classList.contains("light-mode")
                  ? "#1a1a2e"
                  : "white",
              },
              grid: { color: "rgba(255,255,255,0.1)" },
            },
          },
        },
      });
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadMoreActivities() {
  const token = localStorage.getItem("authToken");
  if (!token) return;
  activityOffset += 10;

  try {
    const response = await fetch(
      `${API_BASE}/activities/all?offset=${activityOffset}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await response.json();
    if (data.activities?.length) {
      const feed = document.getElementById("activityFeed");
      data.activities.forEach((a) => {
        if (feed) {
          feed.insertAdjacentHTML(
            "beforeend",
            `
            <div class="activity-item">
              <i class="fas fa-clock"></i>
              <div><strong>${escapeHtml(a.action)}</strong><p>${escapeHtml(a.details)}</p><small>${new Date(a.created_at).toLocaleString()}</small></div>
            </div>
          `,
          );
        }
      });
      showToast(`Loaded ${data.activities.length} more activities`, "success");
    } else {
      showToast("No more activities", "info");
    }
  } catch (err) {
    showToast("Error loading more", "error");
  }
}

async function filterActivities(type) {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/activities/${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (data.activities) {
      const feed = document.getElementById("activityFeed");
      if (feed) {
        feed.innerHTML = data.activities
          .map(
            (a) => `
          <div class="activity-item">
            <i class="fas fa-clock"></i>
            <div><strong>${escapeHtml(a.action)}</strong><p>${escapeHtml(a.details)}</p><small>${new Date(a.created_at).toLocaleString()}</small></div>
          </div>
        `,
          )
          .join("");
      }
      showToast(`Showing ${type} activities`, "success");
    }
  } catch (err) {
    console.error(err);
  }
}

async function markNotificationRead(id) {
  const token = localStorage.getItem("authToken");
  try {
    await fetch(`${API_BASE}/mark-notification-read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notificationId: id }),
    });
    loadNotifications();
  } catch (err) {
    console.error(err);
  }
}

function quickAction(action) {
  const messages = {
    message: "📧 Message feature coming soon!",
    share: "🔗 Share feature coming soon!",
    export: "📊 Export feature coming soon!",
    invite: "👥 Invite friends feature coming soon!",
  };
  showToast(messages[action] || "Feature coming soon!", "info");
}

async function refreshDashboard() {
  await loadDashboardData();
  await loadRecentSignups();
  await loadLeaderboard();
  await loadNotifications();
  await loadTopUsers();
  showToast("Dashboard refreshed!", "success");
}

async function exportUsers() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    showToast("Exporting users...", "info");
    const response = await fetch(`${API_BASE}/export-users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (data.csv) {
      const blob = new Blob([data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users_export_${new Date().toISOString().slice(0, 19)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Exported successfully!", "success");
    }
  } catch (err) {
    showToast("Export failed", "error");
  }
}

// ============ Profile Functions ============
async function loadProfileData() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (data.user) {
      const profileName = document.getElementById("profileName");
      const profileEmail = document.getElementById("profileEmail");
      const profileBio = document.getElementById("profileBio");
      const profileLocation = document.getElementById("profileLocation");
      const profileWebsite = document.getElementById("profileWebsite");
      const memberSince = document.getElementById("memberSince");
      const profileLoginCount = document.getElementById("profileLoginCount");
      const lastLoginDate = document.getElementById("lastLoginDate");

      if (profileName) profileName.value = data.user.name || "";
      if (profileEmail) profileEmail.value = data.user.email || "";
      if (profileBio) profileBio.value = data.user.bio || "";
      if (profileLocation) profileLocation.value = data.user.location || "";
      if (profileWebsite) profileWebsite.value = data.user.website || "";
      if (memberSince)
        memberSince.textContent = data.user.created_at
          ? new Date(data.user.created_at).toLocaleDateString()
          : "-";
      if (profileLoginCount)
        profileLoginCount.textContent = data.user.login_count || 0;
      if (lastLoginDate)
        lastLoginDate.textContent = data.user.last_login
          ? new Date(data.user.last_login).toLocaleString()
          : "Never";

      if (data.user.avatar) {
        const avatarImg = document.getElementById("profileAvatarImg");
        const avatarIcon = document.getElementById("profileAvatarIcon");
        if (avatarImg) {
          avatarImg.src = data.user.avatar;
          avatarImg.style.display = "block";
          if (avatarIcon) avatarIcon.style.display = "none";
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function updateProfile() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  const name = document.getElementById("profileName")?.value;
  const bio = document.getElementById("profileBio")?.value;
  const location = document.getElementById("profileLocation")?.value;
  const website = document.getElementById("profileWebsite")?.value;
  const currentPassword = document.getElementById("currentPassword")?.value;
  const newPassword = document.getElementById("newPassword")?.value;
  const confirmNew = document.getElementById("confirmNewPassword")?.value;

  if (newPassword && newPassword !== confirmNew) {
    showToast("New passwords do not match", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/update-profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        bio,
        location,
        website,
        currentPassword,
        newPassword,
      }),
    });
    const data = await response.json();
    if (response.ok) {
      showToast("Profile updated!", "success");
      document.getElementById("currentPassword").value = "";
      document.getElementById("newPassword").value = "";
      document.getElementById("confirmNewPassword").value = "";
      const userName = document.getElementById("userName");
      if (userName) userName.textContent = name;
    } else {
      showToast(data.error || "Update failed", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

async function uploadAvatar(file) {
  const token = localStorage.getItem("authToken");
  const formData = new FormData();
  formData.append("avatar", file);

  try {
    const response = await fetch(`${API_BASE}/upload-avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await response.json();
    if (response.ok) {
      showToast("Avatar uploaded!", "success");
      loadDashboardData();
      loadProfileData();
    } else {
      showToast(data.error || "Upload failed", "error");
    }
  } catch (err) {
    showToast("Upload error", "error");
  }
}

// ============ USER MANAGEMENT FUNCTIONS ============

async function loadUsers() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    allUsers = data.users || [];
    displayUsers();
  } catch (err) {
    console.error("Error loading users:", err);
    showToast("Failed to load users", "error");
  }
}

function displayUsers() {
  const searchTerm =
    document.getElementById("userSearchInput")?.value.toLowerCase() || "";
  const statusFilter =
    document.getElementById("userStatusFilter")?.value || "all";

  let filteredUsers = allUsers.filter((user) => {
    const matchesSearch =
      (user.name || "").toLowerCase().includes(searchTerm) ||
      (user.email || "").toLowerCase().includes(searchTerm);
    const matchesStatus =
      statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  if (paginatedUsers.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="loading-text">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = paginatedUsers
    .map(
      (user) => `
    <tr>
      <td>${user.id}</td>
      <td>
        <div class="user-avatar-small">
          ${user.name ? user.name.charAt(0).toUpperCase() : "U"}
        </div>
      </td>
      <td><strong>${escapeHtml(user.name || "")}</strong></td>
      <td>${escapeHtml(user.email || "")}</td>
      <td>
        <span class="status-badge status-${user.status === "active" ? "active" : "inactive"}">
          ${user.status || "active"}
        </span>
      </td>
      <td>${user.login_count || 0}</td>
      <td>${user.last_login || "Never"}</td>
      <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn-small edit-btn" onclick="editUser(${user.id})">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="action-btn-small delete-btn" onclick="openDeleteModal(${user.id}, '${escapeHtml(user.name || "")}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const pageInfo = document.getElementById("pageInfo");
  if (pageInfo)
    pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

function filterUsers() {
  currentPage = 1;
  displayUsers();
}

function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    displayUsers();
  }
}

function nextPage() {
  const totalPages = Math.ceil(allUsers.length / usersPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    displayUsers();
  }
}

function openAddUserModal() {
  document.getElementById("modalTitle").innerHTML =
    '<i class="fas fa-user-plus"></i> Add New User';
  document.getElementById("editUserId").value = "";
  document.getElementById("modalUserName").value = "";
  document.getElementById("modalUserEmail").value = "";
  document.getElementById("userPassword").value = "";
  document.getElementById("userStatus").value = "active";
  document.getElementById("userIsAdmin").checked = false;
  document.getElementById("saveButtonText").textContent = "Save User";
  document.getElementById("passwordField").style.display = "block";
  document.getElementById("userModal").style.display = "flex";
}

async function editUser(userId) {
  const token = localStorage.getItem("authToken");
  if (!token) {
    showToast("Please login again", "error");
    return;
  }

  try {
    showToast("Loading user data...", "info");
    const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("User data received:", data);

    if (data.user) {
      document.getElementById("modalTitle").innerHTML =
        '<i class="fas fa-user-edit"></i> Edit User';
      document.getElementById("editUserId").value = data.user.id;
      document.getElementById("modalUserName").value = data.user.name || "";
      document.getElementById("modalUserEmail").value = data.user.email || "";
      document.getElementById("userStatus").value =
        data.user.status || "active";
      document.getElementById("userIsAdmin").checked =
        data.user.is_admin || false;
      document.getElementById("saveButtonText").textContent = "Update User";
      document.getElementById("passwordField").style.display = "none";
      document.getElementById("userModal").style.display = "flex";
    } else {
      showToast("User data not found", "error");
    }
  } catch (err) {
    console.error("Edit user error:", err);
    showToast("Error loading user data: " + err.message, "error");
  }
}

function closeUserModal() {
  document.getElementById("userModal").style.display = "none";
}

function toggleModalPassword(inputId, iconElement) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    iconElement.classList.remove("fa-eye-slash");
    iconElement.classList.add("fa-eye");
  } else {
    input.type = "password";
    iconElement.classList.remove("fa-eye");
    iconElement.classList.add("fa-eye-slash");
  }
}

// Save user form handler
document.getElementById("userForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("authToken");
  const userId = document.getElementById("editUserId").value;
  const name = document.getElementById("modalUserName").value.trim();
  const email = document.getElementById("modalUserEmail").value.trim();
  const password = document.getElementById("userPassword").value;
  const status = document.getElementById("userStatus").value;
  const isAdmin = document.getElementById("userIsAdmin").checked;

  if (!name || !email) {
    showToast("Name and email are required", "error");
    return;
  }

  if (!userId && (!password || password.length < 6)) {
    showToast("Password must be at least 6 characters", "error");
    return;
  }

  try {
    let response;
    if (userId) {
      response = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, status, isAdmin }),
      });
    } else {
      response = await fetch(`${API_BASE}/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, password, isAdmin }),
      });
    }

    const data = await response.json();
    if (response.ok) {
      showToast(
        userId ? "User updated successfully" : "User added successfully",
        "success",
      );
      closeUserModal();
      loadUsers();
    } else {
      showToast(data.error || "Operation failed", "error");
    }
  } catch (err) {
    console.error("Save user error:", err);
    showToast("Server error: " + err.message, "error");
  }
});

function openDeleteModal(userId, userName) {
  currentDeleteUserId = userId;
  document.getElementById("deleteUserName").textContent = userName;
  document.getElementById("deleteModal").style.display = "flex";
}

function closeDeleteModal() {
  document.getElementById("deleteModal").style.display = "none";
  currentDeleteUserId = null;
}

async function confirmDeleteUser() {
  if (!currentDeleteUserId) return;

  const token = localStorage.getItem("authToken");
  try {
    const response = await fetch(
      `${API_BASE}/admin/users/${currentDeleteUserId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const data = await response.json();
    if (response.ok) {
      showToast("User deleted successfully", "success");
      closeDeleteModal();
      loadUsers();
    } else {
      showToast(data.error || "Delete failed", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

// ============ Auth Functions ============
async function performLogin(email, password) {
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      showToast("Login successful!", "success");
      showDashboard();
    } else {
      showToast(data.error || "Invalid credentials", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

function logout() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  showToast("Logged out", "success");
  showAuth();
}

function clearLocalData() {
  if (confirm("Are you sure? This will clear all local settings.")) {
    localStorage.clear();
    showToast("Local data cleared", "success");
    window.location.reload();
  }
}

// ============ Navigation Setup ============
function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const page = item.getAttribute("data-page");
      if (page) {
        switchPage(page);
      }
    });
  });
}

// ============ Event Listeners Setup ============
function setupEventListeners() {
  // Dark mode toggle
  const darkModeToggle = document.getElementById("darkModeToggle");
  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
      document.body.classList.toggle("light-mode");
      const icon = darkModeToggle.querySelector("i");
      if (document.body.classList.contains("light-mode")) {
        icon.classList.replace("fa-moon", "fa-sun");
        localStorage.setItem("theme", "light");
      } else {
        icon.classList.replace("fa-sun", "fa-moon");
        localStorage.setItem("theme", "dark");
      }
      if (activityChart) {
        const color = document.body.classList.contains("light-mode")
          ? "#1a1a2e"
          : "white";
        activityChart.options.plugins.legend.labels.color = color;
        activityChart.options.scales.y.ticks.color = color;
        activityChart.options.scales.x.ticks.color = color;
        activityChart.update();
      }
    });
  }

  // Load more button
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (loadMoreBtn) loadMoreBtn.addEventListener("click", loadMoreActivities);

  // Avatar upload
  const avatarUpload = document.getElementById("avatarUpload");
  if (avatarUpload) {
    avatarUpload.addEventListener("change", (e) => {
      if (e.target.files[0]) uploadAvatar(e.target.files[0]);
    });
  }

  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterActivities(btn.getAttribute("data-filter"));
    });
  });

  // Auto refresh
  const autoRefresh = document.getElementById("autoRefresh");
  if (autoRefresh) {
    autoRefresh.addEventListener("change", (e) => {
      if (e.target.checked) {
        autoRefreshInterval = setInterval(refreshDashboard, 30000);
      } else {
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
      }
    });
  }

  // Default page
  const defaultPage = document.getElementById("defaultPage");
  if (defaultPage) {
    defaultPage.addEventListener("change", (e) => {
      localStorage.setItem("defaultPage", e.target.value);
    });
    const savedPage = localStorage.getItem("defaultPage");
    if (savedPage && savedPage !== "dashboard") {
      setTimeout(() => {
        switchPage(savedPage);
      }, 500);
    }
  }
}

// ============ Form Handlers ============
document
  .getElementById("loginFormElement")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail")?.value.trim();
    const password = document.getElementById("loginPassword")?.value;
    if (!loginCaptcha || !loginCaptcha.isVerified()) {
      showToast("⚠️ Please wait - verifying you are human...", "error");
      return;
    }
    if (email === "demo@example.com") {
      require2FA = true;
      pendingLoginData = { email, password };
      document.getElementById("twofaSection")?.classList.add("show");
      showToast("📱 2FA required. Enter code: 123456", "info");
    } else {
      performLogin(email, password);
    }
  });

document
  .getElementById("registerFormElement")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("regName")?.value.trim();
    const email = document.getElementById("regEmail")?.value.trim();
    const password = document.getElementById("regPassword")?.value;
    const confirm = document.getElementById("regConfirmPassword")?.value;
    if (!registerCaptcha || !registerCaptcha.isVerified()) {
      showToast("⚠️ Please wait - verifying you are human...", "error");
      return;
    }
    if (password !== confirm) {
      showToast("Passwords do not match", "error");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        showToast("Registration successful! Please login.", "success");
        setTimeout(() => switchForm("login"), 2000);
        document.getElementById("regName").value = "";
        document.getElementById("regEmail").value = "";
        document.getElementById("regPassword").value = "";
        document.getElementById("regConfirmPassword").value = "";
      } else {
        showToast(data.error || "Signup failed", "error");
      }
    } catch (err) {
      showToast("Server error", "error");
    }
  });

// Setup OTP inputs
document.querySelectorAll(".otp-input").forEach((input, idx) => {
  input.addEventListener("input", function () {
    if (this.value.length === 1 && idx < 5) {
      document
        .querySelector(`.otp-input[data-otp-index="${idx + 1}"]`)
        ?.focus();
    }
  });
  input.addEventListener("keyup", function (e) {
    if (idx === 5 && this.value.length === 1) verify2FA();
  });
});

// Initialize everything
document.addEventListener("DOMContentLoaded", () => {
  loginCaptcha = new BehavioralCaptcha(
    "captchaContainer",
    "captchaScore",
    "captchaStatus",
    "captchaMessage",
  );
  registerCaptcha = new BehavioralCaptcha(
    "regCaptchaContainer",
    "regCaptchaScore",
    "regCaptchaStatus",
    "regCaptchaMessage",
  );
  setupNavigation();
  setupEventListeners();

  if (localStorage.getItem("authToken")) {
    showDashboard();
  } else {
    showAuth();
  }
});
