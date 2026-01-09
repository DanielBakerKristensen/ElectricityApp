/**
 * Utility to handle authenticated API requests
 */

export const authFetch = async (url, options = {}) => {
    // const token = getAdminToken(); // Legacy - removed
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
    };

    // Note: The browser automatically sends HTTP-only cookies (auth_token) for our session.
    // Explicit Authorization header is no longer needed for normal user actions.

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
