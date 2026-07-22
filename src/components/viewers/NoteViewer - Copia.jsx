// src/components/viewers/NoteViewer.jsx
import React, { useState, useEffect, useRef } from 'react';
import Icon from '../ui/Icon';
import { marked } from 'marked'; 

const NoteViewer = ({ currentItem, updateNoteContent, onUpdateHighlights }) => {
    // 1. Padrão agora é 'preview' (Modo Ler)
    const [noteViewMode, setNoteViewMode] = useState('preview'); 
    const [activeHighlightTool, setActiveHighlightTool] = useState(null); 
    const [showHighlights, setShowHighlights] = useState(true);

    // Ref para manipular links
    const previewRef = useRef(null);


    // --- LÓGICA DE HISTÓRICO (UNDO/REDO) ---
    // Armazena arrays de highlights. Limite de 6 (estado atual + 5 voltas)
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Reseta histórico ao mudar de nota
    useEffect(() => {
        const initialHighlights = currentItem.highlights || [];
        setHistory([initialHighlights]);
        setHistoryIndex(0);
    }, [currentItem.id]);


// 2. Adicione este useEffect (ele faz a mágica dos links)
useEffect(() => {
    // Só roda se NÃO estiver editando e se a ref existir
    if (noteViewMode !== 'edit' && previewRef.current) {
        // Pega todos os links dentro da área de visualização
        const links = previewRef.current.querySelectorAll('a');
        
        links.forEach(link => {
            // Força abrir em nova aba
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            // Adiciona estilo visual
            link.classList.add('text-blue-600', 'hover:underline', 'cursor-pointer');
            
            // CRUCIAL: Impede que o clique no link ative o realce ou seleção da nota
            link.onclick = (e) => {
                e.stopPropagation(); 
            };
        });
    }
}, [currentItem.content, currentItem.highlights, noteViewMode]);


    // Função para adicionar novo estado ao histórico e salvar no pai
    const pushToHistoryAndSave = (newHighlights) => {
        const currentHistory = history.slice(0, historyIndex + 1);
        const newHistory = [...currentHistory, newHighlights];
        
        // Mantém no máximo 6 estados (Atual + 5 Undos)
        if (newHistory.length > 6) {
            newHistory.shift();
        }

        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1); // Aponta para o último
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            const highlightsRestored = history[newIndex];
            
            // Tenta sincronizar com o pai (Isso requer que o pai aceite 'REPLACE')
            // Se não, fica apenas na memória local até recarregar a página
            if (onUpdateHighlights) {
                // Truque: Passa uma prop especial se possível, ou apenas torce.
                // Na prática, para funcionar 100%, adicione no App.jsx:
                // if(removeId === 'REPLACE') return { ...i, highlights: h };
                onUpdateHighlights(currentItem.id, highlightsRestored, 'REPLACE'); 
            }
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            const highlightsRestored = history[newIndex];
            if (onUpdateHighlights) {
                onUpdateHighlights(currentItem.id, highlightsRestored, 'REPLACE');
            }
        }
    };

    // Mapa de cores RGB
    const colorMapRGB = {
        green: [187, 247, 208], yellow: [254, 240, 138], red: [254, 202, 202], blue: [191, 219, 254]
    };

    const blendColors = (colors) => {
        if (!colors || colors.length === 0) return 'transparent';
        if (colors.length === 1) {
            const rgb = colorMapRGB[colors[0]] || [255, 255, 255];
            return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        }
        let r = 0, g = 0, b = 0, count = 0;
        colors.forEach(c => { const rgb = colorMapRGB[c]; if (rgb) { r += rgb[0]; g += rgb[1]; b += rgb[2]; count++; } });
        if (count === 0) return 'transparent';
        return `rgb(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)})`;
    };

    const handleNoteMouseUp = (e) => {
        if (noteViewMode !== 'highlight' || !activeHighlightTool || activeHighlightTool === 'eraser') return;
        const selection = window.getSelection();
        if (selection.isCollapsed) return;
        const text = selection.toString();
        const container = e.currentTarget;
        
        try {
            const range = selection.getRangeAt(0);
            const preSelectionRange = range.cloneRange();
            preSelectionRange.selectNodeContents(container);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            const start = preSelectionRange.toString().length;
            const end = start + text.length;
    
            if (text && text.trim().length > 0) {
                const newHighlight = { id: Date.now(), text, color: activeHighlightTool, start, end };
                
                // Atualiza histórico local
                const currentHighlights = history[historyIndex] || [];
                const nextHighlights = [...currentHighlights, newHighlight];
                pushToHistoryAndSave(nextHighlights);

                // Chama pai para salvar
                onUpdateHighlights(currentItem.id, newHighlight); 
                selection.removeAllRanges();
            }
        } catch (err) { console.warn(err); }
    };

    const handleNoteClick = (e) => {
        if (noteViewMode !== 'highlight' || activeHighlightTool !== 'eraser') return;
        const target = e.target;
        const mark = target.tagName === 'MARK' ? target : target.closest('mark');
        if (mark) {
            const idsRaw = mark.getAttribute('data-highlight-ids');
            if (idsRaw) {
                try {
                    const idsToRemove = JSON.parse(idsRaw);
                    // Atualiza histórico removendo esses IDs
                    const currentHighlights = history[historyIndex] || [];
                    const nextHighlights = currentHighlights.filter(h => !idsToRemove.includes(h.id));
                    pushToHistoryAndSave(nextHighlights);

                    // Atualiza pai
                    if (Array.isArray(idsToRemove)) {
                        idsToRemove.forEach(id => onUpdateHighlights(currentItem.id, null, id));
                    }
                } catch (e) { console.error(e); }
                e.stopPropagation();
            }
        }
    };

    // Configuração do Marked
    marked.setOptions({
        gfm: true,
        breaks: true // 3. ISSO FAZ TEXTO LIMPO TER QUEBRA DE LINHA NORMAL
    });

    const processContent = (content, highlightsProp) => {
        let html = content || '';
        try { 
            // Converte Markdown para HTML (com breaks:true para texto puro funcionar)
            html = marked.parse(content || ''); 
        } catch (e) { console.error(e); }

        // Usa o histórico local se disponível para feedback instantâneo do Undo/Redo,
        // senão usa a prop (carregamento inicial)
        const activeHighlights = (history[historyIndex] !== undefined) ? history[historyIndex] : (highlightsProp || []);

        if (!activeHighlights || activeHighlights.length === 0 || !showHighlights) return html;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const textNodes = [];
        const walk = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
        let n;
        while(n = walk.nextNode()) textNodes.push(n);

        const validHighlights = activeHighlights.filter(h => typeof h.start === 'number');
        let currentGlobalOffset = 0;

        textNodes.forEach(node => {
            const nodeText = node.nodeValue;
            const nodeLength = nodeText.length;
            const nodeStart = currentGlobalOffset;
            const nodeEnd = nodeStart + nodeLength;

            const relevant = validHighlights.filter(h => h.start < nodeEnd && h.end > nodeStart);

            if (relevant.length > 0) {
                const fragment = document.createDocumentFragment();
                const boundaries = new Set([0, nodeLength]);
                relevant.forEach(h => {
                    boundaries.add(Math.max(0, h.start - nodeStart));
                    boundaries.add(Math.min(nodeLength, h.end - nodeStart));
                });
                const sortedPoints = Array.from(boundaries).sort((a, b) => a - b);

                for (let i = 0; i < sortedPoints.length - 1; i++) {
                    const p1 = sortedPoints[i];
                    const p2 = sortedPoints[i+1];
                    const segmentText = nodeText.slice(p1, p2);
                    if (!segmentText) continue;

                    const midGlobal = nodeStart + (p1 + p2) / 2;
                    const activeH = relevant.filter(h => h.start <= midGlobal && h.end > midGlobal);

                    if (activeH.length > 0) {
                        const mark = document.createElement('mark');
                        mark.textContent = segmentText;
                        mark.style.backgroundColor = blendColors(activeH.map(h => h.color));
                        mark.style.color = 'inherit';
                        mark.style.padding = '0';
                        mark.style.borderRadius = '0';
                        mark.dataset.highlightIds = JSON.stringify(activeH.map(h => h.id));
                        fragment.appendChild(mark);
                    } else {
                        fragment.appendChild(document.createTextNode(segmentText));
                    }
                }
                if (node.parentNode) node.parentNode.replaceChild(fragment, node);
            }
            currentGlobalOffset += nodeLength;
        });
        return tempDiv.innerHTML;
    };

    return (
        <div className={`w-full max-w-4xl flex-1 flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-0 relative ${noteViewMode === 'highlight' ? 'mode-highlight' : ''}`}>
            <div className="bg-gray-50 border-b p-3 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 font-semibold text-gray-700">
                    <Icon name="fileText" size={18} className="text-blue-500" />
                    {currentItem.name}
                </div>
                <div className="flex items-center gap-2">
                    {/* Controles de Visualização e Histórico */}
                    {noteViewMode !== 'edit' && (
                        <div className="flex items-center mr-3 bg-white border rounded-lg p-1 shadow-sm">
                            <button 
                                onClick={() => setShowHighlights(!showHighlights)} 
                                className={`p-1 rounded transition-colors ${showHighlights ? 'text-blue-600' : 'text-gray-400'}`}
                                title={showHighlights ? "Ocultar Realces" : "Mostrar Realces"}
                            >
                                <Icon name={showHighlights ? "eye" : "eyeOff"} size={16} />
                            </button>
                            
                            {/* Divisória */}
                            <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>

                            {/* Botão Voltar (Undo) */}
                            <button 
                                onClick={handleUndo}
                                disabled={historyIndex <= 0}
                                className={`p-1 rounded transition-colors ${historyIndex > 0 ? 'text-gray-600 hover:bg-gray-100 hover:text-blue-600' : 'text-gray-300 cursor-not-allowed'}`}
                                title="Desfazer Realce"
                            >
                                <Icon name="rotateCcw" size={16} />
                            </button>

                            {/* Botão Avançar (Redo) */}
                            <button 
                                onClick={handleRedo}
                                disabled={historyIndex >= history.length - 1}
                                className={`p-1 rounded transition-colors ${historyIndex < history.length - 1 ? 'text-gray-600 hover:bg-gray-100 hover:text-blue-600' : 'text-gray-300 cursor-not-allowed'}`}
                                title="Refazer Realce"
                            >
                                <Icon name="rotateCw" size={16} />
                            </button>
                        </div>
                    )}

                    {/* Paleta de Cores */}
                    {noteViewMode === 'highlight' && (
                        <div className="flex items-center gap-1 mr-2 bg-white border rounded-lg p-1 shadow-sm animate-in fade-in zoom-in duration-200">
                            {['green', 'yellow', 'red', 'blue'].map(color => (
                                <button 
                                    key={color} 
                                    onClick={() => setActiveHighlightTool(color)} 
                                    className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${activeHighlightTool === color ? `ring-2 ring-${color}-400 scale-110 border-${color}-500` : 'border-gray-200 hover:scale-105'}`} 
                                    style={{ backgroundColor: `rgb(${colorMapRGB[color].join(',')})` }}
                                ></button>
                            ))}
                            <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
                            <button onClick={() => setActiveHighlightTool('eraser')} className={`p-1 rounded transition-all ${activeHighlightTool === 'eraser' ? 'bg-gray-800 text-white shadow-inner' : 'text-gray-500 hover:bg-gray-100'}`} title="Borracha"><Icon name="eraser" size={16} /></button>
                        </div>
                    )}
                    
                    {/* Botões de Modo */}
                    <div className="flex bg-gray-200 p-0.5 rounded-lg">
                        <button onClick={() => setNoteViewMode('edit')} className={`p-1.5 rounded-md transition-all flex items-center gap-1 text-xs font-medium ${noteViewMode === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Icon name="edit2" size={14} /> <span className="hidden sm:inline">Editar</span></button>
                        <button onClick={() => setNoteViewMode('preview')} className={`p-1.5 rounded-md transition-all flex items-center gap-1 text-xs font-medium ${noteViewMode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Icon name="fileText" size={14} /> <span className="hidden sm:inline">Ler</span></button>
                        <button onClick={() => { setNoteViewMode('highlight'); setActiveHighlightTool('yellow'); setShowHighlights(true); }} className={`p-1.5 rounded-md transition-all flex items-center gap-1 text-xs font-medium ${noteViewMode === 'highlight' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Icon name="highlighter" size={14} /> <span className="hidden sm:inline">Realçar</span></button>
                    </div>
                </div>
            </div>

            {noteViewMode === 'edit' ? (
                <textarea 
                    className="flex-1 p-6 w-full resize-none focus:outline-none text-gray-700 font-mono text-sm leading-relaxed" 
                    value={currentItem.content || ''} 
                    onChange={(e) => updateNoteContent(currentItem.id, e.target.value)} 
                    placeholder="Digite seu texto (Markdown ou Normal)..."
                ></textarea>
            ) : (
                <div 
                    ref={previewRef} // <--- ADICIONE ISSO AQUI
                    className="flex-1 p-8 overflow-y-auto custom-scroll markdown-preview bg-white relative"
                    onMouseUp={handleNoteMouseUp}
                    onClick={handleNoteClick}
                    style={{cursor: noteViewMode === 'highlight' ? (activeHighlightTool === 'eraser' ? 'crosshair' : 'text') : 'default'}}
                    dangerouslySetInnerHTML={{ __html: processContent(currentItem.content, currentItem.highlights) }}
                ></div>
            )}
        </div>
    );
};

export default NoteViewer;