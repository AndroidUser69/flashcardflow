const DB_NAME = 'FlashcardFlowFiles';
const DB_VERSION = 1; 
const STORE_NAME = 'files';

export const dbHelper = {
    open: () => new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (event) => { const db = event.target.result; if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME); };
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => {
                if (event.target.error && event.target.error.name === 'VersionError') {
                    const delReq = indexedDB.deleteDatabase(DB_NAME);
                    delReq.onsuccess = () => resolve(dbHelper.open());
                    delReq.onerror = () => reject(new Error("Falha DB Reset"));
                } else reject(event.target.error);
            };
        } catch(e) { reject(e); }
    }),
    saveFile: async (id, blob) => { try { const db = await dbHelper.open(); return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, 'readwrite'); const store = tx.objectStore(STORE_NAME); store.put(blob, id).onsuccess = resolve; }); } catch(e) { console.warn("IDB Fail", e); } },
    getFile: async (id) => { try { const db = await dbHelper.open(); return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, 'readonly'); const store = tx.objectStore(STORE_NAME); const req = store.get(id); req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null); }); } catch(e) { return null; } },
    deleteFile: async (id) => { try { const db = await dbHelper.open(); const tx = db.transaction(STORE_NAME, 'readwrite'); tx.objectStore(STORE_NAME).delete(id); } catch(e) {} }
};