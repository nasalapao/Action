// Dashboard Logic
// =====================================================

let currentUser = null;
let selectedImage = null;
let selectedWeightImage = null;
let weightChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check login
    if (!Utils.requireLogin()) return;

    currentUser = Utils.getCurrentUser();

    // Initialize Firebase
    if (!window.firebaseApp.init()) {
        return;
    }

    // Set welcome text and avatar
    document.getElementById('welcomeText').textContent = `สวัสดี, ${currentUser.name} 👋`;

    // Set user avatar
    const avatarEl = document.getElementById('userAvatar');
    if (currentUser.profileImage) {
        avatarEl.innerHTML = `<img src="${currentUser.profileImage}" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
        avatarEl.textContent = Utils.getInitial(currentUser.name);
    }

    // Load data
    await Promise.all([
        loadUserStats(),
        loadLeaderboard(),
        loadActivities(),
        checkTodayStatus(),
        loadWeightData()
    ]);

    // Setup forms
    setupExerciseForm();
    setupImageUpload();
    setupWeightForm();
    setupWeightImageUpload();
});

// Load user statistics
async function loadUserStats() {
    try {
        const user = await DB.getUser(currentUser.id);

        if (user) {
            document.getElementById('currentStreak').textContent =
                user.currentStreak || 0;
            document.getElementById('longestStreak').textContent =
                user.longestStreak || 0;
            document.getElementById('totalExercises').textContent =
                user.totalExercises || 0;
        }

        // Calculate total calories (using simple query)
        const totalCalories = await DB.getTotalCalories(currentUser.id);
        document.getElementById('totalCalories').textContent =
            totalCalories > 0 ? Math.round(totalCalories).toLocaleString() : 0;

    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

// Load leaderboard
async function loadLeaderboard() {
    const leaderboard = document.getElementById('leaderboard');

    try {
        const users = await DB.getUsers();

        if (users.length === 0) {
            leaderboard.innerHTML = `
        <li class="empty-state" style="padding: 1rem;">
          <p class="empty-state__text">ยังไม่มีข้อมูล</p>
        </li>
      `;
            return;
        }

        // Sort by streak
        const sorted = users.sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0));

        leaderboard.innerHTML = sorted.map((user, index) => {
            const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
            const isCurrentUser = user.id === currentUser.id;

            const avatarHtml = user.profileImage
                ? `<img src="${user.profileImage}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">`
                : `<div style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; font-size: 0.65rem;">${Utils.getInitial(user.name)}</div>`;

            return `
        <li class="leaderboard__item ${rankClass ? 'leaderboard__item--' + rankClass : ''}" 
            style="${isCurrentUser ? 'border: 2px solid var(--accent-primary);' : ''}">
          <div class="leaderboard__rank ${index < 3 ? 'leaderboard__rank--' + (index + 1) : ''}">
            ${index + 1}
          </div>
          ${avatarHtml}
          <span class="leaderboard__name" style="flex: 1;">
            ${user.name} ${isCurrentUser ? '(คุณ)' : ''}
          </span>
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

// Load activity options
async function loadActivities() {
    const activitySelect = document.getElementById('activity');

    try {
        const settings = await DB.getSettings();
        const activities = settings.activities || ['วิ่ง', 'ว่ายน้ำ', 'ปั่นจักรยาน', 'เดิน', 'อื่นๆ'];

        activitySelect.innerHTML = '<option value="">เลือกกิจกรรม</option>' +
            activities.map(act => `<option value="${act}">${Utils.getActivityEmoji(act)} ${act}</option>`).join('');

    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

// Check if user exercised today
async function checkTodayStatus() {
    try {
        const hasExercised = await DB.hasExercisedToday(currentUser.id);

        if (hasExercised) {
            Utils.show('#todayStatus');
        }
    } catch (error) {
        console.error('Error checking today status:', error);
    }
}

// Setup exercise form
function setupExerciseForm() {
    const form = document.getElementById('exerciseForm');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const activity = document.getElementById('activity').value;
        const distance = document.getElementById('distance').value;
        const duration = document.getElementById('duration').value;
        const calories = document.getElementById('calories').value;

        if (!activity) {
            Utils.showToast('กรุณาเลือกกิจกรรม', 'error');
            return;
        }

        if (!duration) {
            Utils.showToast('กรุณากรอกเวลา', 'error');
            return;
        }

        // Disable button
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ กำลังบันทึก...';

        try {
            let imageUrl = null;

            // Upload image if selected
            if (selectedImage) {
                Utils.showToast('กำลังอัพโหลดรูปภาพ...', 'warning');
                const compressed = await Utils.compressImage(selectedImage);
                imageUrl = await DB.uploadImage(compressed);
            }

            // Add exercise
            await DB.addExercise(
                currentUser.id,
                activity,
                distance,
                duration,
                calories,
                imageUrl
            );

            Utils.showToast('บันทึกสำเร็จ! 🎉', 'success');

            // Reset form
            form.reset();
            selectedImage = null;
            document.getElementById('imagePreview').classList.add('hidden');
            document.getElementById('fileUploadText').textContent = 'แตะเพื่อเลือกรูปภาพ';

            // Remove focus from all inputs (prevent keyboard popup on mobile)
            document.activeElement.blur();

            // Reload data
            await Promise.all([
                loadUserStats(),
                loadLeaderboard(),
                checkTodayStatus()
            ]);

        } catch (error) {
            console.error('Error adding exercise:', error);
            Utils.showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '💪 บันทึกการออกกำลังกาย';
        }
    });
}

// Setup image upload
function setupImageUpload() {
    const imageInput = document.getElementById('imageInput');
    const imagePreview = document.getElementById('imagePreview');
    const fileUploadText = document.getElementById('fileUploadText');

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];

        if (file) {
            selectedImage = file;

            // Preview
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.classList.remove('hidden');
                fileUploadText.textContent = file.name;
            };
            reader.readAsDataURL(file);
        }
    });
}

// ==================== WEIGHT TRACKING ====================

// Load weight data and render chart
async function loadWeightData() {
    try {
        // Get latest weight
        const latestWeight = await DB.getLatestWeight(currentUser.id);

        if (latestWeight) {
            document.getElementById('currentWeight').textContent = latestWeight.weight.toFixed(1);
            document.getElementById('weightDate').textContent = Utils.formatDate(latestWeight.date);
        }

        // Get weight history for chart
        const weights = await DB.getWeights(currentUser.id, 30);

        if (weights.length > 0) {
            Utils.hide('#noWeightData');
            renderWeightChart(weights);
        } else {
            Utils.show('#noWeightData');
            const chartContainer = document.querySelector('.chart-container');
            if (chartContainer) chartContainer.style.display = 'none';
        }

    } catch (error) {
        console.error('Error loading weight data:', error);
    }
}

// Render weight chart using Chart.js
function renderWeightChart(weights) {
    const ctx = document.getElementById('weightChart');
    if (!ctx) return;

    // Sort by date ascending for chart
    const sortedWeights = [...weights].sort((a, b) => new Date(a.date) - new Date(b.date));

    const labels = sortedWeights.map(w => {
        const date = new Date(w.date);
        return `${date.getDate()}/${date.getMonth() + 1}`;
    });
    const data = sortedWeights.map(w => w.weight);

    // Destroy existing chart if exists
    if (weightChart) {
        weightChart.destroy();
    }

    // Show chart container
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) chartContainer.style.display = 'block';

    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'น้ำหนัก (kg)',
                data: data,
                borderColor: '#ff6b35',
                backgroundColor: 'rgba(255, 107, 53, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ff6b35',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
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
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return `${context.parsed.y.toFixed(1)} kg`;
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
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#8888a0',
                        font: {
                            size: 10
                        },
                        callback: function (value) {
                            return value + ' kg';
                        }
                    }
                }
            }
        }
    });
}

// Setup weight form
function setupWeightForm() {
    const form = document.getElementById('weightForm');
    const submitBtn = document.getElementById('weightSubmitBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const weight = document.getElementById('weightInput').value;

        if (!weight) {
            Utils.showToast('กรุณากรอกน้ำหนัก', 'error');
            return;
        }

        // Disable button
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ กำลังบันทึก...';

        try {
            let imageUrl = null;

            // Upload image if selected
            if (selectedWeightImage) {
                Utils.showToast('กำลังอัพโหลดรูปภาพ...', 'warning');
                const compressed = await Utils.compressImage(selectedWeightImage);
                imageUrl = await DB.uploadImage(compressed);
            }

            // Add weight record
            await DB.addWeight(currentUser.id, weight, imageUrl);

            Utils.showToast('บันทึกน้ำหนักสำเร็จ! ⚖️', 'success');

            // Reset form
            form.reset();
            selectedWeightImage = null;
            document.getElementById('weightImagePreview').classList.add('hidden');
            document.getElementById('weightFileUploadText').textContent = 'แตะเพื่อเลือกรูปภาพ';

            // Remove focus
            document.activeElement.blur();

            // Reload weight data
            await loadWeightData();

        } catch (error) {
            console.error('Error adding weight:', error);
            Utils.showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '⚖️ บันทึกน้ำหนัก';
        }
    });
}

// Setup weight image upload
function setupWeightImageUpload() {
    const imageInput = document.getElementById('weightImageInput');
    const imagePreview = document.getElementById('weightImagePreview');
    const fileUploadText = document.getElementById('weightFileUploadText');

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];

        if (file) {
            selectedWeightImage = file;

            // Preview
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.classList.remove('hidden');
                fileUploadText.textContent = file.name;
            };
            reader.readAsDataURL(file);
        }
    });
}
