export const APP_VERSION = "2.3.0"; 

export const FIREBASE_CONFIG_FIXED = { 
    apiKey: "AIzaSyApOjZZ75TyDD126CyN4kF7dVeoMvAo5dk", 
    authDomain: "estudos-ec4c5.firebaseapp.com", 
    projectId: "estudos-ec4c5", 
    storageBucket: "estudos-ec4c5.firebasestorage.app", 
    messagingSenderId: "152433763794", 
    appId: "1:152433763794:web:31b8b3fc2f2ee7ae4ed40b", 
    measurementId: "G-YVK8REQRF8" 
};

export const DEFAULT_THEME = { 
    frontBg: '#ffffff', 
    frontText: '#1f2937', 
    backBg: '#0f172a', 
    backText: '#e2e8f0', 
    progressColor: '#3b82f6', 
    headerBg: '#ffffff' 
};

export const GOOGLE_DRIVE_API_KEY = "AIzaSyA7KSKkCsGcyu7M_6O57lKVMvpUQ53GKJc";

export const THEME_KEY_PREFIX = 'flashcardFlowTheme_v1_';
export const TIME_STATS_KEY = 'flashcardFlow_TimeStats_v1';

export const getStorageKey = (u) => `flashcardFlowData_v13_${u ? u.uid : 'guest'}`;
export const getThemeKey = (u) => `${THEME_KEY_PREFIX}${u ? u.uid : 'guest'}`;

// --- PERFIS LOCAIS (sem senha) ---
export const PROFILES_KEY = 'flashcardFlow_profiles_v1';
export const ACTIVE_PROFILE_KEY = 'flashcardFlow_activeProfile_v1';
export const MAX_LOCAL_PROFILES = 3;

// Retorna o "namespace" usado para isolar dados no IndexedDB/localStorage.
// Se houver um perfil local ativo, usa o id do perfil; senão usa o usuário da nuvem
// ou 'guest' (comportamento anterior).
export const getNamespace = (user, isGuest, activeProfileId) => {
    if (activeProfileId) return `profile_${activeProfileId}`;
    if (user && !isGuest) return `user_${user.uid}`;
    return 'guest';
};

// Gera a chave de storage considerando o perfil local ativo
export const getStorageKeyForProfile = (user, isGuest, activeProfileId) =>
    `flashcardFlowData_v13_${getNamespace(user, isGuest, activeProfileId)}`;
export const getThemeKeyForProfile = (user, isGuest, activeProfileId) =>
    `${THEME_KEY_PREFIX}${getNamespace(user, isGuest, activeProfileId)}`;

export const DEFAULT_EDITAL_JSON = JSON.stringify({
  "id": "edital_exemplo",
  "disciplinas": [
    {
      "id": "exemplo_disciplina",
      "titulo": "Exemplo de Disciplina",
      "itens": [
        {
          "path": "1",
          "titulo": "Tópico de Exemplo",
          "aula": "Aula 01",
          "descricao": "Descrição do tópico."
        }
      ]
    }
  ]
}, null, 2);

// Adicione isso no final do arquivo src/utils/constants.js

export const safeLocalStorage = {
    getItem: (key) => {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    setItem: (key, value) => {
        try { localStorage.setItem(key, value); } catch { /* bloqueado */ }
    },
    removeItem: (key) => {
        try { localStorage.removeItem(key); } catch { /* bloqueado */ }
    },
    clear: () => {
        try { localStorage.clear(); } catch { /* bloqueado */ }
    }
};