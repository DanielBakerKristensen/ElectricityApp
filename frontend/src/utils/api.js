/**
 * Utility to handle authenticated API requests
 */

const getAdminToken = () => localStorage.getItem('admin_token');

export const setAdminToken = (token) => {
    if (token) localStorage.setItem('admin_token', token);
    else localStorage.removeItem('admin_token');
};

export const authFetch = async (url, options = {}) => {
    const token = getAdminToken();
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401 || response.status === 403) {
        // Optional: clear token or notify user
        console.warn('Authentication failed');
    }

    return response;
};
