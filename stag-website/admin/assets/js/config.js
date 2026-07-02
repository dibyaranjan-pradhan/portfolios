/**
 * STAG Admin — API configuration
 *
 * Base URL selection:
 * 1) Optional runtime override: window.STAG_API_BASE
 * 2) Local dev hosts:          http://localhost:8080/stag
 * 3) Deployed host default:    <current-origin>/stag
 */
const API_BASE = (function resolveApiBase() {
	const override = window.STAG_API_BASE && String(window.STAG_API_BASE).trim();
	if (override) return override.replace(/\/$/, '');

	const host = window.location.hostname;
	const isLocalHost = host === 'localhost' || host === '127.0.0.1';

	if (isLocalHost) return 'http://localhost:8080/stag';

	return `${window.location.origin}/stag`;
})();
const LOGIN_ENDPOINT = `${API_BASE}/v1/admin/signin`;
const DASH_ENDPOINT  = `${API_BASE}/v1/admin-dash`;
const TOKEN_KEY      = 'stag_admin_token';
const ADMIN_INFO_KEY = 'stag_admin_info';
