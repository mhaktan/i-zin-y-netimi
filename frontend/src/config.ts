// ---------------------------------------------------------------------------
// Project Configuration
// All API and project settings are managed from this single file.
// Environment variables (VITE_*) override defaults — edit .env to configure.
// ---------------------------------------------------------------------------

export const APP_CONFIG = {
  name: 'i̇zin-yönetimi',
  version: '1.0',
} as const;

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

export const TOKEN_ENDPOINT = import.meta.env.VITE_TOKEN_ENDPOINT || '/api/TokenAuth/Authenticate';

export const LOGIN_FIELD = import.meta.env.VITE_LOGIN_FIELD || 'userNameOrEmailAddress';

export const TOKEN_RESPONSE_PATH = import.meta.env.VITE_TOKEN_RESPONSE_PATH || 'result.result.accessToken';

export const CUSTOM_HEADERS: Record<string, string> = {};
