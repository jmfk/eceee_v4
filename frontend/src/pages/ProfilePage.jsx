import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext';
import { changePassword } from '../api/users';
import { Lock, User, Mail, Shield, AlertCircle, CheckCircle } from 'lucide-react';

const ProfilePage = () => {
    const { user } = useAuth();
    const { addNotification } = useGlobalNotifications();

    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({
            ...prev,
            [name]: value,
        }));
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
        setSuccess(false);
    };

    const validateForm = () => {
        const newErrors = {};

        if (!passwordData.oldPassword) {
            newErrors.oldPassword = 'Current password is required';
        }

        if (!passwordData.newPassword) {
            newErrors.newPassword = 'New password is required';
        } else if (passwordData.newPassword.length < 8) {
            newErrors.newPassword = 'Password must be at least 8 characters';
        }

        if (!passwordData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your new password';
        } else if (passwordData.newPassword !== passwordData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        if (passwordData.oldPassword && passwordData.newPassword && 
            passwordData.oldPassword === passwordData.newPassword) {
            newErrors.newPassword = 'New password must be different from current password';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        setErrors({});

        try {
            await changePassword(passwordData);
            
            setSuccess(true);
            addNotification('Password changed successfully', 'success');
            
            // Clear form
            setPasswordData({
                oldPassword: '',
                newPassword: '',
                confirmPassword: '',
            });

            // Hide success message after 5 seconds
            setTimeout(() => setSuccess(false), 5000);
        } catch (error) {
            console.error('Password change error:', error);
            
            if (error.response?.data) {
                // Backend validation errors
                setErrors(error.response.data);
                if (error.response.data.oldPassword) {
                    addNotification(error.response.data.oldPassword, 'error');
                } else if (error.response.data.newPassword) {
                    addNotification(error.response.data.newPassword, 'error');
                } else {
                    addNotification('Failed to change password', 'error');
                }
            } else {
                addNotification('Failed to change password', 'error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
                <p className="text-gray-600 mt-2">Manage your account settings</p>
            </div>

            {/* User Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
                
                <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                        <User className="w-5 h-5 text-gray-400" />
                        <div>
                            <div className="text-sm text-gray-500">Username</div>
                            <div className="font-medium text-gray-900">{user.username}</div>
                        </div>
                    </div>

                    {user.email && (
                        <div className="flex items-center space-x-3">
                            <Mail className="w-5 h-5 text-gray-400" />
                            <div>
                                <div className="text-sm text-gray-500">Email</div>
                                <div className="font-medium text-gray-900">{user.email}</div>
                            </div>
                        </div>
                    )}

                    {(user.firstName || user.lastName) && (
                        <div className="flex items-center space-x-3">
                            <User className="w-5 h-5 text-gray-400" />
                            <div>
                                <div className="text-sm text-gray-500">Name</div>
                                <div className="font-medium text-gray-900">
                                    {user.firstName} {user.lastName}
                                </div>
                            </div>
                        </div>
                    )}

                    {(user.isStaff || user.isSuperuser) && (
                        <div className="flex items-center space-x-3">
                            <Shield className="w-5 h-5 text-blue-500" />
                            <div>
                                <div className="text-sm text-gray-500">Permissions</div>
                                <div className="font-medium text-gray-900">
                                    {user.isSuperuser ? 'Superuser' : 'Staff'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Change Password */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Change Password</h2>

                {success && (
                    <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4 flex items-center space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <p className="text-sm text-green-700">Your password has been changed successfully.</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Current Password */}
                    <div>
                        <label htmlFor="oldPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            Current Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="password"
                                id="oldPassword"
                                name="oldPassword"
                                value={passwordData.oldPassword}
                                onChange={handleInputChange}
                                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.oldPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                }`}
                                disabled={isSubmitting}
                            />
                        </div>
                        {errors.oldPassword && (
                            <div className="mt-1 flex items-center space-x-1 text-red-600 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                <span>{errors.oldPassword}</span>
                            </div>
                        )}
                    </div>

                    {/* New Password */}
                    <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            New Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="password"
                                id="newPassword"
                                name="newPassword"
                                value={passwordData.newPassword}
                                onChange={handleInputChange}
                                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.newPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                }`}
                                disabled={isSubmitting}
                            />
                        </div>
                        {errors.newPassword && (
                            <div className="mt-1 flex items-center space-x-1 text-red-600 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                <span>{errors.newPassword}</span>
                            </div>
                        )}
                        {!errors.newPassword && passwordData.newPassword && (
                            <p className="mt-1 text-xs text-gray-500">
                                Password must be at least 8 characters long
                            </p>
                        )}
                    </div>

                    {/* Confirm New Password */}
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            Confirm New Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={passwordData.confirmPassword}
                                onChange={handleInputChange}
                                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                }`}
                                disabled={isSubmitting}
                            />
                        </div>
                        {errors.confirmPassword && (
                            <div className="mt-1 flex items-center space-x-1 text-red-600 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                <span>{errors.confirmPassword}</span>
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSubmitting ? 'Changing Password...' : 'Change Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfilePage;

