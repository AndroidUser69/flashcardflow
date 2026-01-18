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