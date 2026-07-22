// src/App.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// --- UTILS ---
import { 
    APP_VERSION, FIREBASE_CONFIG_FIXED, DEFAULT_THEME, 
    TIME_STATS_KEY, getStorageKey, getThemeKey, 
    DEFAULT_EDITAL_JSON, safeLocalStorage, GOOGLE_DRIVE_API_KEY 
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
    doc, setDoc, getDoc, collection, writeBatch, getDocs, deleteField,
    onSnapshot // <--- ADICIONE ISSO AQUI
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
import PDFViewer from './components/viewers/PDFViewer';
import MapViewer from './components/viewers/MapViewer';
import { VideoViewer, ImageViewer, GDriveViewer } from './components/viewers/MediaViewers';

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
    const [showQueue, setShowQueue] = useState(true); // Mobile
    const [showSidebar, setShowSidebar] = useState(true); // NOVO: Desktop
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
    //const [pdfUrl, setPdfUrl] = useState(null);
    //const [pdfMissing, setPdfMissing] = useState(false);

    // Refs
    const fileInputRef = useRef(null);
    const importInputRef = useRef(null);

    // --- HELPER: TOAST ---
    const showToast = (type, msg) => { setConnectionLog({ type, msg }); setTimeout(() => setConnectionLog(null), 4000); };


    // --- HELPER: Estilos dos Ícones (Igual ao FileExplorer) ---
    const getItemStyles = (type, isActive) => {
        const base = "w-6 h-6 rounded-full flex items-center justify-center mr-2 shrink-0 ";
        if (isActive) return base + "bg-blue-600 text-white"; // Aba Ativa (Azul forte)
        
        // Cores por tipo (Aba Inativa)
        switch (type) {
            case 'folder': return base + "bg-yellow-100 text-yellow-600";
            case 'note': return base + "bg-indigo-100 text-indigo-600";
            case 'pdf': 
            case 'pdf_drive': return base + "bg-red-100 text-red-600";
            case 'video': return base + "bg-pink-100 text-pink-600";
            case 'image': return base + "bg-purple-100 text-purple-600";
            case 'edital': return base + "bg-green-100 text-green-600";
            case 'report': return base + "bg-orange-100 text-orange-600";
            case 'map': return base + "bg-teal-100 text-teal-600";
            case 'gdrive': return base + "bg-blue-100 text-blue-600";
            case 'external_link': return base + "bg-gray-200 text-gray-600";
            default: return base + "bg-gray-100 text-gray-500";
        }
    };

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

// --- LÓGICA DO FIREBASE (EM TEMPO REAL) ---
    useEffect(() => {
        let unsubscribeItems = null; // Variável para controlar o "ouvido" do banco

        const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u);
                setIsGuest(false);
                showToast('success', 'Conectado: ' + u.email);               
                try {
                    const appId = FIREBASE_CONFIG_FIXED.projectId;
                    
                    // 1. CARREGAR TEMA (Uma vez só, ou pode usar onSnapshot se quiser tema dinâmico)
                    const userRootRef = doc(db, 'artifacts', appId, 'users', u.uid, 'data', 'backup');
                    getDoc(userRootRef).then(snap => {
                        if(snap.exists() && snap.data().theme) {
                            setTheme(snap.data().theme);
                        }
                    });

                    // 2. OUVINTE EM TEMPO REAL DOS ITENS (O Segredo!)
                    const itemsCollectionRef = collection(db, 'artifacts', appId, 'users', u.uid, 'data', 'backup', 'items');
                    
                    // Esta função roda AUTOMATICAMENTE sempre que algo mudar na nuvem
                    unsubscribeItems = onSnapshot(itemsCollectionRef, (snapshot) => {
                        const cloudItems = snapshot.docs.map(doc => doc.data());
                        
                        // Se vierem dados, atualiza a tela na hora
                        if (cloudItems.length > 0) {
                            // sanitizeItems garante que os dados venham limpos
                            setItems(sanitizeItems(cloudItems));
                            
                            // Atualiza o relógio da última sincronização para evitar loop de salvamento
                            setLastCloudSave(new Date());
                        }
                    }, (error) => {
                        console.error("Erro sync:", error);
                    });

                } catch (e) {
                    console.error("Erro conexão:", e);
                }
            } else {
                // Ao sair (Logout)
                setUser(null);
                setItems([]);
                if (unsubscribeItems) unsubscribeItems(); // Para de ouvir
            }
            setAppReady(true);
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeItems) unsubscribeItems(); // Limpeza geral ao fechar app
        };
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


// --- DRAG AND DROP DAS ABAS ---
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    const handleSortTabs = () => {
        // Se não houver itens válidos, cancela
        if (dragItem.current === null || dragOverItem.current === null) return;

        // Cria uma cópia do array de abas
        const _tabs = [...tabs];

        // Remove o item da posição original
        const draggedItemContent = _tabs.splice(dragItem.current, 1)[0];

        // Insere na nova posição
        _tabs.splice(dragOverItem.current, 0, draggedItemContent);

        // Reseta as referências
        dragItem.current = null;
        dragOverItem.current = null;

        // Atualiza o estado
        setTabs(_tabs);
    };


    // --- NOVO ESTADO: SISTEMA DE ABAS ---
    const [tabs, setTabs] = useState([]); // Array de IDs dos itens abertos
    // O 'activeDeckId' continuará servindo como o ID da aba/arquivo ativo no momento

    // --- FUNÇÕES DE GERENCIAMENTO DE ABAS ---
    
    // 1. Fecha uma aba
    const closeTab = (e, tabId) => {
        e.stopPropagation();
        const newTabs = tabs.filter(id => id !== tabId);
        setTabs(newTabs);
        
        // Se fechou a aba ativa, muda o foco para a anterior (ou null)
        if (activeDeckId === tabId) {
            if (newTabs.length > 0) {
                setActiveDeckId(newTabs[newTabs.length - 1]);
            } else {
                setActiveDeckId(null);
            }
        }
    };

    // 2. Lógica de "Clique Normal" (Substituir atual ou Focar)
    const handleItemClick = (item) => {
        if (isSelectionMode) { toggleSelection(item.id); return; }
        
        // Se for pasta, mantém lógica antiga
        if (item.type === 'folder') { setCurrentFolderId(item.id); setSearchTerm(""); return; }
        
        // Se for link externo, mantém lógica
        if (item.type === 'external_link') { window.open(item.content.startsWith('http') ? item.content : 'https://'+item.content, '_blank'); return; }

        // --- LÓGICA DE ABAS (NORMAL) ---
        // Se o item JÁ está em uma aba, apenas foca nele
        if (tabs.includes(item.id)) {
            setActiveDeckId(item.id);
        } else {
            // Se não está em aba:
            // Opção A: Se não tem nenhuma aba aberta, abre uma nova
            if (tabs.length === 0) {
                setTabs([item.id]);
                setActiveDeckId(item.id);
            } else {
                // Opção B: "Navegar" na aba atual (Substituir o item ativo pelo novo)
                // Isso atende ao "abrir na visualização atual"
                setTabs(prev => prev.map(id => id === activeDeckId ? item.id : id));
                setActiveDeckId(item.id);
            }
        }
    };

    // 3. Lógica de "Ícone Nova Aba" (Ex-Download)
    const handleOpenInNewTab = (e, item) => {
        e.stopPropagation();
        
        if (tabs.includes(item.id)) {
            // Se já existe, só foca e avisa
            setActiveDeckId(item.id);
            showToast('success', 'Arquivo já está aberto.');
            return;
        }

        if (tabs.length >= 5) {
            showToast('error', 'Máximo de 5 abas abertas.');
            return;
        }

        // Adiciona nova aba e foca
        setTabs(prev => [...prev, item.id]);
        setActiveDeckId(item.id);
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
    const handleCreatePDFDrive = () => {
        const name = prompt("Nome do PDF:");
        if (!name) return;
        
        const url = prompt("Link do Google Drive (Deve ser PÚBLICO):");
        if (!url) return;
        
        // Mágica para extrair o ID do arquivo do link do Drive
        const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const fileId = idMatch ? idMatch[1] : null;

        if (fileId) {
            // Cria o item salvando apenas o ID no 'content' e define o tipo novo
            createItem('pdf_drive', name, fileId, { highlights: [] });
            showToast('success', 'PDF 2.0 criado com sucesso!');
        } else {
            alert("Link inválido. Certifique-se de copiar o link completo do Google Drive.");
        }
    };
    // 1. Criar Mapa Mental
    const handleCreateMap = () => {
        const name = prompt("Nome do Mapa Mental:");
        if (name) {
             // Cria com o JSON padrão
             const defaultJson = JSON.stringify({
                "name": name,
                "children": [{"name": "Tópico 1"}, {"name": "Tópico 2"}]
             }, null, 2);
             createItem('map', name, defaultJson);
        }
    };
    // 2. Criar Link Externo
    const handleCreateExternalLink = () => {
        const name = prompt("Nome do Link:");
        if (!name) return;
        const url = prompt("URL (ex: https://google.com):");
        if (url) {
            createItem('external_link', name, url);
        }
    };
    // 3. Atualizar conteúdo do Mapa
    const updateMapContent = (id, contentObj) => {
        const contentString = JSON.stringify(contentObj, null, 2);
        setItems(p => p.map(i => i.id === id ? { ...i, content: contentString, _isDirty: true } : i));
    };

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
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await readFileAsText(file);
        const data = JSON.parse(text);
        const rawImport = data.items || data.decks;

        if (!Array.isArray(rawImport)) {
            alert("Arquivo de backup inválido.");
            return;
        }

        if (confirm("Isso substituirá todos os seus dados locais. Continuar?")) {
            // 1. Mantém os IDs originais para preservar a hierarquia de pastas
            const newItems = sanitizeItems(rawImport);
            
            // 2. Restaura o tema e estatísticas de tempo se existirem
            if (data.theme) setTheme(data.theme);
            if (data.timeStats) {
                safeLocalStorage.setItem(TIME_STATS_KEY, JSON.stringify(data.timeStats));
            }

            // 3. Atualiza o estado local
            setItems(newItems);
            setCurrentFolderId(null); // Volta para a raiz para evitar erros de navegação
            setActiveDeckId(null);

            // 4. Sincronização com a Nuvem (Se estiver logado)
            if (user && !isGuest) {
                showToast('info', 'Sincronizando backup com a nuvem...');
                await saveToCloud(newItems, data.theme || theme);
                showToast('success', 'Backup restaurado e salvo na nuvem!');
            } else {
                showToast('success', 'Backup restaurado localmente!');
            }
        }
    } catch (e) {
        alert("Erro na importação: " + e.message);
    }
    event.target.value = '';
};

    const handleExportData = () => {
    // Captura os dados de tempo do localStorage
    const timeStatsRaw = safeLocalStorage.getItem(TIME_STATS_KEY);
    const timeStats = timeStatsRaw ? JSON.parse(timeStatsRaw) : null;

    const backupData = {
        items: items, // Exporta o array original com IDs mantidos
        theme: theme,
        timeStats: timeStats,
        timestamp: Date.now(),
        appVersion: APP_VERSION
    };

    const blob = new Blob([JSON.stringify(backupData)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_flashcardflow_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

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
    //const updateNoteHighlights = (id, h, removeId) => { setItems(p => p.map(i => { if(i.id !== id) return i; let newH = i.highlights || []; if(removeId) newH = newH.filter(x => x.id !== removeId); else if(h) newH = [...newH, { ...h, id: Date.now() }]; return { ...i, highlights: newH, _isDirty: true }; })); };
    // Substitua a função antiga por esta versão corrigida:
    const updateNoteHighlights = (id, h, removeId) => { 
        setItems(p => p.map(i => { 
            if(i.id !== id) return i; 
            
            let newH = i.highlights || []; 
            
            // CASO 1: Substituição Total (Para o Desfazer/Refazer funcionar na nuvem)
            if (removeId === 'REPLACE') {
                newH = Array.isArray(h) ? h : newH;
            }
            // CASO 2: Remover um destaque específico (Borracha)
            else if(removeId) {
                newH = newH.filter(x => x.id !== removeId); 
            }
            // CASO 3: Adicionar novo destaque
            else if(h) {
                // CORREÇÃO: Se já vier um ID (do histórico), usa ele. Se não, cria um.
                // Isso garante que o Front e o Back falem a mesma língua.
                const itemToAdd = h.id ? h : { ...h, id: Date.now() };
                newH = [...newH, itemToAdd]; 
            }
            
            // Marca como sujo para salvar na nuvem
            return { ...i, highlights: newH, _isDirty: true }; 
        })); 
    };


// --- FUNÇÃO DE SALVAR DESTAQUES (Coloque DENTRO do componente App) ---
    const handleSaveHighlights = async (id, newHighlightsArray) => {
        try {
            // 1. Atualiza a lista geral (Isso já atualiza o currentItem automaticamente)
            const updatedItems = items.map(item => 
                item.id === id ? { ...item, highlights: newHighlightsArray, _isDirty: true } : item
            );
            setItems(updatedItems);

            // 2. Salva no Banco de Dados Local (IndexedDB)
            const itemToSave = updatedItems.find(i => i.id === id);
            if (itemToSave) {
                if (dbHelper && dbHelper.updateItem) {
                    await dbHelper.updateItem(itemToSave);
                    console.log("Salvo no DB Local com sucesso.");
                } else {
                    console.warn("dbHelper.updateItem não disponível.");
                }
            }
            
            // 3. Força salvamento na nuvem (opcional, mas bom para garantir)
            saveToCloud(updatedItems, theme);

        } catch (error) {
            console.error("Erro ao salvar highlights:", error);
            showToast('error', 'Erro ao salvar alterações.');
        }
    };

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
                <div className="flex-1 flex flex-col h-full relative order-2 md:order-1 overflow-hidden transition-all duration-300">
                    
                    {/* 1. NOVA BARRA SUPERIOR (DESKTOP): Botão Toggle + Abas */}
                    <div className="hidden md:flex items-center bg-gray-100 border-b border-gray-300 px-2 gap-2 h-12 shrink-0">
                        {/* Botão para Fechar/Abrir Sidebar */}
                        <button 
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="p-2 hover:bg-gray-200 text-gray-600 rounded transition-colors shrink-0"
                            title={showSidebar ? "Expandir Tela (Fechar Sidebar)" : "Mostrar Sidebar"}
                        >
                            {/* Ícone muda dependendo do estado */}
                            <Icon name={showSidebar ? "maximize2" : "layout"} size={18} />
                        </button>
                        
                        <div className="w-px h-6 bg-gray-300 mx-1 shrink-0"></div>

                        {/* Lista de Abas (Agora dentro da barra superior) */}
                        <div className="flex-1 flex items-center gap-1 overflow-x-auto custom-scroll h-full">
                            {tabs.map((tabId, index) => {
                                const tabItem = items.find(i => i.id === tabId);
                                if (!tabItem) return null;
                                const isActive = activeDeckId === tabId;
                                
                                return (
                                    <div 
                                        key={tabId}
                                        draggable
                                        onDragStart={(e) => {
                                            dragItem.current = index;
                                            e.target.classList.add('opacity-50');
                                        }}
                                        onDragEnter={(e) => {
                                            dragOverItem.current = index;
                                        }}
                                        onDragEnd={(e) => {
                                            e.target.classList.remove('opacity-50');
                                            handleSortTabs();
                                        }}
                                        onDragOver={(e) => e.preventDefault()}
                                        onClick={() => setActiveDeckId(tabId)}
                                        className={`
                                            group flex items-center px-3 py-2 rounded-t-lg text-sm cursor-pointer select-none min-w-[140px] max-w-[220px] border-t border-x relative transition-all mt-2
                                            ${isActive 
                                                ? 'bg-white border-gray-300 shadow-sm z-10' 
                                                : 'bg-gray-200 border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700 opacity-90'}
                                        `}
                                    >
                                        <div className={getItemStyles(tabItem.type, isActive)}>
                                            <Icon name={tabItem.type === 'pdf' || tabItem.type === 'pdf_drive' ? 'fileText' : tabItem.type === 'map' ? 'share2' : tabItem.type === 'external_link' ? 'externalLink' : 'file'} size={12} className={isActive ? "text-white" : ""} />
                                        </div>
                                        <span className={`truncate flex-1 font-medium ${isActive ? 'text-gray-800' : 'text-gray-500'}`}>{tabItem.name}</span>
                                        <button 
                                            onClick={(e) => closeTab(e, tabId)}
                                            className="p-1 rounded-full hover:bg-red-100 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1 cursor-pointer"
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <Icon name="x" size={12} />
                                        </button>
                                        {tabItem._isDirty && <div className="w-2 h-2 bg-yellow-400 rounded-full absolute top-1.5 right-1.5 border border-white"></div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Header Mobile (Mantido igual) */}
                    <div className="md:hidden bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm shrink-0">
                        <span className="font-bold text-gray-700 truncate mr-2">{currentItem ? currentItem.name : "Selecione"}</span>
                        <button onClick={() => setShowQueue(!showQueue)} className="p-2 bg-gray-100 rounded"><Icon name="layers" size={20} /></button>
                    </div>

                    {/* Área Principal - RENDERIZAÇÃO PERSISTENTE */}
                    <div className="flex-1 overflow-hidden bg-white relative">
                        {tabs.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300">
                                <Icon name="layers" size={64} className="mb-4 opacity-20" />
                                <p>Selecione um arquivo para começar</p>
                            </div>
                        )}

                        {tabs.map(tabId => {
                            const tabItem = items.find(i => i.id === tabId);
                            if (!tabItem) return null;
                            const isActive = activeDeckId === tabId;

                            return (
                                <div 
                                    key={tabId} 
                                    className="w-full h-full flex flex-col p-4 overflow-y-auto"
                                    style={{ display: isActive ? 'flex' : 'none' }}
                                >
                                    {tabItem.type === 'note' ? (
                                        <NoteViewer currentItem={tabItem} updateNoteContent={updateNoteContent} onUpdateHighlights={updateNoteHighlights} />
                                    ) : tabItem.type === 'edital' ? (
                                        <EditalViewer currentItem={tabItem} updateEditalContent={updateEditalContent} updateEditalProgress={updateEditalProgress} onSmartSearch={(aula) => { setSearchTerm(aula); if(!isDesktop) setShowQueue(true); showToast('success', `Buscando: ${aula}`); }} onToggleEdit={(id, val) => setItems(p => p.map(i => i.id===id ? {...i, isEditing: val} : i))} />
                                    ) : tabItem.type === 'report' ? (
                                        <ReportViewer currentItem={tabItem} items={items} onItemClick={handleItemClick} />
                                    ) : tabItem.type === 'pdf' || tabItem.type === 'pdf_drive' ? (
                                        <PDFViewer currentItem={tabItem} onUpdateHighlights={updateNoteHighlights} onSaveHighlights={handleSaveHighlights} />
                                    ) : tabItem.type === 'video' ? (
                                        <VideoViewer currentItem={tabItem} />
                                    ) : tabItem.type === 'image' ? (
                                        <ImageViewer currentItem={tabItem} />
                                    ) : tabItem.type === 'map' ? (
                                        <MapViewer currentItem={tabItem} updateMapContent={updateMapContent} />
                                    ) : tabItem.type === 'gdrive' ? (
                                        <GDriveViewer currentItem={tabItem} />
                                    ) : (
                                        <FlashcardViewer currentItem={tabItem} currentCardIndex={currentCardIndex} isFlipped={isFlipped} onFlip={() => setIsFlipped(!isFlipped)} onNext={handleNextCard} onPrev={handlePrevCard} theme={theme} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* --- SIDEBAR (ESQUERDA) --- */}
                {/* LÓGICA DE COLAPSO ADICIONADA AQUI */}
                <div 
                    className={`
                        fixed inset-0 z-40 bg-white flex flex-col transition-all duration-300 
                        md:relative md:translate-x-0 md:border-l border-gray-200 md:order-2 h-full 
                        ${showQueue ? 'translate-x-0' : 'translate-x-full'}
                    `} 
                    style={isDesktop ? { width: showSidebar ? sidebarWidth : 0, overflow: 'hidden', whiteSpace: 'nowrap' } : {}}
                >
                    <div className="hidden md:block absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-400 z-50 transition-colors" onMouseDown={startResizing} style={{ backgroundColor: isResizing ? '#3b82f6' : 'transparent', touchAction: 'none' }} />
                    
                    <FileExplorer 
                        items={currentFolderItems}
                        allItems={items}
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
                        
                        // Creators & Actions
                        onCreateMap={handleCreateMap}
                        onCreateExternalLink={handleCreateExternalLink}
                        onOpenNewTab={handleOpenInNewTab}
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
                        onBatchCopy={() => { 
                            if(selectedIds.length > 0) {
                                setClipboard({ mode: 'copy', items: [...selectedIds] });
                                setIsSelectionMode(false);
                                setSelectedIds([]);
                                showToast('success', `${selectedIds.length} itens copiados!`);
                            }
                        }}
                        onBatchCut={() => { 
                            if(selectedIds.length > 0) {
                                setClipboard({ mode: 'cut', items: [...selectedIds] });
                                setIsSelectionMode(false);
                                setSelectedIds([]);
                                showToast('success', `${selectedIds.length} itens recortados!`);
                            }
                        }}
                        
                        // Creators
                        onCreateFolder={handleCreateFolder}
                        onCreateNote={handleCreateNote}
                        onCreateVideo={handleCreateVideo}
                        onCreateImage={handleCreateImage}
                        onCreateShortcut={handleCreateShortcut}
                        onCreateGDrive={handleCreateGDrive}
                        onCreateEdital={handleCreateEdital}
                        onCreateReport={handleCreateReport}
                        onCreatePDFDrive={handleCreatePDFDrive}
                        onCreateMultiDeck={() => setShowMultiDeckCreator(true)}
                        onImportFile={() => fileInputRef.current.click()}
                        
                        // UI
                        isGuest={isGuest}
                        onLoginClick={() => { setIsGuest(false); setUser(null); }}
                        onClose={() => setShowQueue(false)}
                        onOpenSettings={() => setShowSettings(true)}
                        onOpenStats={() => setShowStats(true)}
                    />
                    
                    {showQueue && <div className="fixed inset-0 bg-black/20 z-[-1] md:hidden backdrop-blur-sm" onClick={() => setShowQueue(false)}></div>}
                </div>

                {/* --- MODAIS (MANTIDOS IGUAIS) --- */}
                {showSettings && <SettingsModal theme={theme} setTheme={setTheme} onClose={() => setShowSettings(false)} onSave={() => { setShowSettings(false); setSaveStatus('saved'); }} />}
                {showStats && <StatsModal user={user} items={items} theme={theme} lastCloudSave={lastCloudSave} onClose={() => setShowStats(false)} onLogout={handleLogout} onSaveCloud={() => saveToCloud(items, theme)} onExport={handleExportData} onImport={() => importInputRef.current.click()} onReset={() => { if(confirm("Apagar tudo?")) { setItems([]); safeLocalStorage.clear(); setTheme(DEFAULT_THEME); setShowStats(false); } }} />}
                {showCompletionModal && <CompletionModal onFinish={finishDeck} />}
                {showFolderPicker && <FolderPickerModal items={items} currentPath={pickerCurrentPath} setCurrentPath={setPickerCurrentPath} onConfirm={(target) => { createItem('shortcut', target.name, target.id); setShowFolderPicker(false); }} onClose={() => setShowFolderPicker(false)} />}
                {showMultiDeckCreator && <MultiDeckCreatorModal items={items} currentFolderId={currentFolderId} onCreate={(newItem) => withCloud([...items, newItem])} onClose={() => setShowMultiDeckCreator(false)} showToast={showToast} />}
                
                <input type="file" accept=".csv, .txt, .pdf" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <input type="file" accept=".json" ref={importInputRef} onChange={handleImportData} className="hidden" />
            </div>
        </ErrorBoundary>
    );};
    
export default App;