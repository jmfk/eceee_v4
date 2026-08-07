import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext';
import { getUserList, generatePasswordReset, createUser, updateUser, deleteUser } from '../api/users';
import { Users, Shield, Mail, Calendar, Key, Copy, X, CheckCircle, UserPlus, AlertCircle, Trash2, Edit } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const UserManagementPage = () => {
    // Set document title
    useDocumentTitle('User Management');

    const { user } = useAuth();
    const { addNotification } = useGlobalNotifications();

    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [resetLinkModal, setResetLinkModal] = useState(null);
    const [generatingReset, setGeneratingReset] = useState(null);
    const [copied, setCopied] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createFormData, setCreateFormData] = useState({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        confirmPassword: '',
        isStaff: false,
        isSuperuser: false,
    });
    const [createErrors, setCreateErrors] = useState({});
    const [isCreating, setIsCreating] = useState(false);
    const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState(null);
    const [editErrors, setEditErrors] = useState({});
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const response = await getUserList();
            setUsers(response.data.users || []);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            addNotification('Failed to load users', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateResetLink = async (userId) => {
        setGeneratingReset(userId);
        try {
            const response = await generatePasswordReset(userId);
            setResetLinkModal({
                userId: response.data.userId,
                username: response.data.username,
                resetUrl: response.data.resetUrl,
                expiresIn: response.data.expiresIn,
            });
            addNotification(`Password reset link generated for ${response.data.username}`, 'success');
        } catch (error) {
            console.error('Failed to generate reset link:', error);
            addNotification('Failed to generate password reset link', 'error');
        } finally {
            setGeneratingReset(null);
        }
    };

    const handleCopyLink = () => {
        if (resetLinkModal?.resetUrl) {
            navigator.clipboard.writeText(resetLinkModal.resetUrl);
            setCopied(true);
            addNotification('Reset link copied to clipboard', 'success');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const closeModal = () => {
        setResetLinkModal(null);
        setCopied(false);
    };

    const handleCreateInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setCreateFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
        // Clear error for this field
        if (createErrors[name]) {
            setCreateErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const validateCreateForm = () => {
        const errors = {};

        if (!createFormData.username) {
            errors.username = 'Username is required';
        } else if (createFormData.username.length < 3) {
            errors.username = 'Username must be at least 3 characters';
        }

        if (!createFormData.email) {
            errors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(createFormData.email)) {
            errors.email = 'Invalid email format';
        }

        if (!createFormData.password) {
            errors.password = 'Password is required';
        } else if (createFormData.password.length < 8) {
            errors.password = 'Password must be at least 8 characters';
        }

        if (!createFormData.confirmPassword) {
            errors.confirmPassword = 'Please confirm the password';
        } else if (createFormData.password !== createFormData.confirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
        }

        setCreateErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();

        if (!validateCreateForm()) {
            return;
        }

        setIsCreating(true);
        setCreateErrors({});

        try {
            const response = await createUser(createFormData);
            addNotification(`User ${createFormData.username} created successfully`, 'success');
            
            // Reset form
            setCreateFormData({
                username: '',
                email: '',
                firstName: '',
                lastName: '',
                password: '',
                confirmPassword: '',
                isStaff: false,
                isSuperuser: false,
            });
            setShowCreateModal(false);
            
            // Refresh user list
            fetchUsers();
        } catch (error) {
            console.error('Failed to create user:', error);
            
            if (error.response?.data) {
                setCreateErrors(error.response.data);
                const firstError = Object.values(error.response.data)[0];
                if (Array.isArray(firstError)) {
                    addNotification(firstError[0], 'error');
                } else {
                    addNotification(firstError, 'error');
                }
            } else {
                addNotification('Failed to create user', 'error');
            }
        } finally {
            setIsCreating(false);
        }
    };

    const closeCreateModal = () => {
        setShowCreateModal(false);
        setCreateFormData({
            username: '',
            email: '',
            firstName: '',
            lastName: '',
            password: '',
            confirmPassword: '',
            isStaff: false,
            isSuperuser: false,
        });
        setCreateErrors({});
    };

    const handleDeleteClick = (userToDelete) => {
        setDeleteConfirmModal(userToDelete);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirmModal) return;

        setIsDeleting(true);
        try {
            await deleteUser(deleteConfirmModal.id);
            addNotification(`User ${deleteConfirmModal.username} deleted successfully`, 'success');
            setDeleteConfirmModal(null);
            fetchUsers();
        } catch (error) {
            console.error('Failed to delete user:', error);
            if (error.response?.data?.error) {
                addNotification(error.response.data.error, 'error');
            } else {
                addNotification('Failed to delete user', 'error');
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const closeDeleteModal = () => {
        setDeleteConfirmModal(null);
    };

    const handleEditClick = (userToEdit) => {
        setEditFormData({
            id: userToEdit.id,
            username: userToEdit.username,
            email: userToEdit.email || '',
            firstName: userToEdit.firstName || '',
            lastName: userToEdit.lastName || '',
            isStaff: userToEdit.isStaff,
            isSuperuser: userToEdit.isSuperuser,
        });
        setShowEditModal(true);
    };

    const handleEditInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
        // Clear error for this field
        if (editErrors[name]) {
            setEditErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const validateEditForm = () => {
        const errors = {};

        if (editFormData.email && !/\S+@\S+\.\S+/.test(editFormData.email)) {
            errors.email = 'Invalid email format';
        }

        setEditErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();

        if (!validateEditForm()) {
            return;
        }

        setIsUpdating(true);
        setEditErrors({});

        try {
            const updateData = {
                email: editFormData.email,
                firstName: editFormData.firstName,
                lastName: editFormData.lastName,
                isStaff: editFormData.isStaff,
                isSuperuser: editFormData.isSuperuser,
            };

            await updateUser(editFormData.id, updateData);
            addNotification(`User ${editFormData.username} updated successfully`, 'success');
            
            setShowEditModal(false);
            setEditFormData(null);
            
            // Refresh user list
            fetchUsers();
        } catch (error) {
            console.error('Failed to update user:', error);
            
            if (error.response?.data) {
                setEditErrors(error.response.data);
                const firstError = Object.values(error.response.data)[0];
                if (Array.isArray(firstError)) {
                    addNotification(firstError[0], 'error');
                } else {
                    addNotification(firstError, 'error');
                }
            } else {
                addNotification('Failed to update user', 'error');
            }
        } finally {
            setIsUpdating(false);
        }
    };

    const closeEditModal = () => {
        setShowEditModal(false);
        setEditFormData(null);
        setEditErrors({});
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Check if user is superuser
    if (!user?.isSuperuser) {
        return (
            <div className="max-w-4xl mx-auto py-8 px-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <Shield className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                    <div className="text-xl font-semibold text-gray-900 mb-2" role="heading" aria-level="2">Access Denied</div>
                    <div className="text-gray-600">You need superuser privileges to access this page.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-3xl font-bold text-gray-900 flex items-center space-x-3" role="heading" aria-level="1">
                            <Users className="w-8 h-8" />
                            <span>User Management</span>
                        </div>
                        <div className="text-gray-600 mt-2">Manage user accounts and password resets</div>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <UserPlus className="w-5 h-5" />
                        <span>Add User</span>
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="text-gray-500">Loading users...</div>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Role
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Last Login
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <span className="text-blue-600 font-semibold">
                                                        {u.username.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {u.username}
                                                    </div>
                                                    {(u.firstName || u.lastName) && (
                                                        <div className="text-sm text-gray-500">
                                                            {u.firstName} {u.lastName}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center text-sm text-gray-900">
                                                <Mail className="w-4 h-4 text-gray-400 mr-2" />
                                                {u.email || 'No email'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center space-x-2">
                                                {u.isSuperuser && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                        <Shield className="w-3 h-3 mr-1" />
                                                        Superuser
                                                    </span>
                                                )}
                                                {u.isStaff && !u.isSuperuser && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        Staff
                                                    </span>
                                                )}
                                                {!u.isStaff && !u.isSuperuser && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                        User
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex items-center">
                                                <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                                                {formatDate(u.lastLogin)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => handleEditClick(u)}
                                                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                >
                                                    <Edit className="w-4 h-4 mr-1.5" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleGenerateResetLink(u.id)}
                                                    disabled={generatingReset === u.id}
                                                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Key className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(u)}
                                                    disabled={u.id === user.id}
                                                    className="inline-flex items-center px-3 py-1.5 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title={u.id === user.id ? 'You cannot delete your own account' : 'Delete user'}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {users.length === 0 && (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <div className="text-gray-500">No users found</div>
                        </div>
                    )}
                </div>
            )}

            {/* Reset Link Modal */}
            {resetLinkModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-lg font-semibold text-gray-900 flex items-center" role="heading" aria-level="3">
                                <Key className="w-5 h-5 mr-2 text-blue-600" />
                                Password Reset Link Generated
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    User
                                </label>
                                <div className="text-gray-900 font-medium">{resetLinkModal.username}</div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Reset Link
                                </label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={resetLinkModal.resetUrl}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                                    />
                                    <button
                                        onClick={handleCopyLink}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center space-x-2"
                                    >
                                        {copied ? (
                                            <>
                                                <CheckCircle className="w-4 h-4" />
                                                <span>Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                <span>Copy</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <div className="flex items-start space-x-2">
                                    <Calendar className="w-5 h-5 text-yellow-600 mt-0.5" />
                                    <div className="text-sm text-yellow-800">
                                        <div className="font-medium">This link expires in {resetLinkModal.expiresIn}</div>
                                        <div className="mt-1">Share this link securely with the user. They can use it to reset their password.</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-lg font-semibold text-gray-900 flex items-center" role="heading" aria-level="3">
                                <UserPlus className="w-5 h-5 mr-2 text-blue-600" />
                                Create New User
                            </div>
                            <button
                                onClick={closeCreateModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            {/* Username */}
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                                    Username *
                                </label>
                                <input
                                    type="text"
                                    id="username"
                                    name="username"
                                    value={createFormData.username}
                                    onChange={handleCreateInputChange}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        createErrors.username ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                    }`}
                                    disabled={isCreating}
                                />
                                {createErrors.username && (
                                    <div className="mt-1 flex items-center space-x-1 text-red-600 text-sm">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>{createErrors.username}</span>
                                    </div>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                    Email *
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={createFormData.email}
                                    onChange={handleCreateInputChange}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        createErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                    }`}
                                    disabled={isCreating}
                                />
                                {createErrors.email && (
                                    <div className="mt-1 flex items-center space-x-1 text-red-600 text-sm">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>{createErrors.email}</span>
                                    </div>
                                )}
                            </div>

                            {/* First Name and Last Name */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        id="firstName"
                                        name="firstName"
                                        value={createFormData.firstName}
                                        onChange={handleCreateInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={isCreating}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        id="lastName"
                                        name="lastName"
                                        value={createFormData.lastName}
                                        onChange={handleCreateInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={isCreating}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                    Password *
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    value={createFormData.password}
                                    onChange={handleCreateInputChange}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        createErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                    }`}
                                    disabled={isCreating}
                                />
                                {createErrors.password && (
                                    <div className="mt-1 flex items-center space-x-1 text-red-600 text-sm">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>{createErrors.password}</span>
                                    </div>
                                )}
                                {!createErrors.password && (
                                    <div className="mt-1 text-xs text-gray-500">
                                        Password must be at least 8 characters long
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                    Confirm Password *
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={createFormData.confirmPassword}
                                    onChange={handleCreateInputChange}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        createErrors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                    }`}
                                    disabled={isCreating}
                                />
                                {createErrors.confirmPassword && (
                                    <div className="mt-1 flex items-center space-x-1 text-red-600 text-sm">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>{createErrors.confirmPassword}</span>
                                    </div>
                                )}
                            </div>

                            {/* Permissions */}
                            <div className="border-t border-gray-200 pt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Permissions
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            name="isStaff"
                                            checked={createFormData.isStaff}
                                            onChange={handleCreateInputChange}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            disabled={isCreating}
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Staff (Crew) - Can access admin area</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            name="isSuperuser"
                                            checked={createFormData.isSuperuser}
                                            onChange={handleCreateInputChange}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            disabled={isCreating}
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Superuser status - Full permissions</span>
                                    </label>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={closeCreateModal}
                                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                                    disabled={isCreating}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isCreating ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && editFormData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-lg font-semibold text-gray-900 flex items-center" role="heading" aria-level="3">
                                <Edit className="w-5 h-5 mr-2 text-blue-600" />
                                Edit User: {editFormData.username}
                            </div>
                            <button
                                onClick={closeEditModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            {/* Email */}
                            <div>
                                <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="edit-email"
                                    name="email"
                                    value={editFormData.email}
                                    onChange={handleEditInputChange}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        editErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                    }`}
                                    disabled={isUpdating}
                                />
                                {editErrors.email && (
                                    <div className="mt-1 flex items-center space-x-1 text-red-600 text-sm">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>{editErrors.email}</span>
                                    </div>
                                )}
                            </div>

                            {/* First Name and Last Name */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="edit-firstName" className="block text-sm font-medium text-gray-700 mb-1">
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        id="edit-firstName"
                                        name="firstName"
                                        value={editFormData.firstName}
                                        onChange={handleEditInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={isUpdating}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="edit-lastName" className="block text-sm font-medium text-gray-700 mb-1">
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        id="edit-lastName"
                                        name="lastName"
                                        value={editFormData.lastName}
                                        onChange={handleEditInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={isUpdating}
                                    />
                                </div>
                            </div>

                            {/* Permissions */}
                            <div className="border-t border-gray-200 pt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Permissions
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            name="isStaff"
                                            checked={editFormData.isStaff}
                                            onChange={handleEditInputChange}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            disabled={isUpdating}
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Staff (Crew) - Can access admin area</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            name="isSuperuser"
                                            checked={editFormData.isSuperuser}
                                            onChange={handleEditInputChange}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            disabled={isUpdating}
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Superuser - Full permissions</span>
                                    </label>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={closeEditModal}
                                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                                    disabled={isUpdating}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdating}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isUpdating ? 'Updating...' : 'Update User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-lg font-semibold text-gray-900 flex items-center" role="heading" aria-level="3">
                                <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
                                Confirm Delete User
                            </div>
                            <button
                                onClick={closeDeleteModal}
                                className="text-gray-400 hover:text-gray-600"
                                disabled={isDeleting}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-6">
                            <div className="text-gray-700 mb-4">
                                Are you sure you want to delete the user <span className="font-semibold">{deleteConfirmModal.username}</span>?
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-start space-x-2">
                                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-red-800">
                                        <div className="font-medium">This action cannot be undone.</div>
                                        <div className="mt-1">All data associated with this user will be permanently deleted.</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={closeDeleteModal}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagementPage;

