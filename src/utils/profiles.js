// src/utils/profiles.js
import { safeLocalStorage, PROFILES_KEY, ACTIVE_PROFILE_KEY, MAX_LOCAL_PROFILES } from './constants';

// Gerencia perfis locais (sem senha) armazenados no localStorage.
// Até MAX_LOCAL_PROFILES perfis. Cada perfil isola seus dados no IndexedDB
// através de um namespace derivado do seu id.
export const profilesHelper = {
    getProfiles: () => {
        try {
            const raw = safeLocalStorage.getItem(PROFILES_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            console.warn("Erro ao ler perfis:", e);
            return [];
        }
    },

    saveProfiles: (list) => {
        try {
            safeLocalStorage.setItem(PROFILES_KEY, JSON.stringify(list));
        } catch (e) {
            console.warn("Erro ao salvar perfis:", e);
        }
    },

    addProfile: (name) => {
        const trimmed = (name || '').trim();
        if (!trimmed) return null;
        const list = profilesHelper.getProfiles();
        if (list.length >= MAX_LOCAL_PROFILES) return null;
        if (list.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return null;
        const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const profile = { id, name: trimmed };
        list.push(profile);
        profilesHelper.saveProfiles(list);
        return profile;
    },

    deleteProfile: (id) => {
        const list = profilesHelper.getProfiles().filter(p => p.id !== id);
        profilesHelper.saveProfiles(list);
        if (safeLocalStorage.getItem(ACTIVE_PROFILE_KEY) === id) {
            safeLocalStorage.removeItem(ACTIVE_PROFILE_KEY);
        }
    },

    getActiveProfileId: () => {
        try { return safeLocalStorage.getItem(ACTIVE_PROFILE_KEY); } catch { return null; }
    },

    setActiveProfileId: (id) => {
        try { safeLocalStorage.setItem(ACTIVE_PROFILE_KEY, id); } catch (e) { console.warn(e); }
    },

    clearActiveProfile: () => {
        try { safeLocalStorage.removeItem(ACTIVE_PROFILE_KEY); } catch (e) { console.warn(e); }
    }
};