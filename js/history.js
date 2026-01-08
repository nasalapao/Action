// History Page Logic
// =====================================================

let usersMap = {};
let currentUserId = null;

// Pagination state
const ITEMS_PER_PAGE = 5;
let exercisePage = 1;
let weightPage = 1;
let allExercises = [];
let allWeightHistory = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Firebase
  if (!window.firebaseApp.init()) {
    return;
  }

  // Get current user
  const currentUser = Utils.getCurrentUser();
  currentUserId = currentUser ? currentUser.id : null;

  // Load data
  await loadUsers();
  await loadExercises();
  await loadWeightHistory();

  // Setup filter
  setupFilter();
});

// Load users for filter and mapping
async function loadUsers() {
  const userFilter = document.getElementById('userFilter');

  try {
    const users = await DB.getUsers();

    // Create mapping
    users.forEach(user => {
      usersMap[user.id] = user.name;
    });

    // Populate filter
    userFilter.innerHTML = '<option value="">ทุกคน</option>' +
      users.map(user => `<option value="${user.id}">${user.name}</option>`).join('');

  } catch (error) {
    console.error('Error loading users:', error);
  }
}

// Load exercises with pagination
async function loadExercises(userId = null, resetPage = true) {
  const exerciseList = document.getElementById('exerciseList');
  const emptyHistory = document.getElementById('emptyHistory');
  const paginationEl = document.getElementById('exercisePagination');

  if (resetPage) {
    exercisePage = 1;
    Utils.showLoading(exerciseList);

    try {
      allExercises = await DB.getExercises(userId);
    } catch (error) {
      console.error('Error loading exercises:', error);
      exerciseList.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__text">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
        </div>
      `;
      return;
    }
  }

  if (allExercises.length === 0) {
    exerciseList.innerHTML = '';
    Utils.show(emptyHistory);
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }

  Utils.hide(emptyHistory);

  // Calculate pagination
  const totalPages = Math.ceil(allExercises.length / ITEMS_PER_PAGE);
  const startIndex = (exercisePage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pageExercises = allExercises.slice(startIndex, endIndex);

  // Render exercises
  exerciseList.innerHTML = pageExercises.map(exercise => {
    const userName = usersMap[exercise.userId] || 'ไม่ทราบ';
    const hasImage = exercise.imageUrl ? true : false;
    const isOwnExercise = exercise.userId === currentUserId;

    return `
      <div class="exercise-item" style="position: relative;">
        ${hasImage ? `
          <img src="${exercise.imageUrl}" 
               alt="${exercise.activity}" 
               class="exercise-item__image"
               onclick="showImage('${exercise.imageUrl}')"
               style="cursor: pointer;">
        ` : `
          <div class="exercise-item__image" style="display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
            ${Utils.getActivityEmoji(exercise.activity)}
          </div>
        `}
        <div class="exercise-item__content">
          <div class="exercise-item__activity">
            ${Utils.getActivityEmoji(exercise.activity)} ${exercise.activity}
          </div>
          <div class="exercise-item__meta">
            ${exercise.distance ? `<span>📍 ${exercise.distance} km</span>` : ''}
            <span>⏱️ ${exercise.duration} นาที</span>
            ${exercise.calories ? `<span>🔥 ${exercise.calories} kcal</span>` : ''}
          </div>
          <div class="exercise-item__date">
            👤 ${userName} • ${Utils.formatRelativeDate(exercise.date)}
          </div>
        </div>
        ${isOwnExercise ? `
          <button onclick="deleteExercise('${exercise.id}', '${exercise.userId}')" 
                  class="btn btn--danger btn--small"
                  style="position: absolute; top: 0.5rem; right: 0.5rem; width: auto; padding: 0.25rem 0.5rem; font-size: 0.75rem;"
                  title="ลบรายการนี้">
            🗑️
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  // Render pagination
  if (paginationEl && totalPages > 1) {
    paginationEl.innerHTML = renderPagination(exercisePage, totalPages, 'goToExercisePage');
  } else if (paginationEl) {
    paginationEl.innerHTML = '';
  }
}

// Delete exercise
async function deleteExercise(exerciseId, userId) {
  if (!confirm('ต้องการลบรายการนี้หรือไม่?')) return;

  try {
    await DB.deleteExercise(exerciseId, userId);
    Utils.showToast('ลบรายการสำเร็จ', 'success');

    // Reload exercises
    const userFilter = document.getElementById('userFilter');
    const filterUserId = userFilter.value || null;
    await loadExercises(filterUserId);
  } catch (error) {
    console.error('Error deleting exercise:', error);
    Utils.showToast('เกิดข้อผิดพลาด', 'error');
  }
}

// Setup filter
function setupFilter() {
  const userFilter = document.getElementById('userFilter');

  userFilter.addEventListener('change', (e) => {
    const userId = e.target.value || null;
    loadExercises(userId);
    loadWeightHistory(userId);
  });
}

// Show image in modal
function showImage(imageUrl) {
  const modal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');

  modalImage.src = imageUrl;
  modal.classList.add('modal--active');
}

// Close image modal
function closeImageModal() {
  const modal = document.getElementById('imageModal');
  modal.classList.remove('modal--active');
}

// Close modal on click outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('imageModal');
  if (e.target === modal) {
    closeImageModal();
  }
});

// ==================== WEIGHT HISTORY ====================

// Load weight history with pagination
async function loadWeightHistory(userId = null, resetPage = true) {
  const weightList = document.getElementById('weightList');
  const emptyWeightHistory = document.getElementById('emptyWeightHistory');
  const paginationEl = document.getElementById('weightPagination');

  if (!weightList) return;

  if (resetPage) {
    weightPage = 1;
    Utils.showLoading(weightList);

    try {
      allWeightHistory = [];

      if (userId) {
        // Get weights for specific user
        const weights = await DB.getWeights(userId, 100);
        allWeightHistory = weights.map(w => ({
          ...w,
          userName: usersMap[w.userId] || 'ไม่ทราบ'
        }));
      } else {
        // Get weights for all users
        const allUsersData = await DB.getAllUsersWeights(100);
        allUsersData.forEach(userData => {
          userData.weights.forEach(w => {
            allWeightHistory.push({
              ...w,
              userName: userData.userName
            });
          });
        });
        // Sort by createdAt/date descending
        allWeightHistory.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(a.date);
          const bTime = b.createdAt?.toDate?.() || new Date(b.date);
          return bTime - aTime;
        });
      }
    } catch (error) {
      console.error('Error loading weight history:', error);
      weightList.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__text">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
        </div>
      `;
      return;
    }
  }

  if (allWeightHistory.length === 0) {
    weightList.innerHTML = '';
    Utils.show(emptyWeightHistory);
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }

  Utils.hide(emptyWeightHistory);

  // Calculate pagination
  const totalPages = Math.ceil(allWeightHistory.length / ITEMS_PER_PAGE);
  const startIndex = (weightPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pageWeights = allWeightHistory.slice(startIndex, endIndex);

  // Render weights
  weightList.innerHTML = pageWeights.map(weight => {
    const hasImage = weight.imageUrl ? true : false;
    const isOwnWeight = weight.userId === currentUserId;

    return `
      <div class="exercise-item" style="position: relative;">
        ${hasImage ? `
          <img src="${weight.imageUrl}" 
               alt="Weight ${weight.weight} kg" 
               class="exercise-item__image"
               onclick="showImage('${weight.imageUrl}')"
               style="cursor: pointer;">
        ` : `
          <div class="exercise-item__image" style="display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
            ⚖️
          </div>
        `}
        <div class="exercise-item__content">
          <div class="exercise-item__activity">
            ⚖️ ${weight.weight.toFixed(1)} kg
          </div>
          <div class="exercise-item__date">
            👤 ${weight.userName} • ${Utils.formatRelativeDate(weight.date)}
          </div>
        </div>
        ${isOwnWeight ? `
          <button onclick="deleteWeightRecord('${weight.id}')" 
                  class="btn btn--danger btn--small"
                  style="position: absolute; top: 0.5rem; right: 0.5rem; width: auto; padding: 0.25rem 0.5rem; font-size: 0.75rem;"
                  title="ลบรายการนี้">
            🗑️
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  // Render pagination
  if (paginationEl && totalPages > 1) {
    paginationEl.innerHTML = renderPagination(weightPage, totalPages, 'goToWeightPage');
  } else if (paginationEl) {
    paginationEl.innerHTML = '';
  }
}

// Delete weight record
async function deleteWeightRecord(weightId) {
  if (!confirm('ต้องการลบรายการน้ำหนักนี้หรือไม่?')) return;

  try {
    await DB.deleteWeight(weightId);
    Utils.showToast('ลบรายการสำเร็จ', 'success');

    // Reload weight history
    const userFilter = document.getElementById('userFilter');
    const filterUserId = userFilter.value || null;
    await loadWeightHistory(filterUserId);
  } catch (error) {
    console.error('Error deleting weight:', error);
    Utils.showToast('เกิดข้อผิดพลาด', 'error');
  }
}

// ==================== PAGINATION HELPERS ====================

// Render pagination buttons
function renderPagination(currentPage, totalPages, functionName) {
  let html = '';

  // Previous button
  html += `<button class="pagination__btn" onclick="${functionName}(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;

  // Page numbers
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="pagination__btn ${i === currentPage ? 'pagination__btn--active' : ''}" onclick="${functionName}(${i})">${i}</button>`;
  }

  // Next button
  html += `<button class="pagination__btn" onclick="${functionName}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;

  return html;
}

// Go to exercise page
function goToExercisePage(page) {
  exercisePage = page;
  loadExercises(null, false);
}

// Go to weight page
function goToWeightPage(page) {
  weightPage = page;
  loadWeightHistory(null, false);
}
