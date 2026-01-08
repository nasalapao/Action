// Main App Logic - Home Page
// =====================================================

let allUsersWeightChart = null;

// Color palette for different users
const chartColors = [
  '#ff6b35',  // Orange
  '#00c9a7',  // Teal
  '#6366f1',  // Purple
  '#f59e0b',  // Amber
  '#ec4899',  // Pink
  '#10b981',  // Emerald
  '#8b5cf6',  // Violet
  '#3b82f6',  // Blue
  '#ef4444',  // Red
  '#14b8a6',  // Cyan
];

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Firebase
  if (!window.firebaseApp.init()) {
    return; // Config error shown by firebase-config.js
  }

  // Check and reset streaks on load
  await DB.checkAndResetAllStreaks();

  // Load users
  await loadUsers();
  await loadLeaderboard();
  await loadAllUsersWeightChart();
});

// Load users grid
async function loadUsers() {
  const userGrid = document.getElementById('userGrid');
  const emptyUsers = document.getElementById('emptyUsers');

  try {
    const users = await DB.getUsers();

    if (users.length === 0) {
      userGrid.innerHTML = '';
      Utils.show(emptyUsers);
      return;
    }

    Utils.hide(emptyUsers);

    userGrid.innerHTML = users.map(user => `
      <div class="user-card" onclick="selectUser('${user.id}', '${user.name}', '${user.profileImage || ''}')">
        <div class="user-card__avatar">
          ${user.profileImage ?
        `<img src="${user.profileImage}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` :
        Utils.getInitial(user.name)
      }
        </div>
        <div class="user-card__info">
          <div class="user-card__name">${user.name}</div>
          <div class="user-card__streak">
            ${user.currentStreak > 0 ? `🔥 ${user.currentStreak}` : ''}
          </div>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error loading users:', error);
    userGrid.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__text">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
      </div>
    `;
  }
}

// Load leaderboard preview
async function loadLeaderboard() {
  const leaderboard = document.getElementById('quickLeaderboard');

  try {
    const users = await DB.getUsers();

    if (users.length === 0) {
      leaderboard.innerHTML = `
        <li class="empty-state" style="padding: 1rem;">
          <p class="empty-state__text" style="font-size: 0.875rem;">ยังไม่มีข้อมูล</p>
        </li>
      `;
      return;
    }

    // Sort by streak
    const sorted = users.sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0));
    const top3 = sorted.slice(0, 3);

    leaderboard.innerHTML = top3.map((user, index) => {
      const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze';

      const avatarHtml = user.profileImage
        ? `<img src="${user.profileImage}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">`
        : `<div style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; font-size: 0.65rem;">${Utils.getInitial(user.name)}</div>`;

      return `
        <li class="leaderboard__item leaderboard__item--${rankClass}">
          <div class="leaderboard__rank leaderboard__rank--${index + 1}">
            ${index + 1}
          </div>
          ${avatarHtml}
          <span class="leaderboard__name" style="flex: 1;">${user.name}</span>
          <span class="leaderboard__streak">
            <span class="leaderboard__streak-icon">🔥</span>
            ${user.currentStreak || 0}
          </span>
        </li>
      `;
    }).join('');

  } catch (error) {
    console.error('Error loading leaderboard:', error);
  }
}

// Select user and go to dashboard
function selectUser(userId, userName, profileImage) {
  Utils.setCurrentUser(userId, userName, profileImage);
  Utils.showToast(`สวัสดี ${userName}! 👋`);

  // Small delay for toast to show
  setTimeout(() => {
    window.location.href = 'dashboard.html';
  }, 500);
}

// Load all users weight chart - separate lines per user with dates on X-axis
async function loadAllUsersWeightChart() {
  const ctx = document.getElementById('allUsersWeightChart');
  const noDataEl = document.getElementById('noAllWeightData');
  const legendEl = document.getElementById('weightLegend');
  const chartContainer = ctx?.closest('.chart-container');

  if (!ctx) return;

  try {
    // Get all users weights
    const allUsersData = await DB.getAllUsersWeights(100);

    if (allUsersData.length === 0) {
      Utils.show(noDataEl);
      if (chartContainer) chartContainer.style.display = 'none';
      if (legendEl) legendEl.innerHTML = '';
      return;
    }

    Utils.hide(noDataEl);
    if (chartContainer) chartContainer.style.display = 'block';

    // Process each user's weights - keep only latest weight per day
    const processedUsers = allUsersData.map(userData => {
      const weightsByDate = {};

      // Group by date, keeping only the latest (by createdAt) for each day
      userData.weights.forEach(w => {
        const date = w.date;
        if (!weightsByDate[date]) {
          weightsByDate[date] = w;
        } else {
          // Compare createdAt to keep latest
          const existingTime = weightsByDate[date].createdAt?.toDate?.() || new Date(0);
          const newTime = w.createdAt?.toDate?.() || new Date(0);
          if (newTime > existingTime) {
            weightsByDate[date] = w;
          }
        }
      });

      return {
        userName: userData.userName,
        userId: userData.userId,
        weights: Object.values(weightsByDate)
      };
    });

    // Collect all unique dates
    const allDates = new Set();
    processedUsers.forEach(userData => {
      userData.weights.forEach(w => allDates.add(w.date));
    });

    // Sort dates ascending
    const sortedDates = Array.from(allDates).sort();

    // Create labels from dates (format: d/m)
    const labels = sortedDates.map(dateStr => {
      const date = new Date(dateStr);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    });

    // Create datasets for each user
    const datasets = processedUsers.map((userData, index) => {
      const color = chartColors[index % chartColors.length];

      // Map weights to dates (fill null for missing dates)
      const data = sortedDates.map(dateStr => {
        const weight = userData.weights.find(w => w.date === dateStr);
        return weight ? weight.weight : null;
      });

      return {
        label: userData.userName,
        data: data,
        borderColor: color,
        backgroundColor: color + '20',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        pointRadius: 5,
        pointHoverRadius: 7,
        spanGaps: true
      };
    });

    // Destroy existing chart
    if (allUsersWeightChart) {
      allUsersWeightChart.destroy();
    }

    // Create line chart
    allUsersWeightChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(15, 15, 26, 0.9)',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            callbacks: {
              label: function (context) {
                if (context.parsed.y !== null) {
                  return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} kg`;
                }
                return '';
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            ticks: {
              color: '#8888a0',
              font: { size: 10 }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            ticks: {
              color: '#8888a0',
              font: { size: 10 },
              callback: function (value) {
                return value + ' kg';
              }
            }
          }
        }
      }
    });

    // Render legend
    if (legendEl) {
      legendEl.innerHTML = processedUsers.map((userData, index) => {
        const color = chartColors[index % chartColors.length];
        // Get latest weight for display
        const latestWeight = userData.weights.sort((a, b) =>
          new Date(b.date) - new Date(a.date)
        )[0];
        return `
          <div class="weight-legend__item">
            <div class="weight-legend__color" style="background: ${color}"></div>
            <span>${userData.userName}${latestWeight ? `: ${latestWeight.weight.toFixed(1)} kg` : ''}</span>
          </div>
        `;
      }).join('');
    }

  } catch (error) {
    console.error('Error loading all users weight chart:', error);
  }
}
