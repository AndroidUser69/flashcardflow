import { dbHelper } from './dbHelper'; // Assumindo que dbHelper está em utils

export const getEmbedUrl = (url) => {
    if (!url) return '';
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(youtubeRegex);
    if (match && match[1]) return `https://www.youtube.com/embed/${match[1]}`;
    return url;
};

export const getHostname = (url) => { try { return new URL(url).hostname.replace('www.', ''); } catch (e) { return 'url'; } };

export const readFileAsText = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = (e) => resolve(e.target.result); r.onerror = reject; r.readAsText(file); });

export const parseCSV = (text) => { const lines = text.split('\n').filter(l => l.trim() !== ''); const parseLine = (t) => { const res = []; let cell = ''; let q = false; for(let i=0;i<t.length;i++){ if(t[i]==='"'){ if(q && t[i+1]==='"'){cell+='"';i++}else{q=!q} } else if(t[i]===',' && !q){ res.push(cell.trim()); cell='' } else cell+=t[i]; } res.push(cell.trim()); return res; }; return lines.map((l,i) => { const p = parseLine(l); if(p.length<2 || (i===0 && p[0].toLowerCase().includes('pergunta'))) return null; return { front: p[0], back: p[1] }; }).filter(Boolean); };

export const sanitizeItems = (rawItems) => {
    if (!Array.isArray(rawItems)) return [];
    return rawItems.map(item => { 
        const baseItem = { ...item, views: item.views || 0, highlights: item.highlights || [] };
        if (item.type === 'deck') { 
            return { ...baseItem, cards: Array.isArray(item.cards) ? item.cards : [], progress: Number(item.progress) || 0, completions: Number(item.completions) || 0 }; 
        } 
        return baseItem; 
    });
};

// --- LÓGICA DE PROGRESSO DO EDITAL (Trazida do original) ---
export const calculateEditalProgress = (item) => { 
    if (!item.content) return 0; 
    let total = 0; 
    let lidoCount = 0; 
    try { 
        const data = JSON.parse(item.content); 
        if (data.disciplinas) { 
            data.disciplinas.forEach(d => { 
                if (d.itens) { 
                    d.itens.forEach(i => { 
                        total++; 
                        const p = item.progressMap?.[d.id]?.[i.path]; 
                        const isLido = typeof p === 'boolean' ? p : (p?.lido || false); 
                        if (isLido) lidoCount++; 
                    }); 
                } 
            }); 
        } 
    } catch (e) { return 0; } 
    return total > 0 ? Math.round((lidoCount / total) * 100) : 0; 
};

// --- LÓGICA DE CÓPIA RECURSIVA (CRUCIAL) ---
export const copyItemRecursively = (originalItemId, newParentId, allItems) => {
    const originalItem = allItems.find(i => i.id === originalItemId);
    if (!originalItem) return [];

    const newId = Date.now().toString() + Math.random();
    const newItem = { 
        ...originalItem, 
        id: newId, 
        parentId: newParentId, 
        name: newParentId === originalItem.parentId ? originalItem.name + ' (Cópia)' : originalItem.name, 
        views: 0,
        _isDirty: true // Marca para salvar na nuvem
    };
    
    if (newItem.type === 'deck') { newItem.progress = 0; newItem.completions = 0; }

    let createdItems = [newItem];

    // Se for pasta, copia filhos recursivamente
    if (originalItem.type === 'folder') {
        const children = allItems.filter(c => c.parentId === originalItemId);
        children.forEach(child => {
            createdItems = [...createdItems, ...copyItemRecursively(child.id, newId, allItems)];
        });
    }

    return createdItems;
};