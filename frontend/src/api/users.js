/**
 * User Management API
 */

import client from './client';

/**
 * Get current authenticated user details
 * @returns {Promise} User details including is_staff and is_superuser
 */
export const getCurrentUser = () => {
    return client.get('/api/v1/utils/current-user/');
};

/**
 * Change password for current user
 * @param {Object} data - Password change data
 * @param {string} data.oldPassword - Current password
 * @param {string} data.newPassword - New password
 * @param {string} data.confirmPassword - Password confirmation
 * @returns {Promise} Success message
 */
export const changePassword = (data) => {
    return client.post('/api/v1/utils/change-password/', data);
};

/**
 * Get list of all users (superuser only)
 * @returns {Promise} List of users
 */
export const getUserList = () => {
    return client.get('/api/v1/utils/users/');
};

/**
 * Generate password reset link for a user (superuser only)
 * @param {number} userId - User ID
 * @returns {Promise} Password reset link details
 */
export const generatePasswordReset = (userId) => {
    return client.post(`/api/v1/utils/users/${userId}/reset-password/`);
};

/**
 * Create a new user (superuser only)
 * @param {Object} userData - User data
 * @param {string} userData.username - Username
 * @param {string} userData.email - Email address
 * @param {string} userData.firstName - First name
 * @param {string} userData.lastName - Last name
 * @param {string} userData.password - Password
 * @param {string} userData.confirmPassword - Password confirmation
 * @param {boolean} userData.isStaff - Staff status
 * @param {boolean} userData.isSuperuser - Superuser status
 * @returns {Promise} Created user details
 */
export const createUser = (userData) => {
    return client.post('/api/v1/utils/users/', userData);
};

/**
 * Update a user (superuser only)
 * @param {number} userId - User ID to update
 * @param {Object} userData - User data to update
 * @param {string} userData.email - Email address
 * @param {string} userData.firstName - First name
 * @param {string} userData.lastName - Last name
 * @param {boolean} userData.isStaff - Staff status
 * @param {boolean} userData.isSuperuser - Superuser status
 * @returns {Promise} Updated user details
 */
export const updateUser = (userId, userData) => {
    return client.patch(`/api/v1/utils/users/${userId}/`, userData);
};

/**
 * Delete a user (superuser only)
 * @param {number} userId - User ID to delete
 * @returns {Promise} Success message
 */
export const deleteUser = (userId) => {
    return client.delete(`/api/v1/utils/users/${userId}/`);
};

export default {
    getCurrentUser,
    changePassword,
    getUserList,
    generatePasswordReset,
    createUser,
    updateUser,
    deleteUser,
};

