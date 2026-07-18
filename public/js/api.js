const BASE_URL = '';

const getHeaders = (isMultipart = false) => {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.message || 'Something went wrong';
    throw new Error(errorMsg);
  }
  return data;
};

const API = {
  // Auth API
  async login(email, password) {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password })
    });
    return handleResponse(response);
  },

  async getMe() {
    const response = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async updateProfile(name, department) {
    const response = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name, department })
    });
    return handleResponse(response);
  },

  async updatePassword(currentPassword, newPassword) {
    const response = await fetch(`${BASE_URL}/api/auth/password`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword })
    });
    return handleResponse(response);
  },

  async uploadAvatar(formData) {
    const response = await fetch(`${BASE_URL}/api/auth/avatar`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData
    });
    return handleResponse(response);
  },

  // Admin / Supervisor API
  async getDashboardStats() {
    const response = await fetch(`${BASE_URL}/api/admin/dashboard-stats`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async getAdmins() {
    const response = await fetch(`${BASE_URL}/api/admin/admins`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async getEmployees() {
    const response = await fetch(`${BASE_URL}/api/admin/employees`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async createAdmin(adminData) {
    const response = await fetch(`${BASE_URL}/api/admin/create-admin`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(adminData)
    });
    return handleResponse(response);
  },

  async createEmployee(employeeData) {
    const response = await fetch(`${BASE_URL}/api/admin/create-employee`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(employeeData)
    });
    return handleResponse(response);
  },

  async assignEmployee(employeeId, adminId) {
    const response = await fetch(`${BASE_URL}/api/admin/assign-employee`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ employeeId, adminId })
    });
    return handleResponse(response);
  },

  async deleteUser(id) {
    const response = await fetch(`${BASE_URL}/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async bulkDeleteUsers(userIds) {
    const response = await fetch(`${BASE_URL}/api/admin/users/bulk-delete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userIds })
    });
    return handleResponse(response);
  },

  // Tasks API
  async getTasks(filters = {}) {
    const qs = new URLSearchParams(filters).toString();
    const response = await fetch(`${BASE_URL}/api/tasks?${qs}`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async getTask(id) {
    const response = await fetch(`${BASE_URL}/api/tasks/${id}`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async createTask(formData) {
    const response = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData
    });
    return handleResponse(response);
  },

  async updateTask(id, formData) {
    const response = await fetch(`${BASE_URL}/api/tasks/${id}`, {
      method: 'PUT',
      headers: getHeaders(true),
      body: formData
    });
    return handleResponse(response);
  },

  async deleteTask(id) {
    const response = await fetch(`${BASE_URL}/api/tasks/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async bulkDeleteTasks(taskIds) {
    const response = await fetch(`${BASE_URL}/api/tasks/bulk-delete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ taskIds })
    });
    return handleResponse(response);
  },

  async addComment(id, comment) {
    const response = await fetch(`${BASE_URL}/api/tasks/${id}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ comment })
    });
    return handleResponse(response);
  },

  // Attendance API
  async checkIn(data = {}) {
    const response = await fetch(`${BASE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  async checkOut() {
    const response = await fetch(`${BASE_URL}/api/attendance/check-out`, {
      method: 'POST',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async getTodayAttendance() {
    const response = await fetch(`${BASE_URL}/api/attendance/today`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async getAttendanceHistory(filters = {}) {
    const qs = new URLSearchParams(filters).toString();
    const response = await fetch(`${BASE_URL}/api/attendance/history?${qs}`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  // Leave API
  async applyLeave(leaveData) {
    const response = await fetch(`${BASE_URL}/api/leaves`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(leaveData)
    });
    return handleResponse(response);
  },

  async getLeaveHistory() {
    const response = await fetch(`${BASE_URL}/api/leaves`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async approveRejectLeave(id, status, actionReason = '') {
    const response = await fetch(`${BASE_URL}/api/leaves/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status, actionReason })
    });
    return handleResponse(response);
  },

  async deleteLeave(id) {
    const response = await fetch(`${BASE_URL}/api/leaves/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async bulkDeleteLeaves(leaveIds) {
    const response = await fetch(`${BASE_URL}/api/leaves/bulk-delete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ leaveIds })
    });
    return handleResponse(response);
  },

  // Notifications API
  async getNotifications() {
    const response = await fetch(`${BASE_URL}/api/notifications`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async markNotificationRead(id) {
    const response = await fetch(`${BASE_URL}/api/notifications/${id}`, {
      method: 'PUT',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async markAllNotificationsRead() {
    const response = await fetch(`${BASE_URL}/api/notifications/mark-all-read`, {
      method: 'PUT',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  // Report Downloads
  async downloadReport(type, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const response = await fetch(`${BASE_URL}/api/reports/${type}?${qs}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error('Could not generate CSV report.');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_report_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // Expenses API
  async getExpenses() {
    const response = await fetch(`${BASE_URL}/api/expenses`, {
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async addExpense(expenseData) {
    const response = await fetch(`${BASE_URL}/api/expenses`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(expenseData)
    });
    return handleResponse(response);
  },

  async deleteExpense(id) {
    const response = await fetch(`${BASE_URL}/api/expenses/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async bulkDeleteExpenses(ids) {
    const response = await fetch(`${BASE_URL}/api/expenses/bulk-delete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ids })
    });
    return handleResponse(response);
  }
};

export default API;
