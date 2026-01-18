// src/App.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// --- UTILS ---
import { 
    APP_VERSION, FIREBASE_CONFIG_FIXED, DEFAULT_THEME, 
    TIME_STATS_KEY, getStorageKey, getThemeKey, 
    DEFAULT_EDITAL_JSON, safeLocalStorage 
} from './utils/constants';

import { dbHelper } from './utils/dbHelper';
import { 
    readFileAsText, parseCSV, sanitizeItems, 
    calculateEditalProgress, copyItemRecursively 
} from './utils/formatHelpers';

// --- FIREBASE (Importações Diretas) ---
import { 
    auth, db, 
    onAuthStateChanged, signOut,
    doc, setDoc, getDoc, collection, writeBatch, getDocs, deleteField 
} from './utils/firebase';

// --- COMPONENTES ---
import Icon from './components/ui/Icon';
import ErrorBoundary from './components/common/ErrorBoundary';
import AuthScreen from './components/auth/AuthScreen';

// --- MODAIS ---
import SettingsModal from './components/modals/SettingsModal';
import StatsModal from './components/modals/StatsModal';
import CompletionModal from './components/modals/CompletionModal';
import FolderPickerModal from './components/modals/FolderPickerModal';
import MultiDeckCreatorModal from './components/modals/MultiDeckCreatorModal';

// --- VIEWERS ---
import FlashcardViewer from './components/viewers/FlashcardViewer';
import NoteViewer from './components/viewers/NoteViewer';
import EditalViewer from './components/viewers/EditalViewer';
import ReportViewer from './components/viewers/ReportViewer';
import { PDFViewer, VideoViewer, ImageViewer, GDriveViewer } from './components/viewers/MediaViewers';

// --- EXPLORER ---
import FileExplorer from './components/FileExplorer';

const App = () => {
    // --- ESTADOS GLOBAIS ---
    const [appReady, setAppReady] = useState(false); 
    const [user, setUser] = useState(null);
    const [isGuest, setIsGuest] = useState(false);
    const [connectionLog, setConnectionLog] = useState(null);
    
    // Dados Principais
    const [items, setItems] = useState([]);
    const [theme, setTheme] = useState(DEFAULT_THEME);
    
    // Navegação e Seleção
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [activeDeckId, setActiveDeckId] = useState(null);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    
    // UI States
    const [showQueue, setShowQueue] = useState(true);
    const [sidebarWidth, setSidebarWidth] = useState(584); 
    const [isResizing, setIsResizing] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
    
    // Modais States
    const [showSettings, setShowSettings] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [showMultiDeckCreator, setShowMultiDeckCreator] = useState(false);
    const [pickerCurrentPath, setPickerCurrentPath] = useState(null);

    // Funcionalidades
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilters, setActiveFilters] = useState([]);
    const [clipboard, setClipboard] = useState(null); 
    const [selectedIds, setSelectedIds] = useState([]); 
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [forceExplorer, setForceExplorer] = useState(false);
    
    // Status e Logs
    const [saveStatus, setSaveStatus] = useState('');
    const [lastCloudSave, setLastCloudSave] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [pdfMissing, setPdfMissing] = useState(false);

    // Refs
    const fileInputRef = useRef(null);
    const importInputRef = useRef(null);

    // --- HELPER: TOAST ---
    const showToast = (type, msg) => { setConnectionLog({ type, msg }); setTimeout(() => setConnectionLog(null), 4000); };

    // --- EFEITOS DE INICIALIZAÇÃO ---
    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Resize Logic
    const startResizing = useCallback((e) => { e.preventDefault(); setIsResizing(true); }, []);
    useEffect(() => {
        const resize = (e) => {
            if (isResizing) {
                let newWidth = document.body.clientWidth - e.clientX;
                if (newWidth < 250) newWidth = 250; if (newWidth > 800) newWidth = 800;
                setSidebarWidth(newWidth);
            }
        };
        const stopResizing = () => { setIsResizing(false); };
        if (isResizing) { window.addEventListener('mousemove', resize); window.addEventListener('mouseup', stopResizing); document.body.classList.add('select-none-important'); document.body.style.cursor = 'ew-resize'; } 
        else { document.body.classList.remove('select-none-important'); document.body.style.cursor = 'default'; }
        return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stopResizing); document.body.classList.remove('select-none-important'); document.body.style.cursor = 'default'; };
    }, [isResizing]);

    // --- TIME TRACKER (Global) ---
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                const raw = safeLocalStorage.getItem(TIME_STATS_KEY);
                let stats = raw ? JSON.parse(raw) : { totalMinutes: 0, days: [] };
                stats.totalMinutes = (stats.totalMinutes || 0) + 1;
                const today = new Date().toISOString().split('T')[0];
                if (!stats.days.includes(today)) stats.days.push(today);
                safeLocalStorage.setItem(TIME_STATS_KEY, JSON.stringify(stats));
            }
        }, 60000); 
        return () => clearInterval(interval);
    }, []);

    // --- LÓGICA DO FIREBASE ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u);
                setIsGuest(false);
                showToast('success', 'Conectado: ' + u.email);
                
                // Carregar dados da nuvem
                try {
                    const appId = FIREBASE_CONFIG_FIXED.projectId;
                    const ref = doc(db, 'artifacts', appId, 'users', u.uid, 'data', 'backup');
                    const snap = await getDoc(ref);
                    let cloudItems = [];
                    let cloudTheme = null;
                    let cloudTime = null;

                    if (snap.exists()) {
                        const d = snap.data();
                        cloudTheme = d.theme;
                        cloudTime = d.timestamp;
                        
                        const itemsCollectionRef = collection(db, 'artifacts', appId, 'users', u.uid, 'data', 'backup', 'items');
                        const itemsSnap = await getDocs(itemsCollectionRef);
                        
                        if (!itemsSnap.empty) {
                            cloudItems = itemsSnap.docs.map(doc => doc.data());
                        } else if (d.items && Array.isArray(d.items)) {
                            cloudItems = d.items;
                        }
                    }

                    if (cloudItems.length > 0 && confirm(`Backup encontrado (${cloudItems.length} itens). Carregar?`)) {
                        setItems(sanitizeItems(cloudItems));
                        if (cloudTheme) setTheme(cloudTheme);
                        if (cloudTime) setLastCloudSave(new Date(cloudTime));
                    }
                } catch (e) {
                    console.error("Erro ao carregar nuvem:", e);
                }
            } else {
                setUser(null);
            }
            setAppReady(true);
        });
        return () => unsubscribe();
    }, []);

    // Função de Salvar na Nuvem
    const saveToCloud = async (currItems = items, currTheme = theme) => { 
        if (!user || isGuest) return; 
        setSaveStatus('saving'); 
        
        const timeStatsRaw = safeLocalStorage.getItem(TIME_STATS_KEY);
        const timeStats = timeStatsRaw ? JSON.parse(timeStatsRaw) : null;
        
        try { 
            const appId = FIREBASE_CONFIG_FIXED.projectId; 
            const userRoot = `artifacts/${appId}/users/${user.uid}/data/backup`;
            const itemsCollectionRef = collection(db, 'artifacts', appId, 'users', user.uid, 'data', 'backup', 'items');
            
            const rootRef = doc(db, userRoot);
            await setDoc(rootRef, { 
                theme: currTheme, 
                timeStats: timeStats, 
                timestamp: Date.now(), 
                appVersion: APP_VERSION, 
                migratedToSubcollection: true, 
                items: deleteField() 
            }, { merge: true });

            const chunkSize = 450; 
            for (let i = 0; i < currItems.length; i += chunkSize) {
                const chunk = currItems.slice(i, i + chunkSize);
                const batch = writeBatch(db);
                chunk.forEach(item => { 
                    const itemToSave = { ...item }; 
                    delete itemToSave._isDirty; 
                    const itemRef = doc(itemsCollectionRef, String(item.id)); 
                    batch.set(itemRef, itemToSave); 
                });
                await batch.commit();
            }
            setLastCloudSave(new Date()); 
            setSaveStatus('saved_cloud'); 
            setTimeout(() => setSaveStatus(''), 3000); 
        } catch (e) { 
            console.error("Erro ao salvar:", e); 
            setSaveStatus('error'); 
            showToast('error', 'Erro ao salvar na nuvem.'); 
        } 
    };

    const withCloud = (newItems) => { setItems(newItems); saveToCloud(newItems, theme); };

    // Auto-Save Dirty Items
    useEffect(() => {
        const dirtyItems = items.filter(i => i._isDirty);
        if (dirtyItems.length === 0) return;
        
        const timeoutId = setTimeout(() => {
             if (user && !isGuest) {
                 const appId = FIREBASE_CONFIG_FIXED.projectId;
                 dirtyItems.forEach(async (item) => {
                     try {
                        const itemToSave = { ...item }; delete itemToSave._isDirty;
                        const itemRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'backup', 'items', String(item.id));
                        await setDoc(itemRef, itemToSave, { merge: true });
                     } catch(e) {}
                 });
             }
            setItems(prev => prev.map(i => i._isDirty ? { ...i, _isDirty: false } : i));
            setSaveStatus('saved_cloud');
            setTimeout(() => setSaveStatus(''), 2000);
        }, 2000);
        return () => clearTimeout(timeoutId);
    }, [items, user, isGuest]);

    // Persistência Local
    useEffect(() => { if (!appReady) return; const t = setTimeout(() => { const key = getStorageKey(user); safeLocalStorage.setItem(key, JSON.stringify(items)); }, 1000); return () => clearTimeout(t); }, [items, user, appReady]);
    useEffect(() => { if (!appReady) return; const key = getThemeKey(user); safeLocalStorage.setItem(key, JSON.stringify(theme)); }, [theme, user, appReady]);
    
    // Carregar Local Storage no Boot
    useEffect(() => { 
        if (!appReady) return; 
        const key = getStorageKey(user); const themeKey = getThemeKey(user); 
        try { 
            const savedItems = safeLocalStorage.getItem(key); if (savedItems) setItems(sanitizeItems(JSON.parse(savedItems))); else setItems([]); 
            const savedTheme = safeLocalStorage.getItem(themeKey); if (savedTheme) setTheme(JSON.parse(savedTheme)); else setTheme(DEFAULT_THEME); 
            setCurrentFolderId(null); setActiveDeckId(null); setCurrentCardIndex(0); 
        } catch (e) { console.error(e); } 
    }, [user, appReady]);

    // --- SELEÇÃO DO ITEM ATUAL ---
    const currentItem = useMemo(() => items.find(i => i.id === activeDeckId), [items, activeDeckId]);
    
    // Atualiza índice do card ao trocar de deck
    useEffect(() => { 
        if (currentItem && currentItem.type === 'deck') { 
            const savedIndex = Number(currentItem.progress) || 0; 
            const maxLen = currentItem.cards ? currentItem.cards.length : 0; 
            if (savedIndex >= maxLen && maxLen > 0) { setCurrentCardIndex(maxLen - 1); } 
            else { setCurrentCardIndex(savedIndex); } 
        } else if (!currentItem || currentItem.id !== activeDeckId) { 
            setCurrentCardIndex(0); 
        } 
    }, [currentItem, activeDeckId]);

    // Check PDF
    useEffect(() => { 
        if (currentItem?.type === 'pdf') { 
            setPdfMissing(false); 
            dbHelper.getFile(currentItem.id).then(blob => { 
                if (blob) { const url = URL.createObjectURL(blob); setPdfUrl(url); } 
                else { setPdfUrl(null); setPdfMissing(true); } 
            }); 
        } else { if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); } setPdfMissing(false); } 
    }, [activeDeckId, currentItem]);

    // --- LÓGICA DE FILTROS E BUSCA (SMART SEARCH RESTAURADA) ---
    const currentFolderItems = useMemo(() => {
        if (!items) return [];
        if (searchTerm && searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            let targetScopeItems = items;
            
            // Busca Escopada na Pasta Atual
            if (currentFolderId) {
                const getDescendantIds = (rootId) => { let ids = [rootId]; const children = items.filter(i => i.type === 'folder' && i.parentId === rootId); children.forEach(c => ids = ids.concat(getDescendantIds(c.id))); return ids; };
                const allowedParentIds = getDescendantIds(currentFolderId);
                targetScopeItems = items.filter(i => allowedParentIds.includes(i.parentId));
            }
            
            // Lógica de Range de Aulas (ex: "Aula 01-05")
            const isLessonSearch = term.includes('aula');
            let targetLessons = [];
            if (isLessonSearch) { 
                const rangeRegex = /(\d+)\s*(?:-|a|à|at[eé])\s*(?:aula\s*)?(\d+)/gi; 
                let match; 
                const rangeRegexInstance = new RegExp(rangeRegex); 
                while ((match = rangeRegexInstance.exec(term)) !== null) { 
                    const start = parseInt(match[1]); 
                    const end = parseInt(match[2]); 
                    if (!isNaN(start) && !isNaN(end)) { 
                        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) targetLessons.push(i); 
                    } 
                } 
                const allNumbers = term.match(/\d+/g); 
                if (allNumbers) allNumbers.forEach(n => targetLessons.push(parseInt(n))); 
                targetLessons = [...new Set(targetLessons)]; 
            }

            return targetScopeItems.filter(i => {
                const iName = i.name.toLowerCase(); 
                const iContent = (i.content && typeof i.content === 'string') ? i.content.toLowerCase() : "";
                
                if (isLessonSearch && targetLessons.length > 0) { 
                    if (!iName.includes('aula') && !iContent.includes('aula')) return false; 
                    return targetLessons.some(num => { 
                        const lessonRegex = new RegExp(`aula[s]?\\s*:?\\s*0*${num}\\b`, 'i'); 
                        return lessonRegex.test(iName) || lessonRegex.test(iContent); 
                    }); 
                }
                return iName.includes(term) || iContent.includes(term);
            }).sort((a, b) => { 
                // Ordenação Smart Search
                const typeOrder = { 'report': 0, 'edital': 1, 'gdrive': 2, 'folder': 3, 'shortcut': 3 }; 
                const orderA = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 4; 
                const orderB = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 4; 
                if (orderA !== orderB) return orderA - orderB; 
                const aName = a.name.toLowerCase().includes(term); 
                const bName = b.name.toLowerCase().includes(term); 
                if (aName && !bName) return -1; 
                if (!aName && bName) return 1; 
                return 0; 
            });
        }
        
        // Filtros de Tipo
        if (activeFilters.length > 0) {
            let targetItems = items;
            if (currentFolderId !== null) { 
                const getSubfolderIds = (rootId) => { const result = [rootId]; items.filter(i => i.parentId === rootId && i.type === 'folder').forEach(child => result.push(...getSubfolderIds(child.id))); return result; }; 
                const allowedParentIds = getSubfolderIds(currentFolderId); 
                targetItems = items.filter(i => allowedParentIds.includes(i.parentId)); 
            }
            return targetItems.filter(i => activeFilters.includes(i.type));
        }

        // Visualização Normal da Pasta
        return items.filter(i => i.parentId === currentFolderId).sort((a,b) => { 
            const typeOrder = { 'report': 0, 'edital': 1, 'gdrive': 2, 'folder': 3, 'shortcut': 3 }; 
            const orderA = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 4; 
            const orderB = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 4; 
            if (orderA !== orderB) return orderA - orderB; 
            return a.name.localeCompare(b.name, undefined, {sensitivity: 'base', numeric: true}); 
        });
    }, [items, currentFolderId, activeFilters, searchTerm]);

    const breadcrumbs = useMemo(() => { const p=[]; let c=currentFolderId; while(c){const f=items.find(i=>i.id===c); if(f){p.unshift(f); c=f.parentId}else break;} return p; }, [items, currentFolderId]);

    // --- AÇÕES DO CRUD ---
    const openItem = (itemOrId) => {
        const id = typeof itemOrId === 'object' ? itemOrId.id : itemOrId;
        if (id === activeDeckId) return;
        if (typeof itemOrId === 'object') { 
            setItems(prev => { 
                const newItem = { ...itemOrId, views: (itemOrId.views || 0) + 1 }; 
                if (prev.find(i => i.id === newItem.id)) return prev; 
                return [...prev, { ...newItem, _isDirty: true }]; 
            }); 
            setActiveDeckId(id); 
        } else { 
            setItems(prev => prev.map(i => i.id === id ? { ...i, views: (i.views || 0) + 1, _isDirty: true } : i)); 
            setActiveDeckId(id); 
        }
        setIsFlipped(false);
    };

    const handleItemClick = (item) => {
        if (isSelectionMode) { toggleSelection(item.id); return; }
        if (item.type === 'folder') { setCurrentFolderId(item.id); setSearchTerm(""); } 
        else if (item.type === 'shortcut') { 
            const targetExists = items.find(i => i.id === item.content && i.type === 'folder'); 
            if (targetExists) { setCurrentFolderId(targetExists.id); setSearchTerm(""); showToast('success', `Atalho: indo para ${targetExists.name}`); } 
            else { alert("Destino não encontrado."); } 
        } 
        else openItem(item.id);
    };

    // Criação
    const createItem = (type, name, content, extras = {}) => {
        const newItem = { id: Date.now().toString() + Math.random(), type, name, parentId: currentFolderId, content, views: 0, ...extras };
        if (['deck','note','edital','video','image','gdrive'].includes(type)) openItem(newItem);
        else withCloud([...items, newItem]);
    };

    const handleCreateFolder = () => { const name = prompt("Nome:"); if(name) createItem('folder', name, null); };
    const handleCreateNote = () => { const name = prompt("Nome:"); if(name) createItem('note', name, ''); };
    const handleCreateVideo = () => { const name = prompt("Nome:"); const url = prompt("URL:"); if(name && url) createItem('video', name, url); };
    const handleCreateImage = () => { const name = prompt("Nome:"); const url = prompt("URL:"); if(name && url) createItem('image', name, url); };
    const handleCreateGDrive = () => { const name = prompt("Nome:"); const url = prompt("ID/Link:"); if(name && url) { let id = url.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1] || url; createItem('gdrive', name, id); } };
    const handleCreateEdital = () => { const name = prompt("Nome:"); if(name) createItem('edital', name, DEFAULT_EDITAL_JSON, { progressMap: {} }); };
    const handleCreateReport = () => { const name = prompt("Nome:"); if(name) createItem('report', name, null, { created: Date.now() }); };
    const handleCreateShortcut = () => { setPickerCurrentPath(null); setShowFolderPicker(true); };

    // Upload & Import
    const handleFileUpload = async (e) => { 
        const files = Array.from(e.target.files); if(files.length===0) return; 
        const toAdd = []; 
        for(let f of files) { 
            try { 
                const id = Date.now().toString() + Math.random(); 
                if(f.name.endsWith('.pdf')) { await dbHelper.saveFile(id, f); toAdd.push({id, type:'pdf', name:f.name.replace('.pdf',''), parentId:currentFolderId, views: 0}); } 
                else if(f.name.endsWith('.txt')) { const txt = await readFileAsText(f); toAdd.push({id, type:'note', name:f.name.replace('.txt',''), parentId:currentFolderId, content:txt, views: 0}); } 
                else { const txt = await readFileAsText(f); const c = parseCSV(txt); if(c.length>0) toAdd.push({id, type:'deck', name:f.name.replace('.csv',''), parentId:currentFolderId, cards:c, progress:0, completions:0, views: 0}); } 
            } catch(err){ console.error(err); } 
        } 
        if(toAdd.length>0) withCloud([...items, ...toAdd]); 
        e.target.value=''; 
    };

    const handleImportData = async (event) => {
        const file = event.target.files[0]; if(!file) return;
        try {
            const text = await readFileAsText(file); const data = JSON.parse(text);
            if(Array.isArray(data.items) || (data.decks && Array.isArray(data.decks))) {
                const rawImport = data.items || data.decks;
                if(confirm("Substituir dados atuais?")) {
                    const newItems = sanitizeItems(rawImport.map(d => ({ ...d, id: d.id || Date.now() + Math.random(), type: d.type || 'deck', parentId: d.parentId || null })));
                    setItems(newItems); setCurrentFolderId(null); setActiveDeckId(null);
                    if(data.theme) setTheme(data.theme);
                    saveToCloud(newItems, data.theme || theme);
                    alert("Importação concluída!"); setShowStats(false);
                }
            } else { alert("Arquivo inválido."); }
        } catch (e) { alert("Erro: " + e.message); } event.target.value = '';
    };

    const handleExportData = () => { const data = { items, theme, timestamp: Date.now(), appVersion: APP_VERSION }; const blob = new Blob([JSON.stringify(data)], {type: "application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup_flashcards_${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); };

    // --- DELEÇÃO RECURSIVA ---
    const handleDelete = async (e, id) => {
        e && e.stopPropagation();
        if(confirm("Tem certeza?")) {
            const getIds = (r, l) => { let ids=[r]; l.filter(i=>i.parentId===r).forEach(c=>ids.push(...getIds(c.id, l))); return ids; };
            const todel = getIds(id, items);
            
            // Deletar PDFs físicos
            todel.forEach(tid => { const it = items.find(x => x.id === tid); if(it && it.type === 'pdf') dbHelper.deleteFile(tid); });
            
            // Deletar da Nuvem (Firebase)
             if (user && !isGuest) { 
                try { 
                    const appId = FIREBASE_CONFIG_FIXED.projectId; 
                    const chunkSize = 450; 
                    for (let i = 0; i < todel.length; i += chunkSize) { 
                        const chunk = todel.slice(i, i + chunkSize); 
                        const batch = writeBatch(db); 
                        chunk.forEach(tid => { 
                            const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'backup', 'items', String(tid)); 
                            batch.delete(ref); 
                        }); 
                        await batch.commit(); 
                    } 
                } catch (err) { console.error("Erro delete cloud:", err); } 
            }

            const next = items.filter(i => !todel.includes(i.id));
            withCloud(next);
            if(todel.includes(activeDeckId)) setActiveDeckId(null);
        }
    };

    const handleRename = (id, newName) => withCloud(items.map(i => i.id===id ? {...i, name:newName} : i));
    
    // Clipboard e Seleção
    const handleClipboard = (e, item, mode) => { e && e.stopPropagation(); if (!item) { setClipboard(null); return; } setClipboard({ mode, items: [item.id] }); };
    
    // --- COLAR RECURSIVO ---
    const handlePaste = () => { 
        if(!clipboard) return; 
        let next = [...items]; 
        
        if (clipboard.mode === 'cut') {
            clipboard.items.forEach(id => {
                const idx = next.findIndex(x => x.id === id); 
                if(idx !== -1) next[idx] = { ...next[idx], parentId: currentFolderId, _isDirty: true }; 
            });
            setClipboard(null); 
        } else {
            // Modo Copy usando a função importada de formatHelpers
            clipboard.items.forEach(id => { 
                const newCopies = copyItemRecursively(id, currentFolderId, items);
                next = [...next, ...newCopies];
            }); 
        }
        withCloud(next);
        setSelectedIds([]); 
        setIsSelectionMode(false);
    };
    
    const toggleSelection = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    
    const handleBatchDelete = async () => { 
        if(confirm(`Apagar ${selectedIds.length} itens?`)) { 
            let allToDelete = [];
            const getIds = (r, l) => { let ids=[r]; l.filter(i=>i.parentId===r).forEach(c=>ids.push(...getIds(c.id, l))); return ids; };
            
            selectedIds.forEach(id => { allToDelete = [...allToDelete, ...getIds(id, items)]; });
            allToDelete = [...new Set(allToDelete)];

            allToDelete.forEach(tid => { const it = items.find(x => x.id === tid); if(it && it.type === 'pdf') dbHelper.deleteFile(tid); });

            // Deletar da Nuvem
            if (user && !isGuest) {
                try {
                    const appId = FIREBASE_CONFIG_FIXED.projectId;
                    const chunkSize = 450;
                    for (let i = 0; i < allToDelete.length; i += chunkSize) {
                        const chunk = allToDelete.slice(i, i + chunkSize);
                        const batch = writeBatch(db);
                        chunk.forEach(tid => {
                             const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'backup', 'items', String(tid));
                             batch.delete(ref);
                        });
                        await batch.commit();
                    }
                } catch(e) { console.error(e); }
            }

            const next = items.filter(i => !allToDelete.includes(i.id)); 
            withCloud(next); 
            setSelectedIds([]); setIsSelectionMode(false); 
        } 
    };

    // Updates
    const updateNoteContent = (id, c) => setItems(p => p.map(i => i.id===id ? {...i, content:c, _isDirty: true} : i));
    const updateNoteHighlights = (id, h, removeId) => { setItems(p => p.map(i => { if(i.id !== id) return i; let newH = i.highlights || []; if(removeId) newH = newH.filter(x => x.id !== removeId); else if(h) newH = [...newH, { ...h, id: Date.now() }]; return { ...i, highlights: newH, _isDirty: true }; })); };
    const updateEditalContent = (id, c) => setItems(p => p.map(i => i.id===id ? {...i, content:c, _isDirty: true} : i));
    const updateEditalProgress = (id, discId, path, field, value) => { setItems(prevItems => prevItems.map(item => { if (item.id === id) { const newMap = { ...(item.progressMap || {}) }; if (!newMap[discId]) newMap[discId] = {}; let currentStatus = newMap[discId][path]; if (typeof currentStatus !== 'object' || currentStatus === null) { currentStatus = { lido: !!currentStatus }; } else { currentStatus = { ...currentStatus }; } currentStatus[field] = value; if (field === 'facil' && value) currentStatus.dificil = false; if (field === 'dificil' && value) currentStatus.facil = false; newMap[discId][path] = currentStatus; return { ...item, progressMap: newMap, _isDirty: true }; } return item; })); };

    // Flashcard Nav
    const handleNextCard = () => { if(currentCardIndex < (currentItem.cards?.length || 0) -1){ const n=currentCardIndex+1; setIsFlipped(false); setTimeout(()=>{setCurrentCardIndex(n); setItems(p => p.map(i => i.id===activeDeckId ? {...i, progress:n, _isDirty: true} : i));},150); } else setShowCompletionModal(true); };
    const handlePrevCard = () => { if(currentCardIndex > 0){ const n=currentCardIndex-1; setIsFlipped(false); setTimeout(()=>{setCurrentCardIndex(n); setItems(p => p.map(i => i.id===activeDeckId ? {...i, progress:n, _isDirty: true} : i));},150); } };
    const finishDeck = (completed) => { setShowCompletionModal(false); const compl = completed ? (currentItem.completions||0)+1 : (currentItem.completions||0); const nextItems = items.map(i => i.id===activeDeckId ? {...i, progress:0, completions: compl} : i); if(completed) saveToCloud(nextItems, theme); setItems(nextItems); setIsFlipped(false); setCurrentCardIndex(0); };

    // Logout
    const handleLogout = () => { setUser(null); setIsGuest(false); setShowStats(false); setItems([]); signOut(auth).catch(()=>{}); };

    // --- RENDER ---
    if (!appReady) return <div className="min-h-screen flex items-center justify-center text-gray-500 animate-pulse">Carregando...</div>;
    if (!user && !isGuest) return <AuthScreen onLogin={u => setUser(u)} onGuest={() => setIsGuest(true)} />;

    // Tela Vazia (sem items)
    if (items.length === 0 && !forceExplorer) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 text-center relative">
                {connectionLog && <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-sm font-bold z-50 transition-all ${connectionLog.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{connectionLog.msg}</div>}
                {user && <div className="absolute top-4 left-4 flex items-center gap-2 text-sm text-gray-600"><span className="w-2 h-2 bg-green-500 rounded-full"></span> {user.email}</div>}
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100 relative">
                    <button onClick={() => setShowStats(true)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><Icon name="barChart" size={20} /></button>
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600"><Icon name="layers" size={40} /></div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Flashcard Flow</h1>
                    <p className="text-gray-500 mb-8">Seu explorador de estudos está vazio.</p>
                    <div className="space-y-2">
                        <button onClick={() => setForceExplorer(true)} className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-3"><Icon name="folder" size={20} /> <span>Abrir Explorador</span></button>
                        <button onClick={() => fileInputRef.current.click()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-3"><Icon name="filePlus" size={24} /> <span>Importar Arquivo (.csv / .txt / .pdf)</span></button>
                        <button onClick={() => importInputRef.current.click()} className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-3"><Icon name="uploadCloud" size={20} /> <span>Importar Backup Local</span></button>
                    </div>
                    <input type="file" accept=".csv, .txt, .pdf" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <input type="file" accept=".json" ref={importInputRef} onChange={handleImportData} className="hidden" />
                    <div className="mt-6 pt-6 border-t">
                        <button onClick={handleLogout} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-lg text-sm flex items-center justify-center gap-2"><Icon name="logOut" size={16}/> Sair / Login</button>
                    </div>
                    {showStats && <StatsModal user={user} items={items} theme={theme} onClose={() => setShowStats(false)} onLogout={handleLogout} onReset={() => setItems([])} />}
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="h-screen w-full flex flex-col md:flex-row bg-gray-50 overflow-hidden">
                {connectionLog && <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-sm font-bold z-50 transition-all ${connectionLog.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{connectionLog.msg}</div>}

                {/* --- ÁREA DE CONTEÚDO (DIREITA) --- */}
                <div className="flex-1 flex flex-col h-full relative order-2 md:order-1 overflow-hidden">
                    <div className="md:hidden bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm shrink-0">
                        <span className="font-bold text-gray-700 truncate mr-2">{currentItem ? currentItem.name : "Selecione"}</span>
                        <button onClick={() => setShowQueue(!showQueue)} className="p-2 bg-gray-100 rounded"><Icon name="layers" size={20} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
                        {!currentItem ? (
                            <div className="text-center text-gray-400 my-auto">
                                <Icon name="arrowUp" size={48} className="mx-auto mb-4 opacity-20 rotate-90 md:rotate-0" />
                                <p>Selecione um item.</p>
                            </div>
                        ) : currentItem.type === 'note' ? (
                            <NoteViewer currentItem={currentItem} updateNoteContent={updateNoteContent} onUpdateHighlights={updateNoteHighlights} />
                        ) : currentItem.type === 'edital' ? (
                            <EditalViewer currentItem={currentItem} updateEditalContent={updateEditalContent} updateEditalProgress={updateEditalProgress} onSmartSearch={(aula) => { setSearchTerm(aula); if(!isDesktop) setShowQueue(true); showToast('success', `Buscando: ${aula}`); }} onToggleEdit={(id, val) => setItems(p => p.map(i => i.id===id ? {...i, isEditing: val} : i))} />
                        ) : currentItem.type === 'report' ? (
                            <ReportViewer currentItem={currentItem} items={items} onItemClick={handleItemClick} />
                        ) : currentItem.type === 'pdf' ? (
                            <PDFViewer currentItem={currentItem} pdfUrl={pdfUrl} pdfMissing={pdfMissing} onRestore={async (e) => { if(e.target.files[0]) { await dbHelper.saveFile(currentItem.id, e.target.files[0]); setPdfMissing(false); setPdfUrl(URL.createObjectURL(e.target.files[0])); } }} />
                        ) : currentItem.type === 'video' ? (
                            <VideoViewer currentItem={currentItem} />
                        ) : currentItem.type === 'image' ? (
                            <ImageViewer currentItem={currentItem} />
                        ) : currentItem.type === 'gdrive' ? (
                            <GDriveViewer currentItem={currentItem} />
                        ) : (
                            <FlashcardViewer currentItem={currentItem} currentCardIndex={currentCardIndex} isFlipped={isFlipped} onFlip={() => setIsFlipped(!isFlipped)} onNext={handleNextCard} onPrev={handlePrevCard} theme={theme} />
                        )}
                    </div>
                </div>

                {/* --- SIDEBAR (ESQUERDA) --- */}
                <div className={`fixed inset-0 z-40 bg-white flex flex-col transition-transform duration-300 md:relative md:translate-x-0 md:border-l border-gray-200 md:order-2 h-full ${showQueue ? 'translate-x-0' : 'translate-x-full'}`} style={isDesktop ? { width: sidebarWidth } : {}}>
                    <div className="hidden md:block absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-400 z-50 transition-colors" onMouseDown={startResizing} style={{ backgroundColor: isResizing ? '#3b82f6' : 'transparent', touchAction: 'none' }} />
                    {/*<div className="absolute top-4 right-4 z-10 flex gap-1 md:hidden"> </div>*/}

                    {/* ... dentro do return do App.jsx ... */}

<FileExplorer 
    items={currentFolderItems}
    allItems={items} // <--- ADICIONAR ESTA LINHA (Corrige a contagem)
    currentFolderId={currentFolderId}
    setCurrentFolderId={setCurrentFolderId}
    activeDeckId={activeDeckId}
    onItemClick={handleItemClick}
    searchTerm={searchTerm}
    setSearchTerm={setSearchTerm}
    activeFilters={activeFilters}
    toggleFilter={(id) => setActiveFilters(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id])}
    clearFilters={() => setActiveFilters([])}
    clearSearch={() => setSearchTerm("")}
    breadcrumbs={breadcrumbs}
    
    // Actions
    onDelete={handleDelete}
    onRename={handleRename}
    onDownload={(e, item) => { e.stopPropagation(); }}
    onClipboard={handleClipboard}
    onPaste={handlePaste}
    clipboard={clipboard}
    
    // Batch
    isSelectionMode={isSelectionMode}
    selectedIds={selectedIds}
    toggleSelectionMode={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); }}
    toggleSelection={toggleSelection}
    onBatchDelete={handleBatchDelete}
    onBatchCopy={() => { handleClipboard(null, {id: 'batch'}, 'copy'); }}
    onBatchCut={() => { handleClipboard(null, {id: 'batch'}, 'cut'); }}
    
    // Creators
    onCreateFolder={handleCreateFolder}
    onCreateNote={handleCreateNote}
    onCreateVideo={handleCreateVideo}
    onCreateImage={handleCreateImage}
    onCreateShortcut={handleCreateShortcut}
    onCreateGDrive={handleCreateGDrive}
    onCreateEdital={handleCreateEdital}
    onCreateReport={handleCreateReport}
    onCreateMultiDeck={() => setShowMultiDeckCreator(true)}
    onImportFile={() => fileInputRef.current.click()}
    
    // Props de Login/UI
    isGuest={isGuest}
    onLoginClick={() => {
        setIsGuest(false);
        setUser(null);
    }}
    onClose={() => setShowQueue(false)}
    // NOVAS PROPS (Corrigem o Header)
    onOpenSettings={() => setShowSettings(true)}
    onOpenStats={() => setShowStats(true)}
/>
                    
                    {showQueue && <div className="fixed inset-0 bg-black/20 z-[-1] md:hidden backdrop-blur-sm" onClick={() => setShowQueue(false)}></div>}
                </div>

                {/* --- MODAIS --- */}
                {showSettings && <SettingsModal theme={theme} setTheme={setTheme} onClose={() => setShowSettings(false)} onSave={() => { setShowSettings(false); setSaveStatus('saved'); }} />}
                {showStats && <StatsModal user={user} items={items} theme={theme} lastCloudSave={lastCloudSave} onClose={() => setShowStats(false)} onLogout={handleLogout} onSaveCloud={() => saveToCloud(items, theme)} onExport={handleExportData} onImport={() => importInputRef.current.click()} onReset={() => { if(confirm("Apagar tudo?")) { setItems([]); safeLocalStorage.clear(); setTheme(DEFAULT_THEME); setShowStats(false); } }} />}
                {showCompletionModal && <CompletionModal onFinish={finishDeck} />}
                {showFolderPicker && <FolderPickerModal items={items} currentPath={pickerCurrentPath} setCurrentPath={setPickerCurrentPath} onConfirm={(target) => { createItem('shortcut', target.name, target.id); setShowFolderPicker(false); }} onClose={() => setShowFolderPicker(false)} />}
                {showMultiDeckCreator && <MultiDeckCreatorModal items={items} currentFolderId={currentFolderId} onCreate={(newItem) => withCloud([...items, newItem])} onClose={() => setShowMultiDeckCreator(false)} showToast={showToast} />}
                
                <input type="file" accept=".csv, .txt, .pdf" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <input type="file" accept=".json" ref={importInputRef} onChange={handleImportData} className="hidden" />
            </div>
        </ErrorBoundary>
    );
};

export default App;