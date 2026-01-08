// Utility Functions
// =====================================================

const Utils = {
    // Show toast notification
    showToast(message, type = 'success') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}</span>
      <span>${message}</span>
    `;

        container.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Format date to Thai locale
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    // Format date to relative time
    formatRelativeDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'วันนี้';
        if (diffDays === 1) return 'เมื่อวาน';
        if (diffDays < 7) return `${diffDays} วันก่อน`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} สัปดาห์ก่อน`;
        return this.formatDate(dateStr);
    },

    // Get emoji for activity
    getActivityEmoji(activity) {
        const emojis = {
            'วิ่ง': '🏃',
            'ว่ายน้ำ': '🏊',
            'ปั่นจักรยาน': '🚴',
            'เดิน': '🚶',
            'ยกน้ำหนัก': '🏋️',
            'โยคะ': '🧘',
            'อื่นๆ': '💪'
        };
        return emojis[activity] || '💪';
    },

    // Get current user from localStorage
    getCurrentUser() {
        const userId = localStorage.getItem('currentUserId');
        const userName = localStorage.getItem('currentUserName');
        const profileImage = localStorage.getItem('currentUserImage');
        if (userId && userName) {
            return { id: userId, name: userName, profileImage: profileImage || null };
        }
        return null;
    },

    // Set current user to localStorage
    setCurrentUser(userId, userName, profileImage = null) {
        localStorage.setItem('currentUserId', userId);
        localStorage.setItem('currentUserName', userName);
        if (profileImage && profileImage !== 'null' && profileImage !== '') {
            localStorage.setItem('currentUserImage', profileImage);
        } else {
            localStorage.removeItem('currentUserImage');
        }
    },

    // Clear current user
    clearCurrentUser() {
        localStorage.removeItem('currentUserId');
        localStorage.removeItem('currentUserName');
        localStorage.removeItem('currentUserImage');
    },

    // Check if user is logged in
    isLoggedIn() {
        return !!localStorage.getItem('currentUserId');
    },

    // Redirect if not logged in
    requireLogin() {
        if (!this.isLoggedIn()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    },

    // Show loading spinner
    showLoading(container) {
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        if (container) {
            container.innerHTML = '<div class="spinner"></div>';
        }
    },

    // Hide element
    hide(element) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        if (element) {
            element.classList.add('hidden');
        }
    },

    // Show element
    show(element) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        if (element) {
            element.classList.remove('hidden');
        }
    },

    // Generate avatar initial
    getInitial(name) {
        return name ? name.charAt(0).toUpperCase() : '?';
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Compress image before upload
    async compressImage(file, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    }, 'image/jpeg', quality);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
};

// Export
window.Utils = Utils;
