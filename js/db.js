// Database Operations
// =====================================================

const DB = {
    // Collections
    USERS: 'users',
    EXERCISES: 'exercises',
    SETTINGS: 'settings',
    WEIGHTS: 'weights',

    // ==================== USERS ====================

    // Get all users
    async getUsers() {
        try {
            const snapshot = await db.collection(this.USERS)
                .orderBy('currentStreak', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting users:', error);
            return [];
        }
    },

    // Get single user
    async getUser(userId) {
        try {
            const doc = await db.collection(this.USERS).doc(userId).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    },

    // Add new user
    async addUser(name) {
        try {
            const userData = {
                name: name,
                profileImage: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                currentStreak: 0,
                longestStreak: 0,
                lastExerciseDate: null,
                totalExercises: 0
            };

            const docRef = await db.collection(this.USERS).add(userData);
            return { id: docRef.id, ...userData };
        } catch (error) {
            console.error('Error adding user:', error);
            throw error;
        }
    },

    // Update user profile (name and/or image)
    async updateUserProfile(userId, updates) {
        try {
            await db.collection(this.USERS).doc(userId).update(updates);
            return true;
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    },

    // Delete user
    async deleteUser(userId) {
        try {
            // Delete user's exercises first
            const exercises = await db.collection(this.EXERCISES)
                .where('userId', '==', userId)
                .get();

            const batch = db.batch();
            exercises.docs.forEach(doc => batch.delete(doc.ref));
            batch.delete(db.collection(this.USERS).doc(userId));

            await batch.commit();
            return true;
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    },

    // Update user streak
    async updateUserStreak(userId, streak, longestStreak, lastExerciseDate) {
        try {
            await db.collection(this.USERS).doc(userId).update({
                currentStreak: streak,
                longestStreak: longestStreak,
                lastExerciseDate: lastExerciseDate
            });
            return true;
        } catch (error) {
            console.error('Error updating streak:', error);
            throw error;
        }
    },

    // Reset user streak (full reset)
    async resetUserStreak(userId) {
        try {
            // Get user first to check for negative values
            const user = await this.getUser(userId);

            // Count actual exercises for this user
            const exercisesSnapshot = await db.collection(this.EXERCISES)
                .where('userId', '==', userId)
                .get();
            const actualExerciseCount = exercisesSnapshot.size;

            await db.collection(this.USERS).doc(userId).update({
                currentStreak: 0,
                longestStreak: 0,
                lastExerciseDate: null,
                totalExercises: actualExerciseCount // Fix to actual count
            });
            return true;
        } catch (error) {
            console.error('Error resetting streak:', error);
            throw error;
        }
    },

    // ==================== EXERCISES ====================

    // Add exercise
    async addExercise(userId, activity, distance, duration, calories = 0, imageUrl = null) {
        try {
            const today = new Date().toISOString().split('T')[0];

            const exerciseData = {
                userId: userId,
                activity: activity,
                distance: parseFloat(distance) || 0,
                duration: parseInt(duration) || 0,
                calories: parseFloat(calories) || 0,
                imageUrl: imageUrl,
                date: today,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection(this.EXERCISES).add(exerciseData);

            // Update streak
            await this.calculateAndUpdateStreak(userId);

            // Update total exercises count
            await db.collection(this.USERS).doc(userId).update({
                totalExercises: firebase.firestore.FieldValue.increment(1)
            });

            return { id: docRef.id, ...exerciseData };
        } catch (error) {
            console.error('Error adding exercise:', error);
            throw error;
        }
    },

    // Get exercises for a user
    async getExercises(userId = null, limit = 50) {
        try {
            let query = db.collection(this.EXERCISES)
                .orderBy('createdAt', 'desc')
                .limit(limit);

            if (userId) {
                query = db.collection(this.EXERCISES)
                    .where('userId', '==', userId)
                    .orderBy('createdAt', 'desc')
                    .limit(limit);
            }

            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting exercises:', error);
            return [];
        }
    },

    // Get total calories for a user (simple query, no index needed)
    async getTotalCalories(userId) {
        try {
            const snapshot = await db.collection(this.EXERCISES)
                .where('userId', '==', userId)
                .get();

            let total = 0;
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                total += data.calories || 0;
            });
            return total;
        } catch (error) {
            console.error('Error getting total calories:', error);
            return 0;
        }
    },

    // Delete exercise
    async deleteExercise(exerciseId, userId) {
        try {
            await db.collection(this.EXERCISES).doc(exerciseId).delete();

            // Count actual remaining exercises (avoid negative values)
            const remainingExercises = await db.collection(this.EXERCISES)
                .where('userId', '==', userId)
                .get();
            const actualCount = remainingExercises.size;

            // Update total exercises count to actual value
            await db.collection(this.USERS).doc(userId).update({
                totalExercises: actualCount
            });

            // Get user's current streak
            const user = await this.getUser(userId);
            if (user && user.currentStreak > 0) {
                // Decrement streak by 1 (but not below 0)
                const newStreak = Math.max(0, user.currentStreak - 1);

                // Find the latest date from remaining exercises
                let newLastExerciseDate = null;
                if (!remainingExercises.empty) {
                    let latestDate = null;
                    remainingExercises.docs.forEach(doc => {
                        const exerciseDate = doc.data().date;
                        if (!latestDate || exerciseDate > latestDate) {
                            latestDate = exerciseDate;
                        }
                    });
                    newLastExerciseDate = latestDate;
                }

                // Update user's streak and lastExerciseDate
                await db.collection(this.USERS).doc(userId).update({
                    currentStreak: newStreak,
                    lastExerciseDate: newLastExerciseDate
                });
            }

            return true;
        } catch (error) {
            console.error('Error deleting exercise:', error);
            throw error;
        }
    },

    // Check if user exercised today
    async hasExercisedToday(userId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const snapshot = await db.collection(this.EXERCISES)
                .where('userId', '==', userId)
                .where('date', '==', today)
                .limit(1)
                .get();

            return !snapshot.empty;
        } catch (error) {
            console.error('Error checking today exercise:', error);
            return false;
        }
    },

    // ==================== STREAK LOGIC ====================

    // Calculate and update streak for a user
    async calculateAndUpdateStreak(userId) {
        try {
            const user = await this.getUser(userId);
            if (!user) return;

            const settings = await this.getSettings();
            const maxDaysWithout = settings.maxDaysWithoutExercise || 3;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];

            let newStreak = user.currentStreak || 0;
            let longestStreak = user.longestStreak || 0;

            if (user.lastExerciseDate) {
                const lastDate = new Date(user.lastExerciseDate);
                lastDate.setHours(0, 0, 0, 0);

                const diffTime = today.getTime() - lastDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                    // Same day, no change to streak
                    return;
                } else if (diffDays <= maxDaysWithout) {
                    // Within allowed gap, increment streak (add to existing)
                    newStreak = newStreak + 1;
                } else {
                    // Gap too large, but keep existing streak and add 1 (not reset)
                    // User's carried-over streak is preserved, just add new day
                    newStreak = newStreak + 1;
                }
            } else {
                // First exercise after setting initial streak
                // If user has existing streak (from carryover), add 1
                // If no streak, start at 1
                newStreak = newStreak + 1;
            }

            // Update longest streak if needed
            if (newStreak > longestStreak) {
                longestStreak = newStreak;
            }

            await this.updateUserStreak(userId, newStreak, longestStreak, todayStr);

        } catch (error) {
            console.error('Error calculating streak:', error);
        }
    },

    // Check and reset streaks for all users (run daily)
    async checkAndResetAllStreaks() {
        try {
            const settings = await this.getSettings();
            const maxDaysWithout = settings.maxDaysWithoutExercise || 3;

            const users = await this.getUsers();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const user of users) {
                if (user.lastExerciseDate && user.currentStreak > 0) {
                    const lastDate = new Date(user.lastExerciseDate);
                    lastDate.setHours(0, 0, 0, 0);

                    const diffTime = today.getTime() - lastDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays > maxDaysWithout) {
                        await this.resetUserStreak(user.id);
                        console.log(`Reset streak for ${user.name} (${diffDays} days without exercise)`);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking streaks:', error);
        }
    },

    // ==================== SETTINGS ====================

    // Get settings
    async getSettings() {
        try {
            const doc = await db.collection(this.SETTINGS).doc('rules').get();
            if (doc.exists) {
                return doc.data();
            }
            // Return defaults
            return {
                maxDaysWithoutExercise: 3,
                activities: ['วิ่ง', 'ว่ายน้ำ', 'ปั่นจักรยาน', 'เดิน', 'ยกน้ำหนัก', 'โยคะ', 'อื่นๆ']
            };
        } catch (error) {
            console.error('Error getting settings:', error);
            return {
                maxDaysWithoutExercise: 3,
                activities: ['วิ่ง', 'ว่ายน้ำ', 'ปั่นจักรยาน', 'เดิน', 'อื่นๆ']
            };
        }
    },

    // Update settings
    async updateSettings(settings) {
        try {
            await db.collection(this.SETTINGS).doc('rules').set(settings, { merge: true });
            return true;
        } catch (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
    },

    // Initialize default settings
    async initSettings() {
        try {
            const doc = await db.collection(this.SETTINGS).doc('rules').get();
            if (!doc.exists) {
                await db.collection(this.SETTINGS).doc('rules').set({
                    maxDaysWithoutExercise: 3,
                    activities: ['วิ่ง', 'ว่ายน้ำ', 'ปั่นจักรยาน', 'เดิน', 'ยกน้ำหนัก', 'โยคะ', 'อื่นๆ']
                });
                console.log('Default settings initialized');
            }
        } catch (error) {
            console.error('Error initializing settings:', error);
        }
    },

    // ==================== IMAGE UPLOAD ====================

    // Convert image to Base64 (stored in Firestore, no Storage needed)
    async uploadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Return base64 string
                resolve(reader.result);
            };
            reader.onerror = (error) => {
                reject(error);
            };
            reader.readAsDataURL(file);
        });
    },

    // ==================== WEIGHT TRACKING ====================

    // Add weight record
    async addWeight(userId, weight, imageUrl = null, musclePercent = null, fatPercent = null) {
        try {
            const today = new Date().toISOString().split('T')[0];

            const weightData = {
                userId: userId,
                weight: parseFloat(weight),
                musclePercent: musclePercent ? parseFloat(musclePercent) : null,
                fatPercent: fatPercent ? parseFloat(fatPercent) : null,
                imageUrl: imageUrl,
                date: today,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection(this.WEIGHTS).add(weightData);
            return { id: docRef.id, ...weightData };
        } catch (error) {
            console.error('Error adding weight:', error);
            throw error;
        }
    },

    // Get weight history for a user (no orderBy to avoid index requirement)
    async getWeights(userId, limit = 30) {
        try {
            const snapshot = await db.collection(this.WEIGHTS)
                .where('userId', '==', userId)
                .get();

            // Sort by date descending in JavaScript
            const weights = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            weights.sort((a, b) => new Date(b.date) - new Date(a.date));

            return weights.slice(0, limit);
        } catch (error) {
            console.error('Error getting weights:', error);
            return [];
        }
    },

    // Get latest weight for a user (no orderBy to avoid index requirement)
    async getLatestWeight(userId) {
        try {
            const snapshot = await db.collection(this.WEIGHTS)
                .where('userId', '==', userId)
                .get();

            if (!snapshot.empty) {
                // Sort by createdAt descending to get truly latest
                const weights = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Sort by createdAt first (if available), then by date
                weights.sort((a, b) => {
                    // Use createdAt timestamp if available
                    const aTime = a.createdAt?.toDate?.() || new Date(a.date);
                    const bTime = b.createdAt?.toDate?.() || new Date(b.date);
                    return bTime - aTime;
                });

                return weights[0];
            }
            return null;
        } catch (error) {
            console.error('Error getting latest weight:', error);
            return null;
        }
    },

    // Delete weight record
    async deleteWeight(weightId) {
        try {
            await db.collection(this.WEIGHTS).doc(weightId).delete();
            return true;
        } catch (error) {
            console.error('Error deleting weight:', error);
            throw error;
        }
    },

    // Get all weights for all users (for multi-line chart)
    async getAllUsersWeights(limit = 30) {
        try {
            // Get all users first
            const users = await this.getUsers();

            // Get weights for each user
            const allWeightsData = [];

            for (const user of users) {
                const weights = await this.getWeights(user.id, limit);
                if (weights.length > 0) {
                    allWeightsData.push({
                        userId: user.id,
                        userName: user.name,
                        weights: weights
                    });
                }
            }

            return allWeightsData;
        } catch (error) {
            console.error('Error getting all users weights:', error);
            return [];
        }
    }
};

// Export
window.DB = DB;
