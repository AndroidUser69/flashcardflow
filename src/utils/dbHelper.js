// src/utils/dbHelper.js

const DB_NAME = 'FlashcardFlowFiles';
const STORE_FILES = 'files';
const STORE_ITEMS = 'items';
const STORE_NOTE_CONTENT = 'note_content';
const STORE_BACKUPS = 'backups';

const getStoreName = (base, namespace) => namespace ? `${base}_${namespace}` : base;

// Descobre a versão atual do banco e retorna >= baseVersion
const getSafeVersion = async (baseVersion) => {
    try {
        const req = indexedDB.open(DB_NAME);
        return new Promise((resolve) => {
            req.onsuccess = (e) => {
                const current = e.target.result.version;
                e.target.result.close();
                resolve(Math.max(baseVersion, current));
            };
            req.onerror = () => resolve(baseVersion);
            req.onupgradeneeded = () => {
                // Se o banco não existe ainda, currentVersion = 0
                resolve(baseVersion);
            };
        });
    } catch {
        return baseVersion;
    }
};

const ensureStores = (db, namespace) => {
    // Cria stores base se não existirem
    const allStores = [
        { name: STORE_FILES, options: undefined },
        { name: STORE_ITEMS, options: { keyPath: 'id' } },
        { name: STORE_NOTE_CONTENT, options: { keyPath: 'id' } },
        { name: STORE_BACKUPS, options: { keyPath: 'id' } }
    ];
    
    // Adiciona stores namespaced se namespace foi informado
    if (namespace) {
        allStores.push(
            { name: getStoreName(STORE_FILES, namespace), options: undefined },
            { name: getStoreName(STORE_ITEMS, namespace), options: { keyPath: 'id' } },
            { name: getStoreName(STORE_NOTE_CONTENT, namespace), options: { keyPath: 'id' } },
            { name: getStoreName(STORE_BACKUPS, namespace), options: { keyPath: 'id' } }
        );
    }
    
    allStores.forEach(s => {
        if (!db.objectStoreNames.contains(s.name)) {
            db.createObjectStore(s.name, s.options);
        }
    });
};

export const dbHelper = {
    open: async (namespace) => {
        const baseVersion = 10000;
        const safeVersion = await getSafeVersion(baseVersion);
        
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open(DB_NAME, safeVersion);

                request.onupgradeneeded = (event) => { 
                    ensureStores(event.target.result, namespace);
                };

                request.onsuccess = (event) => {
                    const db = event.target.result;
                    
                    // Verifica se as stores namespaced existem (podem não ter sido criadas
                    // se namespace mudou desde o último upgrade)
                    if (namespace) {
                        const nsStores = [
                            getStoreName(STORE_FILES, namespace),
                            getStoreName(STORE_ITEMS, namespace),
                            getStoreName(STORE_NOTE_CONTENT, namespace),
                            getStoreName(STORE_BACKUPS, namespace)
                        ];
                        const missing = nsStores.filter(s => !db.objectStoreNames.contains(s));
                        
                        if (missing.length > 0) {
                            // Fecha e reabre com versão +1 para criar as stores faltantes
                            const newVersion = safeVersion + 1;
                            db.close();
                            
                            const upgradeReq = indexedDB.open(DB_NAME, newVersion);
                            upgradeReq.onupgradeneeded = (e) => {
                                ensureStores(e.target.result, namespace);
                            };
                            upgradeReq.onsuccess = (e) => resolve(e.target.result);
                            upgradeReq.onerror = reject;
                            return;
                        }
                    }
                    
                    resolve(db);
                };

                request.onerror = (event) => { 
                    reject(event.target.error); 
                };
            } catch(err) { reject(err); }
        });
    },

    // --- MÉTODOS DE ARQUIVOS (PDFs) --- 
    saveFile: async (id, blob, namespace) => { 
        try { 
            const db = await dbHelper.open(namespace); 
            const storeName = getStoreName(STORE_FILES, namespace);
            return new Promise((resolve) => { 
                const tx = db.transaction(storeName, 'readwrite'); 
                const store = tx.objectStore(storeName); 
                store.put(blob, id).onsuccess = resolve; 
            }); 
        } catch(e) { console.warn("Erro ao salvar arquivo blob", e); } 
    }, 

    getFile: async (id, namespace) => { 
        try { 
            const db = await dbHelper.open(namespace); 
            const storeName = getStoreName(STORE_FILES, namespace);
            return new Promise((resolve) => { 
                const tx = db.transaction(storeName, 'readonly'); 
                const store = tx.objectStore(storeName); 
                const req = store.get(id); 
                req.onsuccess = () => resolve(req.result); 
                req.onerror = () => resolve(null); 
            }); 
        } catch (err) { console.warn("Erro ao recuperar arquivo blob", err); return null; } 
    }, 

    deleteFile: async (id, namespace) => { 
        try { 
            const db = await dbHelper.open(namespace); 
            const storeName = getStoreName(STORE_FILES, namespace);
            const tx = db.transaction(storeName, 'readwrite'); 
            tx.objectStore(storeName).delete(id); 
        } catch (err) { console.error("Erro ao deletar arquivo", err); } 
    }, 

    // --- MÉTODOS DE ITEMS --- 
    updateItem: async (item, namespace) => {
        try {
            const db = await dbHelper.open(namespace);
            const storeName = getStoreName(STORE_ITEMS, namespace);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.put(item); 
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => {
                    console.error("Erro ao atualizar item:", e);
                    reject(e);
                };
            });
        } catch (e) { console.error("DB Error:", e); }
    },

    getAllItems: async (namespace) => {
        try {
            const db = await dbHelper.open(namespace);
            const storeName = getStoreName(STORE_ITEMS, namespace);
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
        } catch (err) { console.error("Erro ao recuperar itens", err); return []; }
    },

    saveItem: async (item, namespace) => {
        try {
            const db = await dbHelper.open(namespace);
            const storeName = getStoreName(STORE_ITEMS, namespace);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.put(item);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => {
                    console.error("Erro ao salvar item:", e);
                    reject(e);
                };
            });
        } catch (e) { console.error("DB Error:", e); }
    },
    
    deleteItem: async (id, namespace) => {
        try {
            const db = await dbHelper.open(namespace);
            const storeName = getStoreName(STORE_ITEMS, namespace);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.delete(id);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => {
                    console.error("Erro ao deletar item:", e);
                    reject(e);
                };
            });
        } catch (e) { console.error("DB Error:", e); }
    },
    
    saveAllItems: async (items, namespace) => {
        try {
            const db = await dbHelper.open(namespace);
            const storeName = getStoreName(STORE_ITEMS, namespace);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                
                // CORREÇÃO: Só limpa se houver itens para salvar
                // Isso evita perda de dados se chamar saveAllItems com array vazio
                if (items.length > 0) {
                    store.clear();
                }
                
                items.forEach(item => {
                    try {
                        store.put(item);
                    } catch (err) {
                        console.error("Erro ao salvar item individual:", err);
                    }
                });
                
                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => {
                    // Se deu erro, NÃO limpou os dados antigos (só limpa se for salvar)
                    console.error("Erro na transação saveAllItems:", e);
                    reject(e);
                };
            });
        } catch (e) { console.error("Erro ao salvar itens no IndexedDB:", e); }
    },
    
    // NOVO: Clear específico para perfil (usado ao excluir perfil)
    clearAllItems: async (namespace) => {
        try {
            const db = await dbHelper.open(namespace);
            const storeName = getStoreName(STORE_ITEMS, namespace);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                store.clear();
                tx.oncomplete = () => resolve(true);
                tx.onerror = (e) => reject(e);
            });
        } catch (e) { console.error("Erro ao limpar itens:", e); return false; }
    },
    
    // --- MÉTODOS DE CONTEÚDO DE NOTAS ---
    saveNoteContent: async (id, content, namespace) => {
        try {
            const db = await dbHelper.open(namespace);
            const storeName = getStoreName(STORE_NOTE_CONTENT, namespace);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.put({ id, content });
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => {
                    console.error("Erro ao salvar conteúdo da nota:", e);
                    reject(e);
                };
            });
        } catch (e) { console.error("DB Error:", e); }
    },
    
    getNoteContent: async (id, namespace) => {
        try {
            const db = await dbHelper.open(namespace);
            const storeName = getStoreName(STORE_NOTE_CONTENT, namespace);
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const request = store.get(id);
                
                request.onsuccess = () => {
                    if (request.result) resolve(request.result.content);
                    else resolve(null);
                };
                request.onerror = () => resolve(null);
            });
        } catch (e) { console.error("DB Error:", e); return null; }
    },
    
    deleteNoteContent: async (id, namespace) => {
        try {
            const db = await dbHelper.open(namespace);
            const storeName = getStoreName(STORE_NOTE_CONTENT, namespace);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.delete(id);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => {
                    console.error("Erro ao deletar conteúdo da nota:", e);
                    reject(e);
                };
            });
        } catch (e) { console.error("DB Error:", e); }
    },

    // --- BACKUPS AUTOMÁTICOS ---
    BACKUPS_KEY: '_auto_backups',

    saveAutoBackups: async (backups, namespace) => {
        try {
            const db = await dbHelper.open(namespace);
            const storeName = getStoreName(STORE_BACKUPS, namespace);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.put({ id: dbHelper.BACKUPS_KEY, backups });
                request.onsuccess = () => resolve(true);
                request.onerror = (e) => reject(e);
            });
        } catch (e) { console.error("Erro ao salvar backups:", e); return false; }
    },

    loadAutoBackups: async (namespace) => {
        try {
            const db = await dbHelper.open(namespace);
            const storeName = getStoreName(STORE_BACKUPS, namespace);
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const request = store.get(dbHelper.BACKUPS_KEY);
                request.onsuccess = () => resolve(request.result ? request.result.backups : []);
                request.onerror = () => resolve([]);
            });
        } catch (e) { console.error("Erro ao carregar backups:", e); return []; }
    }
};