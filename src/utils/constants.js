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

export const THEME_KEY_PREFIX = 'flashcardFlowTheme_v1_';
export const TIME_STATS_KEY = 'flashcardFlow_TimeStats_v1';

export const getStorageKey = (u) => `flashcardFlowData_v13_${u ? u.uid : 'guest'}`;
export const getThemeKey = (u) => `${THEME_KEY_PREFIX}${u ? u.uid : 'guest'}`;

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
        try { return localStorage.getItem(key); } catch (e) { console.warn("Storage bloqueado"); return null; }
    },
    setItem: (key, value) => {
        try { localStorage.setItem(key, value); } catch (e) { console.warn("Storage bloqueado"); }
    },
    removeItem: (key) => {
        try { localStorage.removeItem(key); } catch (e) { console.warn("Storage bloqueado"); }
    },
    clear: () => {
        try { localStorage.clear(); } catch (e) { console.warn("Storage bloqueado"); }
    }
};