// src/components/viewers/NoteViewer.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Icon from '../ui/Icon';
import { marked } from 'marked'; 
import { dbHelper } from '../../utils/dbHelper';

const snapToWord = (text, start, end) => {
    if (!text || start >= text.length) return { start, end };
    let wordStart = start;
    while (wordStart > 0 && /\w/.test(text[wordStart])) wordStart--;
    if (wordStart > 0 && /\w/.test(text[wordStart])) wordStart--;
    if (!/\w/.test(text[wordStart]) && wordStart < start) wordStart++;
    if (wordStart === start && !/\w/.test(text[start])) {
        while (wordStart > 0 && !/\w/.test(text[wordStart - 1])) wordStart--;
        while (wordStart > 0 && /\w/.test(text[wordStart - 1])) wordStart--;
        if (wordStart > 0 && !/\w/.test(text[wordStart])) wordStart++;
    }
    let wordEnd = end;
    while (wordEnd < text.length && /\w/.test(text[wordEnd])) wordEnd++;
    if (end - start <= 1 && wordEnd - wordStart > 1) return { start: wordStart, end: wordEnd };
    if (wordStart <= start && wordEnd >= end && (wordEnd - wordStart) > (end - start)) return { start: wordStart, end: wordEnd };
    return { start, end };
};

const colorMapRGB = { green: [187, 247, 208], yellow: [254, 240, 138], red: [254, 202, 202], blue: [191, 219, 254] };
const blendColors = (colors) => {
    if (!colors || colors.length === 0) return 'transparent';
    if (colors.length === 1) { const rgb = colorMapRGB[colors[0]] || [255, 255, 255]; return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`; }
    let r = 0, g = 0, b = 0, count = 0;
    colors.forEach(c => { const rgb = colorMapRGB[c]; if (rgb) { r += rgb[0]; g += rgb[1]; b += rgb[2]; count++; } });
    if (count === 0) return 'transparent';
    return `rgb(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)})`;
};

// Formatos Markdown disponíveis
const markdownCommands = [
    { label: 'Negrito', syntax: '**texto**', icon: 'bold', desc: '**Negrito**' },
    { label: 'Itálico', syntax: '*texto*', icon: 'italic', desc: '*Itálico*' },
    { label: 'Título H1', syntax: '# Título', icon: 'hash', desc: 'Título grande' },
    { label: 'Título H2', syntax: '## Título', icon: 'hash', desc: 'Subtítulo' },
    { label: 'Título H3', syntax: '### Título', icon: 'hash', desc: 'Sub-subtítulo' },
    { label: 'Lista', syntax: '- item', icon: 'list', desc: 'Lista não ordenada' },
    { label: 'Lista Numerada', syntax: '1. item', icon: 'list', desc: 'Lista ordenada' },
    { label: 'Citação', syntax: '> citação', icon: 'quote', desc: 'Bloco de citação' },
    { label: 'Código', syntax: '```\ncódigo\n```', icon: 'code2', desc: 'Bloco de código' },
    { label: 'Código Inline', syntax: '`código`', icon: 'code', desc: 'Código na linha' },
    { label: 'Linha Horizontal', syntax: '---', icon: 'separatorHorizontal', desc: 'Separador' },
    { label: 'Link', syntax: '[texto](url)', icon: 'link2', desc: 'Link clicável' },
    { label: 'Imagem', syntax: '![alt](url)', icon: 'imageIcon', desc: 'Inserir imagem' },
    { label: 'Tabela', syntax: '| Col1 | Col2 |', icon: 'table', desc: 'Tabela simples' },
    { label: 'Parágrafo', syntax: '\n\n', icon: 'pilcrow', desc: 'Quebra de parágrafo' },
];

const NoteViewer = ({ currentItem, updateNoteContent, onUpdateHighlights }) => {
    const [noteViewMode, setNoteViewMode] = useState('preview');
    const [activeHighlightTool, setActiveHighlightTool] = useState(null);
    const [showHighlights, setShowHighlights] = useState(true);
    const [continuousMode, setContinuousMode] = useState(false);
    const [tempHighlight, setTempHighlight] = useState(null);
    const [, setNoteContent] = useState(currentItem.content || '');
    const [, setIsLoadingContent] = useState(false);
    const previewRef = useRef(null);
    const ghostLayerRef = useRef(null);
    const isDragging = useRef(false);
    const dragStartOffset = useRef(0);
    const dragEndOffset = useRef(0);
    const textareaRef = useRef(null);
    const headerScrollRef = useRef(null);

    // Estado para tamanho da fonte no modo Ler
    const [fontSize, setFontSize] = useState(() => {
        try { return parseInt(localStorage.getItem('note_font_size')) || 16; } 
        catch { /* ignore */ return 16; }
    });
    const FONT_MIN = 10;
    const FONT_MAX = 36;
    const FONT_STEP = 2;

    // Estados para o Menu de Comandos Markdown (Modo Editar)
    const [showMarkdownMenu, setShowMarkdownMenu] = useState(false);
    const markdownMenuRef = useRef(null);

    // Estados para o Modo Notas (Anotações flutuantes)
    const [notesModeActive, setNotesModeActive] = useState(false);
    const [annotations, setAnnotations] = useState(() => currentItem.annotations || []);
    const [activeAnnotation, setActiveAnnotation] = useState(null);
    const [newAnnotationText, setNewAnnotationText] = useState('');
    const [balloonVisible, setBalloonVisible] = useState(false);
    const [balloonPos, setBalloonPos] = useState({ x: 0, y: 0 });
    const [, setEditingAnnotation] = useState(false);
    const balloonRef = useRef(null);
    const noteInputRef = useRef(null);

    // Estado para o menu de exportação
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef(null);

    // --- CONTADOR DE PÁGINAS EM TEMPO REAL (useMemo) ---
    const pageStats = useMemo(() => {
        const text = currentItem?.content || '';
        const caracteres = text.length;
        // Conta palavras corretamente
        const palavras = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
        // Fórmula Word padrão: ~250 palavras por página (Arial 11, espaçamento simples)
        const paginasWord = Math.max(1, Math.ceil(palavras / 250));
        return { caracteres, palavras, paginasWord };
    }, [currentItem?.content]);

    // Fechar menus ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (markdownMenuRef.current && !markdownMenuRef.current.contains(e.target)) {
                setShowMarkdownMenu(false);
            }
            if (balloonRef.current && !balloonRef.current.contains(e.target) && !e.target.closest('.annotation-marker')) {
                setBalloonVisible(false);
                setActiveAnnotation(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const prevNoteIdRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        const loadContent = async () => {
            if (currentItem.content !== undefined && currentItem.content !== null) { setNoteContent(currentItem.content); return; }
            setIsLoadingContent(true);
            try {
                if (dbHelper && dbHelper.getNoteContent) { const content = await dbHelper.getNoteContent(currentItem.id); if (isMounted) setNoteContent(content || ''); }
            } catch (err) { console.error("Erro ao carregar conteúdo da nota:", err); if (isMounted) setNoteContent(''); }
            finally { if (isMounted) setIsLoadingContent(false); }
        };
        loadContent();
        return () => { isMounted = false; };
    }, [currentItem.id, currentItem.content]);

    const clearGhostLayer = useCallback(() => {
        if (ghostLayerRef.current) ghostLayerRef.current.innerHTML = '';
    }, []);

    useEffect(() => {
        if (prevNoteIdRef.current !== currentItem.id) {
            prevNoteIdRef.current = currentItem.id;
            const initialHighlights = currentItem.highlights || [];
            setHistory([initialHighlights]);
            setHistoryIndex(0);
            setTempHighlight(null);
            clearGhostLayer();
            setAnnotations(currentItem.annotations || []);
            setBalloonVisible(false);
            setActiveAnnotation(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentItem.id, currentItem.highlights, clearGhostLayer]);

    useEffect(() => {
        if (noteViewMode !== 'edit' && previewRef.current) {
            const links = previewRef.current.querySelectorAll('a');
            links.forEach(link => {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
                link.classList.add('text-blue-600', 'hover:underline', 'cursor-pointer');
                link.onclick = (e) => e.stopPropagation();
            });
        }
    }, [currentItem.content, currentItem.highlights, noteViewMode, annotations]);

    const pushToHistoryAndSave = useCallback((newHighlights) => {
        setHistory(prev => {
            const currentHistory = prev.slice(0, historyIndex + 1);
            const newHistory = [...currentHistory, newHighlights];
            if (newHistory.length > 6) newHistory.shift();
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 5));
    }, [historyIndex]);

    const handleUndo = () => {
        if (historyIndex > 0) { const newIndex = historyIndex - 1; setHistoryIndex(newIndex); if (onUpdateHighlights) onUpdateHighlights(currentItem.id, history[newIndex], 'REPLACE'); }
    };
    const handleRedo = () => {
        if (historyIndex < history.length - 1) { const newIndex = historyIndex + 1; setHistoryIndex(newIndex); if (onUpdateHighlights) onUpdateHighlights(currentItem.id, history[newIndex], 'REPLACE'); }
    };

    const getTextOffsetFromPoint = useCallback((container, x, y) => {
        if (!container) return null;
        if (document.caretPositionFromPoint) { const pos = document.caretPositionFromPoint(x, y); if (pos) { const preRange = document.createRange(); preRange.selectNodeContents(container); preRange.setEnd(pos.offsetNode, pos.offset); return preRange.toString().length; } }
        if (document.caretRangeFromPoint) { const range = document.caretRangeFromPoint(x, y); if (range) { const preRange = document.createRange(); preRange.selectNodeContents(container); preRange.setEnd(range.startContainer, range.startOffset); return preRange.toString().length; } }
        return null;
    }, []);

    const showGhostLayer = useCallback((startOffset, endOffset) => {
        const container = previewRef.current;
        const layer = ghostLayerRef.current;
        if (!container || !layer) return;
        
        if (startOffset === endOffset) { clearGhostLayer(); return; }
        
        const sortedStart = Math.min(startOffset, endOffset);
        const sortedEnd = Math.max(startOffset, endOffset);
        const fullText = container.textContent || '';
        const snapped = snapToWord(fullText, sortedStart, sortedEnd);
        if (snapped.start === snapped.end) { clearGhostLayer(); return; }
        
        try {
            const textNodes = [];
            const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            let n;
            while ((n = walk.nextNode())) textNodes.push(n);
            
            let globalOffset = 0;
            let startNode = null, startOff = 0, endNode = null, endOff = 0;
            
            for (const node of textNodes) {
                const nodeLen = node.nodeValue.length;
                const nodeEnd = globalOffset + nodeLen;
                if (!startNode && snapped.start >= globalOffset && snapped.start <= nodeEnd) { startNode = node; startOff = snapped.start - globalOffset; }
                if (!endNode && snapped.end >= globalOffset && snapped.end <= nodeEnd) { endNode = node; endOff = snapped.end - globalOffset; }
                globalOffset += nodeLen;
            }
            
            if (startNode && endNode) {
                const range = document.createRange();
                range.setStart(startNode, startOff);
                range.setEnd(endNode, endOff);
                const rects = range.getClientRects();
                const containerRect = container.getBoundingClientRect();
                
                layer.innerHTML = '';
                for (let i = 0; i < rects.length; i++) {
                    const rect = rects[i];
                    const ghost = document.createElement('div');
                    ghost.className = 'ghost-highlight';
                    ghost.style.cssText = `position:absolute;left:${rect.left - containerRect.left}px;top:${rect.top - containerRect.top - container.scrollTop}px;width:${rect.width}px;height:${rect.height}px;background-color:${blendColors([activeHighlightTool])};opacity:0.5;pointer-events:none;border-radius:3px;transition:none;`;
                    layer.appendChild(ghost);
                }
            }
        } catch { /* ignorado */ }
    }, [activeHighlightTool, clearGhostLayer]);
    
    const applyHighlightFromRange = useCallback((startOffset, endOffset) => {
        if (!activeHighlightTool || activeHighlightTool === 'eraser' || !previewRef.current) return;
        const fullText = previewRef.current.textContent || '';
        if (startOffset === endOffset) return;
        const sortedStart = Math.min(startOffset, endOffset);
        const sortedEnd = Math.max(startOffset, endOffset);
        const snapped = snapToWord(fullText, sortedStart, sortedEnd);
        const text = fullText.slice(snapped.start, snapped.end);
        if (!text || text.trim().length === 0) return;
        const newHighlight = { id: Date.now(), text, color: activeHighlightTool, start: snapped.start, end: snapped.end };
        const currentHighlights = history[historyIndex] || [];
        const nextHighlights = [...currentHighlights, newHighlight];
        pushToHistoryAndSave(nextHighlights);
        onUpdateHighlights(currentItem.id, newHighlight);
    }, [activeHighlightTool, history, historyIndex, currentItem.id, onUpdateHighlights, pushToHistoryAndSave]);

    // --- FUNÇÕES DO MODO NOTAS ---
    const _applyAnnotation = useCallback((startOffset, endOffset) => {
        if (!previewRef.current) return;
        const fullText = previewRef.current.textContent || '';
        if (startOffset === endOffset) return;
        const sortedStart = Math.min(startOffset, endOffset);
        const sortedEnd = Math.max(startOffset, endOffset);
        const snapped = snapToWord(fullText, sortedStart, sortedEnd);
        const text = fullText.slice(snapped.start, snapped.end);
        if (!text || text.trim().length === 0) return;

        const existing = annotations.find(a => 
            Math.abs(a.start - snapped.start) < 5 && Math.abs(a.end - snapped.end) < 5
        );
        if (existing) {
            setActiveAnnotation(existing);
            setNewAnnotationText(existing.note || '');
            setBalloonVisible(true);
            setEditingAnnotation(true);
            setTimeout(() => {
                if (noteInputRef.current) noteInputRef.current.focus();
            }, 100);
            return;
        }

        const newAnno = { 
            id: Date.now().toString() + Math.random(), 
            text: text, 
            start: snapped.start, 
            end: snapped.end,
            note: ''
        };
        const updatedAnnotations = [...annotations, newAnno];
        setAnnotations(updatedAnnotations);
        
        setActiveAnnotation(newAnno);
        setNewAnnotationText('');
        setBalloonVisible(true);
        setEditingAnnotation(true);
        setTimeout(() => {
            if (noteInputRef.current) noteInputRef.current.focus();
        }, 100);

        if (onUpdateHighlights && currentItem && currentItem.id) {
            onUpdateHighlights(currentItem.id, null, null, { annotations: updatedAnnotations });
        }
        window.getSelection().removeAllRanges();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [annotations, previewRef, onUpdateHighlights, currentItem?.id]);

    const persistAnnotations = useCallback((updatedAnns) => {
        if (!currentItem || !currentItem.id) return;
        if (onUpdateHighlights) {
            onUpdateHighlights(currentItem.id, null, null, { annotations: updatedAnns });
        }
    }, [currentItem, onUpdateHighlights]);

    const updateAnnotationNote = (annoId, noteText) => {
        const updated = annotations.map(a => 
            a.id === annoId ? { ...a, note: noteText } : a
        );
        setAnnotations(updated);
        persistAnnotations(updated);
    };

    const deleteAnnotation = (annoId) => {
        const updated = annotations.filter(a => a.id !== annoId);
        setAnnotations(updated);
        setBalloonVisible(false);
        setActiveAnnotation(null);
        persistAnnotations(updated);
    };

    const handleAnnotationCreate = () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        const text = selection.toString();
        if (!text || text.trim().length === 0) return;
        const container = previewRef.current;
        if (!container || !container.contains(selection.anchorNode)) return;
        
        try {
            const range = selection.getRangeAt(0);
            const preSelectionRange = range.cloneRange();
            preSelectionRange.selectNodeContents(container);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            const start = preSelectionRange.toString().length;
            const rawEnd = start + text.length;
            const fullText = container.textContent || '';
            const snapped = snapToWord(fullText, start, rawEnd);
            
            if (fullText.slice(snapped.start, snapped.end).trim().length === 0) return;
            
            const existing = annotations.find(a => 
                Math.abs(a.start - snapped.start) < 5 && Math.abs(a.end - snapped.end) < 5
            );
            if (existing) {
                setActiveAnnotation(existing);
                setNewAnnotationText(existing.note || '');
                setBalloonVisible(true);
                setEditingAnnotation(true);
                setTimeout(() => {
                    if (noteInputRef.current) noteInputRef.current.focus();
                }, 100);
                selection.removeAllRanges();
                return;
            }

            const newAnno = {
                id: Date.now().toString() + Math.random(),
                text: fullText.slice(snapped.start, snapped.end),
                start: snapped.start,
                end: snapped.end,
                note: ''
            };
            const updated = [...annotations, newAnno];
            setAnnotations(updated);
            setActiveAnnotation(newAnno);
            setNewAnnotationText('');
            setBalloonVisible(true);
            setEditingAnnotation(true);
            setTimeout(() => {
                if (noteInputRef.current) noteInputRef.current.focus();
            }, 100);
            persistAnnotations(updated);
            selection.removeAllRanges();
        } catch (err) { console.warn(err); }
    };

    const handleAnnotatedTextClick = (e, anno) => {
        e.stopPropagation();
        setActiveAnnotation(anno);
        setNewAnnotationText(anno.note || '');
        setBalloonVisible(true);
        setEditingAnnotation(true);
        
        const rect = e.target.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const balloonW = 384;
        const balloonH = 350;
        let x = rect.left + rect.width / 2;
        let y = rect.top - 10;
        
        x = Math.max(balloonW / 2 + 10, Math.min(vw - balloonW / 2 - 10, x));
        y = Math.min(y, vh - balloonH);
        
        setBalloonPos({ x, y });
        
        setTimeout(() => {
            if (noteInputRef.current) noteInputRef.current.focus();
        }, 100);
    };

    // --- EVENTOS DE MOUSE (PC) ---
    const handleMouseDown = (e) => {
        if (noteViewMode === 'highlight') {
            if (!activeHighlightTool || activeHighlightTool === 'eraser' || !continuousMode) return;
            isDragging.current = true;
            const offset = getTextOffsetFromPoint(e.currentTarget, e.clientX, e.clientY);
            if (offset !== null) { dragStartOffset.current = offset; dragEndOffset.current = offset; }
            e.preventDefault();
        }
    };
    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        if (noteViewMode !== 'highlight') return;
        const offset = getTextOffsetFromPoint(e.currentTarget, e.clientX, e.clientY);
        if (offset !== null) {
            dragEndOffset.current = offset;
            const fullText = e.currentTarget.textContent || '';
            if (dragStartOffset.current !== offset) {
                const s = Math.min(dragStartOffset.current, offset);
                const en = Math.max(dragStartOffset.current, offset);
                const snapped = snapToWord(fullText, s, en);
                const txt = fullText.slice(snapped.start, snapped.end);
                if (txt && txt.trim().length > 0 && activeHighlightTool && activeHighlightTool !== 'eraser') {
                    setTempHighlight({ id: 'temp', text: txt, color: activeHighlightTool, start: snapped.start, end: snapped.end });
                } else {
                    setTempHighlight(null);
                }
            }
        }
    };
    const handleMouseUp = (e) => {
        if (isDragging.current) {
            isDragging.current = false;
            if (noteViewMode === 'highlight') {
                applyHighlightFromRange(dragStartOffset.current, dragEndOffset.current);
                setTempHighlight(null);
            }
            window.getSelection().removeAllRanges();
            return;
        }
        
        if (noteViewMode === 'highlight' && !continuousMode) {
            if (!activeHighlightTool || activeHighlightTool === 'eraser') return;
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
                const rawEnd = start + text.length;
                const fullText = container.textContent || '';
                const snapped = snapToWord(fullText, start, rawEnd);
                if (text && text.trim().length > 0) {
                    const newHighlight = { id: Date.now(), text: fullText.slice(snapped.start, snapped.end), color: activeHighlightTool, start: snapped.start, end: snapped.end };
                    const curHigh = history[historyIndex] || [];
                    const nextHigh = [...curHigh, newHighlight];
                    pushToHistoryAndSave(nextHigh);
                    onUpdateHighlights(currentItem.id, newHighlight);
                    selection.removeAllRanges();
                }
            } catch (err) { console.warn(err); }
            return;
        }

        if ((noteViewMode === 'preview' || noteViewMode === 'highlight') && notesModeActive) {
            if (e.target.closest('.annotation-baloon') || e.target.closest('.annotation-marker')) {
                return;
            }
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed) {
                const text = selection.toString();
                if (text && text.trim().length > 0) {
                    handleAnnotationCreate();
                }
            }
        }
    };

    // --- EVENTOS DE TOUCH (Mobile) ---
    const handleTouchStart = (e) => {
        if (e.touches.length !== 1) return;
        if (noteViewMode !== 'highlight' || !activeHighlightTool || activeHighlightTool === 'eraser' || !continuousMode) return;
        const touch = e.touches[0];
        const offset = getTextOffsetFromPoint(e.currentTarget, touch.clientX, touch.clientY);
        if (offset !== null) { isDragging.current = true; dragStartOffset.current = offset; dragEndOffset.current = offset; }
    };
    const handleTouchMove = (e) => {
        if (!isDragging.current) return;
        if (e.touches.length !== 1) {
            isDragging.current = false;
            clearGhostLayer();
            return;
        }
        e.preventDefault();
        const touch = e.touches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (el && previewRef.current && previewRef.current.contains(el)) {
            const offset = getTextOffsetFromPoint(previewRef.current, touch.clientX, touch.clientY);
            if (offset !== null) {
                dragEndOffset.current = offset;
                showGhostLayer(dragStartOffset.current, offset);
            }
        }
    };
    const handleTouchEnd = () => {
        if (isDragging.current) {
            isDragging.current = false;
            clearGhostLayer();
            if (noteViewMode === 'highlight') {
                applyHighlightFromRange(dragStartOffset.current, dragEndOffset.current);
            }
            window.getSelection().removeAllRanges();
        }
    };

    const handleNoteClick = (e) => {
        const marker = e.target.closest('.annotation-marker');
        if (marker && marker.dataset && marker.dataset.annotationId) {
            const annoId = marker.dataset.annotationId;
            const anno = annotations.find(a => a.id === annoId);
            if (anno) {
                handleAnnotatedTextClick(e, anno);
                return;
            }
        }

        if (noteViewMode !== 'highlight' || activeHighlightTool !== 'eraser') return;
        const target = e.target;
        const mark = target.tagName === 'MARK' ? target : target.closest('mark');
        if (mark) {
            const idsRaw = mark.getAttribute('data-highlight-ids');
            if (idsRaw) {
                try {
                    const idsToRemove = JSON.parse(idsRaw);
                    const currentHighlights = history[historyIndex] || [];
                    const nextHighlights = currentHighlights.filter(h => !idsToRemove.includes(h.id));
                    pushToHistoryAndSave(nextHighlights);
                    if (Array.isArray(idsToRemove)) idsToRemove.forEach(id => onUpdateHighlights(currentItem.id, null, id));
                } catch (e) { console.error(e); }
                e.stopPropagation();
            }
        }
    };

    // Funções para o menu de comandos Markdown
    const insertMarkdown = (syntax) => {
        if (!textareaRef.current) return;
        const ta = textareaRef.current;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const text = ta.value;
        const selectedText = text.substring(start, end);
        
        let newText, cursorPos;
        
        if (syntax === '**texto**') {
            newText = text.substring(0, start) + '**' + (selectedText || 'texto') + '**' + text.substring(end);
            cursorPos = start + 2 + (selectedText ? selectedText.length : 4);
        } else if (syntax === '*texto*') {
            newText = text.substring(0, start) + '*' + (selectedText || 'texto') + '*' + text.substring(end);
            cursorPos = start + 1 + (selectedText ? selectedText.length : 4);
        } else if (syntax === '`código`') {
            newText = text.substring(0, start) + '`' + (selectedText || 'código') + '`' + text.substring(end);
            cursorPos = start + 1 + (selectedText ? selectedText.length : 5);
        } else if (syntax === '[texto](url)') {
            newText = text.substring(0, start) + '[' + (selectedText || 'texto') + '](url)' + text.substring(end);
            cursorPos = start + 1 + (selectedText ? selectedText.length : 5);
        } else if (syntax === '![alt](url)') {
            newText = text.substring(0, start) + '![alt](url)' + text.substring(end);
            cursorPos = start + 10;
        } else if (syntax === '| Col1 | Col2 |') {
            newText = text.substring(0, start) + '| Col1 | Col2 |\n|------|------|\n|      |      |' + text.substring(end);
            cursorPos = start + 8;
        } else if (syntax === '---') {
            newText = text.substring(0, start) + '\n---\n' + text.substring(end);
            cursorPos = start + 6;
        } else if (syntax === '\n\n') {
            newText = text.substring(0, start) + '\n\n' + text.substring(end);
            cursorPos = start + 2;
        } else {
            const prefix = syntax.split(' ')[0];
            newText = text.substring(0, start) + prefix + ' ' + (selectedText || syntax) + text.substring(end);
            cursorPos = start + prefix.length + 1 + (selectedText ? selectedText.length : syntax.length);
        }
        
        updateNoteContent(currentItem.id, newText);
        setShowMarkdownMenu(false);
        
        setTimeout(() => {
            ta.focus();
            ta.selectionStart = cursorPos;
            ta.selectionEnd = cursorPos;
        }, 50);
    };

    const _handleInsertAnnotation = () => {
        if (!notesModeActive) return;
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && previewRef.current && previewRef.current.contains(selection.anchorNode)) {
            handleAnnotationCreate();
        }
    };

    // --- FUNÇÕES DE EXPORTAÇÃO ---

    // Exportar como .md
    const exportMarkdown = () => {
        const content = currentItem?.content || '';
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentItem?.name || 'nota'}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    // Exportar como .docx (usando a lib docx)
    const exportDocx = async () => {
        try {
            const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell } = await import('docx');
            
            const content = currentItem?.content || '';
            const lines = content.split('\n');
            const children = [];
            
            let inCodeBlock = false;
            let codeBuffer = '';
            
            for (const line of lines) {
                // Código em bloco
                if (line.trim().startsWith('```')) {
                    if (inCodeBlock) {
                        children.push(
                            new Paragraph({
                                children: [new TextRun({ text: codeBuffer, font: 'Courier New', size: 20 })],
                                spacing: { before: 200, after: 200 },
                                indent: { left: 400 }
                            })
                        );
                        codeBuffer = '';
                        inCodeBlock = false;
                    } else {
                        inCodeBlock = true;
                    }
                    continue;
                }
                
                if (inCodeBlock) {
                    codeBuffer += line + '\n';
                    continue;
                }
                
                // Tabela
                if (line.trim().startsWith('|') && line.trim().endsWith('|') && line.includes('|')) {
                    const cells = line.split('|').filter(c => c.trim());
                    // Pular linha de formatação da tabela (ex: |---|----|)
                    if (cells.length > 0 && cells[0].trim().startsWith('-')) continue;
                    
                    const rowCells = cells.map(c => 
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: c.trim(), size: 20 })] })]
                        })
                    );
                    children.push(
                        new Table({
                            rows: [new TableRow({ children: rowCells })],
                            width: { size: 100, type: 'pct' }
                        })
                    );
                    continue;
                }
                
                // Cabeçalhos
                if (line.trim().startsWith('### ')) {
                    children.push(new Paragraph({ children: [new TextRun({ text: line.trim().replace('### ', ''), bold: true, size: 28 })], spacing: { before: 200 } }));
                } else if (line.trim().startsWith('## ')) {
                    children.push(new Paragraph({ children: [new TextRun({ text: line.trim().replace('## ', ''), bold: true, size: 32 })], spacing: { before: 200 } }));
                } else if (line.trim().startsWith('# ')) {
                    children.push(new Paragraph({ children: [new TextRun({ text: line.trim().replace('# ', ''), bold: true, size: 36 })], spacing: { before: 200 } }));
                } else if (line.trim().startsWith('> ')) {
                    children.push(new Paragraph({ children: [new TextRun({ text: line.trim().replace('> ', ''), italics: true, color: '666666', size: 20 })], indent: { left: 400 } }));
                } else if (line.trim().startsWith('- ')) {
                    children.push(new Paragraph({ children: [new TextRun({ text: '• ' + line.trim().replace('- ', ''), size: 22 })], spacing: { before: 60 } }));
                } else if (line.trim() === '---') {
                    children.push(new Paragraph({ children: [new TextRun({ text: '────────────────────────────────', color: 'CCCCCC', size: 16 })], alignment: 'center', spacing: { before: 200, after: 200 } }));
                } else if (line.trim() === '') {
                    children.push(new Paragraph({ children: [new TextRun({ text: '', size: 22 })], spacing: { before: 100 } }));
                } else {
                    // Processa formatação inline (negrito, itálico, código)
                    const runs = [];
                    let remaining = line;
                    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
                    let lastIndex = 0;
                    let match;
                    
                    while ((match = regex.exec(remaining)) !== null) {
                        // Texto antes do match
                        if (match.index > lastIndex) {
                            runs.push(new TextRun({ text: remaining.slice(lastIndex, match.index), size: 22 }));
                        }
                        
                        if (match[2]) {
                            // Negrito
                            runs.push(new TextRun({ text: match[2], bold: true, size: 22 }));
                        } else if (match[3]) {
                            // Itálico
                            runs.push(new TextRun({ text: match[3], italics: true, size: 22 }));
                        } else if (match[4]) {
                            // Código inline
                            runs.push(new TextRun({ text: match[4], font: 'Courier New', size: 18, color: 'E83E8C' }));
                        }
                        lastIndex = match.index + match[0].length;
                    }
                    
                    // Restante do texto
                    if (lastIndex < remaining.length) {
                        runs.push(new TextRun({ text: remaining.slice(lastIndex), size: 22 }));
                    }
                    
                    if (runs.length > 0) {
                        children.push(new Paragraph({ children: runs, spacing: { after: 60 } }));
                    } else {
                        children.push(new Paragraph({ children: [new TextRun({ text: remaining, size: 22 })], spacing: { after: 60 } }));
                    }
                }
            }
            
            // Se ainda estiver dentro de bloco de código
            if (inCodeBlock && codeBuffer) {
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: codeBuffer, font: 'Courier New', size: 20 })],
                        spacing: { before: 200, after: 200 },
                        indent: { left: 400 }
                    })
                );
            }
            
            const doc = new Document({
                title: currentItem?.name || 'Nota',
                description: 'Exportado do FlashcardFlow',
                styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
                sections: [{ children }]
            });
            
            const blob = await Packer.toBlob(doc);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentItem?.name || 'nota'}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Erro ao exportar DOCX:', err);
            alert('Erro ao exportar .docx. Verifique se a biblioteca foi instalada corretamente.');
        }
        setShowExportMenu(false);
    };

    // Exportar como .pdf (texto selecionável via navegador)
    const exportPdf = () => {
        try {
            // Renderiza o conteúdo Markdown para HTML limpo (sem realces visuais)
            const content = currentItem?.content || '';
            let html = content;
            try { html = marked.parse(content); } catch (_) { console.error(_); }
            
            // Estilo limpo e profissional para impressão
            const printStyles = `
                <style>
                    @page { margin: 20mm; size: A4; }
                    body { 
                        font-family: 'Inter', 'Segoe UI', Arial, sans-serif; 
                        font-size: 12pt; 
                        line-height: 1.6; 
                        color: #1f2937; 
                        background: white;
                        padding: 0;
                        margin: 0;
                    }
                    h1 { font-size: 22pt; font-weight: 700; margin-top: 1em; margin-bottom: 0.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
                    h2 { font-size: 18pt; font-weight: 600; margin-top: 1.2em; margin-bottom: 0.5em; }
                    h3 { font-size: 15pt; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; }
                    p { margin-bottom: 0.8em; }
                    ul, ol { padding-left: 2em; margin-bottom: 0.8em; }
                    li { margin-bottom: 0.2em; }
                    blockquote { border-left: 4px solid #d1d5db; padding-left: 1em; color: #6b7280; margin: 1em 0; font-style: italic; }
                    code { background: #f3f4f6; padding: 0.15em 0.3em; border-radius: 3px; font-size: 0.9em; font-family: 'Courier New', monospace; color: #dc2626; }
                    pre { background: #1f2937; color: #f3f4f6; padding: 1em; border-radius: 6px; overflow-x: auto; margin: 1em 0; }
                    pre code { background: transparent; color: inherit; padding: 0; }
                    img { max-width: 100%; height: auto; margin: 1em 0; border-radius: 4px; }
                    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
                    th, td { border: 1px solid #d1d5db; padding: 0.5em; text-align: left; }
                    th { background: #f9fafb; font-weight: 600; }
                    hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
                    a { color: #2563eb; text-decoration: underline; }
                    .footer { text-align: center; font-size: 9pt; color: #9ca3af; margin-top: 2em; border-top: 1px solid #e5e7eb; padding-top: 1em; }
                </style>
            `;
            
            // Cria um documento HTML completo para impressão
            const fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${currentItem?.name || 'Nota'}</title>${printStyles}</head>
<body>
    ${html}
    <div class="footer">Exportado do FlashcardFlow • ${new Date().toLocaleDateString('pt-BR')}</div>
    <scr` + `ipt>
        // Auto-imprime ao carregar, mas cancela se o usuário fechar
        window.onload = function() { 
            setTimeout(function() { window.print(); }, 500);
        };
        // Fecha a aba após impressão (se o usuário clicar em imprimir ou cancelar)
        window.onafterprint = function() { window.close(); };
    </scr` + `ipt>
</body>
</html>`;
            
            // Abre em uma nova aba e imprime
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('Popup bloqueado. Permita popups para exportar PDF.');
                return;
            }
            printWindow.document.write(fullHtml);
            printWindow.document.close();
            printWindow.focus();
            setShowExportMenu(false);
        } catch (err) {
            console.error('Erro ao exportar PDF:', err);
            alert('Erro ao exportar PDF.');
        }
    };

    marked.setOptions({ gfm: true, breaks: true });
    const renderer = new marked.Renderer();
    renderer.image = ({ href, title, text }) => `<img src="${href}" alt="${text || ''}" title="${title || ''}" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;display:block;" />`;
    marked.use({ renderer });

    const processContent = (content, highlightsProp) => {
        let html = content || '';
        try { html = marked.parse(content || ''); } catch (_) { console.error(_); }
        const baseHighlights = (history[historyIndex] !== undefined) ? history[historyIndex] : (highlightsProp || []);
        let activeHighlights = [...baseHighlights];
        if (tempHighlight && showHighlights) {
            activeHighlights = activeHighlights.filter(h => h.id !== 'temp');
            activeHighlights.push(tempHighlight);
        }
        if (!activeHighlights || activeHighlights.length === 0 || !showHighlights) {
            if (annotations && annotations.length > 0) {
                return processAnnotationsInHtml(html);
            }
            return html;
        }
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const textNodes = [];
        const walk = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
        let n;
        while ((n = walk.nextNode())) textNodes.push(n);
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
                relevant.forEach(h => { boundaries.add(Math.max(0, h.start - nodeStart)); boundaries.add(Math.min(nodeLength, h.end - nodeStart)); });
                const sortedPoints = Array.from(boundaries).sort((a, b) => a - b);
                for (let i = 0; i < sortedPoints.length - 1; i++) {
                    const p1 = sortedPoints[i], p2 = sortedPoints[i+1];
                    const segmentText = nodeText.slice(p1, p2);
                    if (!segmentText) continue;
                    const midGlobal = nodeStart + (p1 + p2) / 2;
                    const activeH = relevant.filter(h => h.start <= midGlobal && h.end > midGlobal);
                    if (activeH.length > 0) {
                        const mark = document.createElement('mark');
                        mark.textContent = segmentText;
                        const isTemp = activeH.some(h => h.id === 'temp');
                        mark.style.backgroundColor = blendColors(activeH.map(h => h.color));
                        mark.style.color = 'inherit'; mark.style.padding = '0'; mark.style.borderRadius = '0';
                        mark.style.opacity = isTemp ? '0.85' : '1';
                        mark.style.boxShadow = isTemp ? '0 0 0 2px rgba(0,0,0,0.15)' : 'none';
                        mark.dataset.highlightIds = JSON.stringify(activeH.filter(h => h.id !== 'temp').map(h => h.id));
                        fragment.appendChild(mark);
                    } else { fragment.appendChild(document.createTextNode(segmentText)); }
                }
                if (node.parentNode) node.parentNode.replaceChild(fragment, node);
            }
            currentGlobalOffset += nodeLength;
        });
        const htmlWithHighlights = tempDiv.innerHTML;
        if (annotations && annotations.length > 0) {
            return processAnnotationsInHtml(htmlWithHighlights);
        }
        return htmlWithHighlights;
    };

    const processAnnotationsInHtml = (html) => {
        if (!annotations || annotations.length === 0) return html;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const textNodes = [];
        const walk = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
        let n;
        while ((n = walk.nextNode())) textNodes.push(n);
        
        let currentGlobalOffset = 0;
        const validAnnotations = annotations.filter(a => typeof a.start === 'number');
        
        textNodes.forEach(node => {
            const nodeText = node.nodeValue;
            const nodeLength = nodeText.length;
            const nodeStart = currentGlobalOffset;
            const nodeEnd = nodeStart + nodeLength;
            const relevant = validAnnotations.filter(a => a.start < nodeEnd && a.end > nodeStart);
            
            if (relevant.length > 0) {
                const fragment = document.createDocumentFragment();
                const boundaries = new Set([0, nodeLength]);
                relevant.forEach(a => {
                    boundaries.add(Math.max(0, a.start - nodeStart));
                    boundaries.add(Math.min(nodeLength, a.end - nodeStart));
                });
                const sortedPoints = Array.from(boundaries).sort((a, b) => a - b);
                
                for (let i = 0; i < sortedPoints.length - 1; i++) {
                    const p1 = sortedPoints[i], p2 = sortedPoints[i+1];
                    const segmentText = nodeText.slice(p1, p2);
                    if (!segmentText) continue;
                    const midGlobal = nodeStart + (p1 + p2) / 2;
                    const activeA = relevant.filter(a => a.start <= midGlobal && a.end > midGlobal);
                    
                    if (activeA.length > 0) {
                        const firstAnno = activeA[0];
                        const u = document.createElement('u');
                        u.textContent = segmentText;
                        u.className = 'annotation-marker';
                        u.dataset.annotationId = firstAnno.id;
                        u.style.textDecoration = 'underline';
                        u.style.textUnderlineOffset = '3px';
                        u.style.textDecorationColor = '#8b5cf6';
                        u.style.textDecorationStyle = 'wavy';
                        u.style.cursor = 'pointer';
                        u.style.position = 'relative';
                        fragment.appendChild(u);
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

    const getCursorStyle = () => {
        if (noteViewMode !== 'highlight') return 'default';
        if (activeHighlightTool === 'eraser') return 'crosshair';
        return continuousMode ? 'crosshair' : 'text';
    };

    return (
        <div className={`w-full flex-1 flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-0 relative ${noteViewMode === 'highlight' ? 'mode-highlight' : ''}`}>
            {/* HEADER COM SCROLL HORIZONTAL RESPONSIVO */}
            <div className="bg-gray-50 border-b shrink-0">
                {/* Linha superior: nome do arquivo + contador */}
                <div className="flex items-center justify-between px-3 pt-2 pb-1">
                    <div className="flex items-center gap-2 font-semibold text-gray-700 truncate min-w-0">
                        <Icon name="fileText" size={18} className="text-blue-500 shrink-0" />
                        <span className="truncate">{currentItem.name}</span>
                    </div>
                    {/* CONTADOR DE CARACTERES E PÁGINAS */}
                    {noteViewMode !== 'edit' && (
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-white border border-gray-100 rounded-full px-2.5 py-0.5 shrink-0 ml-2">
                            <span title="Caracteres">{pageStats.caracteres.toLocaleString('pt-BR')} caracteres</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                            <span title="Páginas estimadas Word">~{pageStats.paginasWord} páginas (Word)</span>
                        </div>
                    )}
                </div>
                
                {/* Barra de ferramentas com scroll horizontal responsivo */}
                <div 
                    ref={headerScrollRef}
                    className="flex items-center gap-1 px-3 pb-2 overflow-x-auto custom-scroll-header whitespace-nowrap flex-nowrap"
                    style={{ 
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'thin',
                        msOverflowStyle: 'auto'
                    }}
                >
                    {/* Controles de Tamanho da Fonte (Modo Ler e Realçar) */}
                    {noteViewMode !== 'edit' && (
                        <div className="flex items-center bg-white border rounded-lg p-0.5 shadow-sm shrink-0" title="Tamanho da fonte">
                            <button 
                                onClick={() => {
                                    const newSize = Math.max(FONT_MIN, fontSize - FONT_STEP);
                                    setFontSize(newSize);
                                    try { localStorage.setItem('note_font_size', newSize); } catch {/* ignore */}
                                }}
                                disabled={fontSize <= FONT_MIN}
                                className={`p-1 rounded transition-colors ${fontSize > FONT_MIN ? 'text-gray-600 hover:bg-gray-100 hover:text-blue-600' : 'text-gray-300 cursor-not-allowed'}`}
                            >
                                <Icon name="minus" size={12} />
                            </button>
                            <span className="w-6 text-center text-[10px] font-medium text-gray-500 select-none">{fontSize}</span>
                            <button 
                                onClick={() => {
                                    const newSize = Math.min(FONT_MAX, fontSize + FONT_STEP);
                                    setFontSize(newSize);
                                    try { localStorage.setItem('note_font_size', newSize); } catch {/* ignore */}
                                }}
                                disabled={fontSize >= FONT_MAX}
                                className={`p-1 rounded transition-colors ${fontSize < FONT_MAX ? 'text-gray-600 hover:bg-gray-100 hover:text-blue-600' : 'text-gray-300 cursor-not-allowed'}`}
                            >
                                <Icon name="plus" size={12} />
                            </button>
                        </div>
                    )}
                    
                    {/* Controles de realce (eye, undo, redo, continuous) */}
                    {noteViewMode !== 'edit' && (
                        <div className="flex items-center bg-white border rounded-lg p-0.5 shadow-sm shrink-0">
                            <button onClick={() => setShowHighlights(!showHighlights)} className={`p-1 rounded transition-colors ${showHighlights ? 'text-blue-600' : 'text-gray-400'}`} title={showHighlights ? "Ocultar Realces" : "Mostrar Realces"}><Icon name={showHighlights ? "eye" : "eyeOff"} size={14} /></button>
                            <div className="w-[1px] h-3 bg-gray-200 mx-0.5"></div>
                            <button onClick={handleUndo} disabled={historyIndex <= 0} className={`p-1 rounded transition-colors ${historyIndex > 0 ? 'text-gray-600 hover:bg-gray-100 hover:text-blue-600' : 'text-gray-300 cursor-not-allowed'}`} title="Desfazer Realce"><Icon name="rotateCcw" size={14} /></button>
                            <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={`p-1 rounded transition-colors ${historyIndex < history.length - 1 ? 'text-gray-600 hover:bg-gray-100 hover:text-blue-600' : 'text-gray-300 cursor-not-allowed'}`} title="Refazer Realce"><Icon name="rotateCw" size={14} /></button>
                            {noteViewMode === 'highlight' && (<><div className="w-[1px] h-3 bg-gray-200 mx-0.5"></div>
                                <button onClick={() => setContinuousMode(!continuousMode)} className={`p-1 rounded transition-colors ${continuousMode ? 'bg-blue-100 text-blue-600 ring-1 ring-blue-300' : 'text-gray-400 hover:text-gray-600'}`} title={continuousMode ? "Modo Contínuo ATIVO" : "Modo Contínuo"}><Icon name="pen" size={14} /></button></>)}
                        </div>
                    )}
                    
                    {/* Paleta de cores para realce */}
                    {noteViewMode === 'highlight' && (
                        <div className="flex items-center gap-0.5 bg-white border rounded-lg p-0.5 shadow-sm shrink-0">
                            {['green', 'yellow', 'red', 'blue'].map(color => (
                                <button key={color} onClick={() => setActiveHighlightTool(color)} className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${activeHighlightTool === color ? 'ring-2 ring-offset-1 scale-110 border-gray-400' : 'border-gray-200 hover:scale-105'}`} style={{ backgroundColor: `rgb(${colorMapRGB[color].join(',')})` }}></button>
                            ))}
                            <div className="w-[1px] h-3 bg-gray-200 mx-0.5"></div>
                            <button onClick={() => setActiveHighlightTool('eraser')} className={`p-0.5 rounded transition-all ${activeHighlightTool === 'eraser' ? 'bg-gray-800 text-white shadow-inner' : 'text-gray-500 hover:bg-gray-100'}`} title="Borracha"><Icon name="eraser" size={14} /></button>
                        </div>
                    )}
                    
                    {/* Botões de modo (Editar, Ler, Realçar, Notas) */}
                    <div className="flex bg-gray-200 p-0.5 rounded-lg shrink-0">
                        <button onClick={() => setNoteViewMode('edit')} className={`p-1 rounded-md transition-all flex items-center gap-1 text-[11px] font-medium ${noteViewMode === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Icon name="edit2" size={13} /><span className="hidden sm:inline">Editar</span></button>
                        <button onClick={() => setNoteViewMode('preview')} className={`p-1 rounded-md transition-all flex items-center gap-1 text-[11px] font-medium ${noteViewMode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Icon name="fileText" size={13} /><span className="hidden sm:inline">Ler</span></button>
                        <button onClick={() => { setNoteViewMode('highlight'); setActiveHighlightTool('yellow'); setShowHighlights(true); }} className={`p-1 rounded-md transition-all flex items-center gap-1 text-[11px] font-medium ${noteViewMode === 'highlight' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Icon name="highlighter" size={13} /><span className="hidden sm:inline">Realçar</span></button>
                        <button onClick={() => { setNotesModeActive(!notesModeActive); if (!notesModeActive) setNoteViewMode('preview'); }} className={`p-1 rounded-md transition-all flex items-center gap-1 text-[11px] font-medium ${notesModeActive ? 'bg-white text-blue-600 shadow-sm ring-2 ring-purple-300' : 'text-gray-500 hover:text-gray-700'}`} title="Modo Notas"><Icon name="stickyNote" size={13} /><span className="hidden sm:inline">Notas</span></button>
                    </div>

                    {/* BOTÃO DE EXPORTAR - menu flutuante via portal fixed */}
                    {noteViewMode !== 'edit' && (
                        <div className="relative shrink-0" ref={exportMenuRef}>
                            <button 
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm"
                                title="Exportar Nota"
                            >
                                <Icon name="download" size={13} />
                                <span>Exportar</span>
                                <Icon name="chevronDown" size={10} />
                            </button>
                        </div>
                    )}

                    {/* MENU FLUTUANTE FORA DO HEADER - fixed na tela */}
                    {showExportMenu && (
                        <div className="fixed inset-0 z-[200]" onClick={() => setShowExportMenu(false)}>
                            <div 
                                className="fixed bg-white border border-gray-200 rounded-xl shadow-2xl w-52 overflow-hidden"
                                style={{
                                    top: '60px',
                                    right: '24px',
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-2 border-b bg-gray-50 rounded-t-xl">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Exportar como</span>
                                </div>
                                <button 
                                    onClick={exportMarkdown}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors border-b border-gray-50"
                                >
                                    <span className="text-blue-500 font-bold text-sm">.md</span>
                                    <div>
                                        <div className="text-xs font-medium text-gray-700">Markdown</div>
                                        <div className="text-[10px] text-gray-400">Formato nativo</div>
                                    </div>
                                </button>
                                <button 
                                    onClick={exportDocx}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors border-b border-gray-50"
                                >
                                    <span className="text-blue-600 font-bold text-sm">.docx</span>
                                    <div>
                                        <div className="text-xs font-medium text-gray-700">Word</div>
                                        <div className="text-[10px] text-gray-400">Documento editável</div>
                                    </div>
                                </button>
                                <button 
                                    onClick={exportPdf}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                                >
                                    <span className="text-red-500 font-bold text-sm">.pdf</span>
                                    <div>
                                        <div className="text-xs font-medium text-gray-700">PDF</div>
                                        <div className="text-[10px] text-gray-400">Com formatação</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {noteViewMode === 'edit' ? (
                <div className="flex-1 flex flex-col relative">
                    {/* Barra de comandos Markdown */}
                    <div className="bg-gray-50 border-b px-2 py-1 flex items-center gap-1 shrink-0">
                        <div className="relative" ref={markdownMenuRef}>
                            <button 
                                onClick={() => setShowMarkdownMenu(!showMarkdownMenu)}
                                className="px-3 py-1.5 bg-white border rounded-md text-xs font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-1"
                                title="Comandos Markdown"
                            >
                                <Icon name="code" size={14} />
                                <span>Markdown</span>
                                <Icon name="chevronDown" size={12} />
                            </button>
                            {showMarkdownMenu && (
                                <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-xl z-50 w-72 max-h-80 overflow-y-auto">
                                    <div className="p-2 border-b bg-gray-50 rounded-t-lg">
                                        <span className="text-xs font-semibold text-gray-500">FORMATOS MARKDOWN</span>
                                    </div>
                                    {markdownCommands.map((cmd, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => insertMarkdown(cmd.syntax)}
                                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-purple-50 text-left transition-colors border-b border-gray-50 last:border-b-0"
                                        >
                                            <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center shrink-0">
                                                <Icon name={cmd.icon} size={14} className="text-gray-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium text-gray-800">{cmd.label}</div>
                                                <div className="text-[10px] text-gray-400 font-mono truncate">{cmd.syntax}</div>
                                            </div>
                                            <div className="text-[10px] text-gray-400 italic hidden sm:block">{cmd.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="text-xs text-gray-400 ml-2">Use Markdown para formatar seu texto</div>
                    </div>
                    <textarea 
                        ref={textareaRef}
                        className="flex-1 p-6 w-full resize-none focus:outline-none text-gray-700 font-mono text-sm leading-relaxed" 
                        value={currentItem.content || ''} 
                        onChange={(e) => updateNoteContent(currentItem.id, e.target.value)} 
                        placeholder="Digite seu texto (Markdown ou Normal)..."
                    ></textarea>
                </div>
            ) : (
                <div 
                    ref={previewRef}
                    className={`flex-1 p-8 overflow-y-auto custom-scroll markdown-preview bg-white relative ${notesModeActive ? 'mode-annotations' : ''}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={handleNoteClick}
                    style={{
                        cursor: getCursorStyle(),
                        userSelect: noteViewMode === 'highlight' && continuousMode ? 'none' : 'text',
                        WebkitUserSelect: noteViewMode === 'highlight' && continuousMode ? 'none' : 'text',
                        touchAction: noteViewMode === 'highlight' && continuousMode ? 'none' : 'auto',
                        fontSize: `${fontSize}px`,
                    }}
                    dangerouslySetInnerHTML={{ __html: processContent(currentItem.content, currentItem.highlights) }}
                />
            )}

            {/* Indicador de modo notas ativo */}
            {notesModeActive && (
                <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-lg z-30 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    📝 Selecione um texto para adicionar nota
                </div>
            )}

            {/* Camada de overlay para preview ghost (mobile) */}
            {noteViewMode === 'highlight' && continuousMode && (
                <div ref={ghostLayerRef} className="absolute inset-0 pointer-events-none z-20" style={{ top: 0, left: 0, right: 0, bottom: 0 }} />
            )}

            {noteViewMode === 'highlight' && continuousMode && (
                <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300 z-10">
                    ✋ Arraste com 1 dedo para realçar
                </div>
            )}

            {/* Balão de Anotação Flutuante */}
            {balloonVisible && activeAnnotation && (
                <div 
                    ref={balloonRef}
                    className="annotation-baloon fixed z-50 bg-white rounded-xl shadow-2xl border border-purple-200 p-5 w-96"
                    style={{
                        top: balloonPos.y > 0 ? `${balloonPos.y - 10}px` : '50%',
                        left: balloonPos.x > 0 ? `${balloonPos.x - 192}px` : '50%',
                        transform: balloonPos.y > 0 ? 'translateY(-100%)' : 'translate(-50%, -50%)',
                        maxHeight: '500px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Icon name="stickyNote" size={16} className="text-purple-600" />
                            <span className="text-sm font-semibold text-gray-700">Nota</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => deleteAnnotation(activeAnnotation.id)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                                title="Excluir nota"
                            >
                                <Icon name="trash2" size={14} />
                            </button>
                            <button 
                                onClick={() => { setBalloonVisible(false); setActiveAnnotation(null); }}
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                title="Fechar"
                            >
                                <Icon name="x" size={14} />
                            </button>
                        </div>
                    </div>
                    
                    {activeAnnotation.text && (
                        <div className="mb-3 p-2 bg-purple-50 rounded border border-purple-100">
                            <span className="text-xs font-medium text-purple-700 block mb-1">Texto anotado:</span>
                            <span className="text-sm text-gray-700 italic">"{activeAnnotation.text}"</span>
                        </div>
                    )}
                    
                    <textarea
                        ref={noteInputRef}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300"
                        rows={3}
                        placeholder="Digite sua nota aqui..."
                        value={newAnnotationText}
                        onChange={(e) => {
                            setNewAnnotationText(e.target.value);
                            updateAnnotationNote(activeAnnotation.id, e.target.value);
                        }}
                    />
                    
                    <div className="flex justify-end mt-2">
                        <button 
                            onClick={() => { setBalloonVisible(false); setActiveAnnotation(null); }}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NoteViewer;