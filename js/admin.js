// Admin Page Logic
// =====================================================

let currentSettings = null;
let deleteUserId = null;
let editStreakUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase
    if (!window.firebaseApp.init()) {
        return;
    }

    // Initialize default settings if needed
    await DB.initSettings();

    // Load data
    await Promise.all([
        loadUsers(),
        loadSettings()
    ]);

    // Setup forms
    setupAddUserForm();
    setupSettingsForm();
    setupActivityForm();
});

// ==================== USERS ====================

// Load users list
async function loadUsers() {
    const userList = document.getElementById('userList');
    const emptyUsers = document.getElementById('emptyUsers');

    Utils.showLoading(userList);

    try {
        const users = await DB.getUsers();

        if (users.length === 0) {
            userList.innerHTML = '';
            Utils.show(emptyUsers);
            return;
        }

        Utils.hide(emptyUsers);

        userList.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>ชื่อ</th>
            <th>Streak</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td style="display: flex; align-items: center; gap: 0.5rem;">
                ${user.profileImage ?
                `<img src="${user.profileImage}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">` :
                `<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">${Utils.getInitial(user.name)}</div>`
            }
                <div>
                  <strong>${user.name}</strong>
                  <div class="text-muted" style="font-size: 0.75rem;">
                    ${user.lastExerciseDate ? Utils.formatRelativeDate(user.lastExerciseDate) : 'ยังไม่เคยออกกำลังกาย'}
                  </div>
                </div>
              </td>
              <td>
                <span style="color: var(--accent-primary);">🔥 ${user.currentStreak || 0}</span>
              </td>
              <td style="text-align: right;">
                <button class="btn btn--secondary btn--small" 
                        onclick="openEditProfileModal('${user.id}', '${user.name}', '${user.profileImage || ''}')"
                        style="width: auto; margin-right: 0.25rem; padding: 0.25rem 0.5rem;" title="แก้ไขโปรไฟล์">
                  📷
                </button>
                <button class="btn btn--primary btn--small" 
                        onclick="openEditStreakModal('${user.id}', '${user.name}', ${user.currentStreak || 0}, ${user.longestStreak || 0}, '${user.lastExerciseDate || ''}')"
                        style="width: auto; margin-right: 0.25rem; padding: 0.25rem 0.5rem;" title="ตั้งค่า Streak">
                  ✏️
                </button>
                <button class="btn btn--secondary btn--small" 
                        onclick="resetUserStreak('${user.id}', '${user.name}')"
                        style="width: auto; margin-right: 0.25rem; padding: 0.25rem 0.5rem;" title="Reset Streak">
                  🔄
                </button>
                <button class="btn btn--danger btn--small" 
                        onclick="confirmDeleteUser('${user.id}', '${user.name}')"
                        style="width: auto; padding: 0.25rem 0.5rem;" title="ลบผู้ใช้">
                  🗑️
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    } catch (error) {
        console.error('Error loading users:', error);
        userList.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__text">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
      </div>
    `;
    }
}

// Setup add user form
function setupAddUserForm() {
    const form = document.getElementById('addUserForm');
    const btn = document.getElementById('addUserBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('newUserName');
        const name = nameInput.value.trim();

        if (!name) {
            Utils.showToast('กรุณากรอกชื่อ', 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = '⏳ กำลังเพิ่ม...';

        try {
            await DB.addUser(name);
            Utils.showToast(`เพิ่มผู้ใช้ "${name}" สำเร็จ!`, 'success');
            nameInput.value = '';
            await loadUsers();
        } catch (error) {
            console.error('Error adding user:', error);
            Utils.showToast('เกิดข้อผิดพลาด', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '➕ เพิ่มผู้ใช้';
        }
    });
}

// Confirm delete user
function confirmDeleteUser(userId, userName) {
    deleteUserId = userId;
    document.getElementById('deleteMessage').textContent =
        `คุณต้องการลบผู้ใช้ "${userName}" หรือไม่?`;
    document.getElementById('deleteModal').classList.add('modal--active');

    document.getElementById('confirmDeleteBtn').onclick = () => deleteUser(userId);
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('modal--active');
    deleteUserId = null;
}

// Delete user
async function deleteUser(userId) {
    try {
        await DB.deleteUser(userId);
        Utils.showToast('ลบผู้ใช้สำเร็จ', 'success');
        closeDeleteModal();
        await loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        Utils.showToast('เกิดข้อผิดพลาด', 'error');
    }
}

// Reset single user streak
async function resetUserStreak(userId, userName) {
    if (!confirm(`ต้องการ Reset Streak ของ "${userName}" หรือไม่?`)) return;

    try {
        await DB.resetUserStreak(userId);
        Utils.showToast(`Reset Streak ของ "${userName}" สำเร็จ`, 'success');
        await loadUsers();
    } catch (error) {
        console.error('Error resetting streak:', error);
        Utils.showToast('เกิดข้อผิดพลาด', 'error');
    }
}

// Reset all streaks
async function resetAllStreaks() {
    if (!confirm('⚠️ คุณแน่ใจหรือไม่ว่าต้องการ Reset Streak ของทุกคน?')) return;

    try {
        const users = await DB.getUsers();
        for (const user of users) {
            await DB.resetUserStreak(user.id);
        }
        Utils.showToast('Reset Streak ทุกคนสำเร็จ', 'success');
        await loadUsers();
    } catch (error) {
        console.error('Error resetting all streaks:', error);
        Utils.showToast('เกิดข้อผิดพลาด', 'error');
    }
}

// ==================== SETTINGS ====================

// Load settings
async function loadSettings() {
    try {
        currentSettings = await DB.getSettings();

        document.getElementById('maxDays').value = currentSettings.maxDaysWithoutExercise || 3;

        renderActivities();

    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Setup settings form
function setupSettingsForm() {
    const form = document.getElementById('settingsForm');
    const btn = document.getElementById('saveSettingsBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const maxDays = parseInt(document.getElementById('maxDays').value);

        btn.disabled = true;
        btn.textContent = '⏳ กำลังบันทึก...';

        try {
            await DB.updateSettings({
                ...currentSettings,
                maxDaysWithoutExercise: maxDays
            });

            Utils.showToast('บันทึกการตั้งค่าสำเร็จ!', 'success');
            await loadSettings();

        } catch (error) {
            console.error('Error saving settings:', error);
            Utils.showToast('เกิดข้อผิดพลาด', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 บันทึกการตั้งค่า';
        }
    });
}

// ==================== ACTIVITIES ====================

// Render activities list
function renderActivities() {
    const list = document.getElementById('activitiesList');
    const activities = currentSettings?.activities || [];

    if (activities.length === 0) {
        list.innerHTML = '<p class="text-muted">ยังไม่มีกิจกรรม</p>';
        return;
    }

    list.innerHTML = activities.map((activity, index) => {
        // Parse icon:name format (backward compatible with just name)
        const parts = activity.includes(':') ? activity.split(':') : ['💪', activity];
        const icon = parts[0];
        const name = parts.slice(1).join(':'); // Handle names with colons

        return `
    <div class="activity-item" 
         data-index="${index}"
         draggable="true"
         style="display: flex; align-items: center; gap: 0.5rem;
                padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 0.5rem;
                transition: transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;">
      <span class="drag-handle" style="color: var(--text-muted); cursor: grab; font-size: 1rem; touch-action: none;">☰</span>
      <span style="font-size: 1.2rem;">${icon}</span>
      <span style="flex: 1;">${name}</span>
      <button onclick="editActivity(${index}, '${icon}', '${name.replace(/'/g, "\\'")}')" 
              style="background: none; border: none; color: var(--accent-primary); cursor: pointer; font-size: 0.9rem;">
        ✏️
      </button>
      <button class="btn btn--danger btn--small" 
              onclick="removeActivity('${activity.replace(/'/g, "\\'")}')"
              style="width: auto; padding: 0.25rem 0.5rem;">
        ✕
      </button>
    </div>
  `;
    }).join('');

    // Setup drag and drop with animation
    setupDragAndDrop();
}

// Setup add activity form
function setupActivityForm() {
    const form = document.getElementById('addActivityForm');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const iconInput = document.getElementById('newActivityIcon');
        const nameInput = document.getElementById('newActivity');
        const icon = iconInput.value.trim() || '💪';
        const name = nameInput.value.trim();

        if (!name) return;

        // Format: "icon:name" or just "name" for backward compatibility
        const activity = `${icon}:${name}`;

        // Check duplicate by name
        if (currentSettings.activities.some(a => a.split(':').pop() === name)) {
            Utils.showToast('กิจกรรมนี้มีอยู่แล้ว', 'error');
            return;
        }

        try {
            currentSettings.activities.push(activity);
            await DB.updateSettings(currentSettings);

            Utils.showToast(`เพิ่มกิจกรรม "${name}" สำเร็จ`, 'success');
            iconInput.value = '';
            nameInput.value = '';
            renderActivities();

        } catch (error) {
            console.error('Error adding activity:', error);
            Utils.showToast('เกิดข้อผิดพลาด', 'error');
        }
    });
}

// Remove activity
async function removeActivity(activity) {
    if (!confirm(`ลบกิจกรรม "${activity}" หรือไม่?`)) return;

    try {
        currentSettings.activities = currentSettings.activities.filter(a => a !== activity);
        await DB.updateSettings(currentSettings);

        Utils.showToast(`ลบกิจกรรม "${activity}" สำเร็จ`, 'success');
        renderActivities();

    } catch (error) {
        console.error('Error removing activity:', error);
        Utils.showToast('เกิดข้อผิดพลาด', 'error');
    }
}

// Move activity up or down
async function moveActivity(index, direction) {
    const activities = [...currentSettings.activities];
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= activities.length) return;

    // Swap
    [activities[index], activities[newIndex]] = [activities[newIndex], activities[index]];

    try {
        currentSettings.activities = activities;
        await DB.updateSettings(currentSettings);
        renderActivities();
    } catch (error) {
        console.error('Error moving activity:', error);
        Utils.showToast('เกิดข้อผิดพลาด', 'error');
    }
}

// Edit activity - open modal
function editActivity(index, oldIcon, oldName) {
    document.getElementById('editActivityIndex').value = index;
    document.getElementById('editActivityIcon').value = oldIcon;
    document.getElementById('editActivityName').value = oldName;
    document.getElementById('editActivityModal').classList.add('modal--active');
}

function closeEditActivityModal() {
    document.getElementById('editActivityModal').classList.remove('modal--active');
}

// Save edited activity
document.getElementById('editActivityForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const index = parseInt(document.getElementById('editActivityIndex').value);
    const icon = document.getElementById('editActivityIcon').value;
    const name = document.getElementById('editActivityName').value.trim();

    if (!name) {
        Utils.showToast('กรุณากรอกชื่อกิจกรรม', 'error');
        return;
    }

    try {
        currentSettings.activities[index] = `${icon}:${name}`;
        await DB.updateSettings(currentSettings);

        Utils.showToast('แก้ไขสำเร็จ', 'success');
        closeEditActivityModal();
        renderActivities();
    } catch (error) {
        console.error('Error editing activity:', error);
        Utils.showToast('เกิดข้อผิดพลาด', 'error');
    }
});

// Setup drag and drop for activities
let draggedItem = null;
let draggedIndex = null;

function setupDragAndDrop() {
    const items = document.querySelectorAll('.activity-item');
    const list = document.getElementById('activitiesList');

    items.forEach(item => {
        // Drag start
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            draggedIndex = parseInt(item.dataset.index);

            // Visual feedback
            setTimeout(() => {
                item.style.opacity = '0.4';
                item.style.transform = 'scale(0.98)';
            }, 0);

            e.dataTransfer.effectAllowed = 'move';
        });

        // Drag end
        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
            item.style.transform = 'scale(1)';
            draggedItem = null;
            draggedIndex = null;

            // Remove all indicators
            document.querySelectorAll('.activity-item').forEach(i => {
                i.style.borderTop = '';
                i.style.borderBottom = '';
                i.style.background = 'var(--bg-secondary)';
            });
        });

        // Drag over
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (draggedItem === item) return;

            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            // Clear all indicators first
            document.querySelectorAll('.activity-item').forEach(i => {
                if (i !== item) {
                    i.style.borderTop = '';
                    i.style.borderBottom = '';
                }
            });

            // Show insertion point
            if (e.clientY < midY) {
                item.style.borderTop = '3px solid var(--accent-primary)';
                item.style.borderBottom = '';
            } else {
                item.style.borderTop = '';
                item.style.borderBottom = '3px solid var(--accent-primary)';
            }
        });

        // Drag leave
        item.addEventListener('dragleave', (e) => {
            // Only clear if actually leaving the element
            if (!item.contains(e.relatedTarget)) {
                item.style.borderTop = '';
                item.style.borderBottom = '';
            }
        });

        // Drop
        item.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (draggedItem === item) return;

            const fromIndex = parseInt(draggedItem.dataset.index);
            const toIndex = parseInt(item.dataset.index);

            // Add drop animation
            item.style.background = 'rgba(233, 69, 96, 0.2)';
            setTimeout(() => {
                item.style.background = 'var(--bg-secondary)';
            }, 300);

            // Reorder activities array
            const activities = [...currentSettings.activities];
            const [removed] = activities.splice(fromIndex, 1);

            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            let insertIndex = e.clientY < midY ? toIndex : toIndex + 1;

            if (fromIndex < toIndex) insertIndex--;
            activities.splice(insertIndex, 0, removed);

            // Save and re-render with animation
            currentSettings.activities = activities;
            await DB.updateSettings(currentSettings);
            Utils.showToast('✓ เรียงลำดับสำเร็จ', 'success');
            renderActivities();
        });
    });

    // Also handle drop on list container
    list.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
}

// ==================== EDIT STREAK MODAL ====================

// Open edit streak modal
function openEditStreakModal(userId, userName, currentStreak, longestStreak, lastExerciseDate) {
    editStreakUserId = userId;
    document.getElementById('editStreakUserName').textContent = `👤 ${userName}`;
    document.getElementById('editCurrentStreak').value = currentStreak;
    document.getElementById('editLongestStreak').value = longestStreak;
    document.getElementById('editLastExerciseDate').value = lastExerciseDate || '';
    document.getElementById('editStreakModal').classList.add('modal--active');
}

// Close edit streak modal
function closeEditStreakModal() {
    document.getElementById('editStreakModal').classList.remove('modal--active');
    editStreakUserId = null;
}

// Setup edit streak form
document.getElementById('editStreakForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!editStreakUserId) return;

    const currentStreak = parseInt(document.getElementById('editCurrentStreak').value) || 0;
    const longestStreak = parseInt(document.getElementById('editLongestStreak').value) || 0;
    const lastExerciseDate = document.getElementById('editLastExerciseDate').value || null;

    try {
        await DB.updateUserStreak(editStreakUserId, currentStreak, Math.max(currentStreak, longestStreak), lastExerciseDate);
        Utils.showToast('บันทึก Streak สำเร็จ!', 'success');
        closeEditStreakModal();
        await loadUsers();
    } catch (error) {
        console.error('Error updating streak:', error);
        Utils.showToast('เกิดข้อผิดพลาด', 'error');
    }
});

// ==================== EDIT PROFILE MODAL ====================

let editProfileUserId = null;
let newProfileImage = null;

function openEditProfileModal(userId, name, profileImage) {
    editProfileUserId = userId;
    newProfileImage = null;

    document.getElementById('editProfileUserId').value = userId;
    document.getElementById('editProfileName').value = name;

    const preview = document.getElementById('profilePreview');
    if (profileImage && profileImage !== 'null' && profileImage !== '') {
        preview.src = profileImage;
        preview.style.display = 'block';
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }

    document.getElementById('editProfileModal').classList.add('modal--active');
}

function closeEditProfileModal() {
    document.getElementById('editProfileModal').classList.remove('modal--active');
    editProfileUserId = null;
    newProfileImage = null;
}

// Profile image selection
document.getElementById('profileImageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        // Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('profilePreview');
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);

        // Compress and store
        const compressed = await Utils.compressImage(file);
        newProfileImage = await DB.uploadImage(compressed);
    }
});

// Save profile
document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('editProfileName').value.trim();
    if (!name) {
        Utils.showToast('กรุณากรอกชื่อ', 'error');
        return;
    }

    try {
        const updates = { name };
        if (newProfileImage) {
            updates.profileImage = newProfileImage;
        }

        await DB.updateUserProfile(editProfileUserId, updates);
        Utils.showToast('บันทึกโปรไฟล์สำเร็จ!', 'success');
        closeEditProfileModal();
        await loadUsers();
    } catch (error) {
        console.error('Error updating profile:', error);
        Utils.showToast('เกิดข้อผิดพลาด', 'error');
    }
});

// Close modal on click outside
document.addEventListener('click', (e) => {
    const deleteModal = document.getElementById('deleteModal');
    const editStreakModal = document.getElementById('editStreakModal');
    const editProfileModal = document.getElementById('editProfileModal');

    if (e.target === deleteModal) {
        closeDeleteModal();
    }
    if (e.target === editStreakModal) {
        closeEditStreakModal();
    }
    if (e.target === editProfileModal) {
        closeEditProfileModal();
    }
});
