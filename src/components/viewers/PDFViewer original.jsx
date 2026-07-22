// src/components/viewers/PDFViewer.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import Icon from '../ui/Icon';

// Configuração do Worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// --- COMPONENTE DE PÁGINA VIRTUAL ---
const VirtualPage = ({ pageNumber, scale, highlights, onRemoveHighlight, activeTool, registerPageRef }) => {
    const [isVisible, setIsVisible] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '800px' } 
        );
        if (wrapperRef.current) observer.observe(wrapperRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (isVisible && wrapperRef.current && registerPageRef) {
            registerPageRef(pageNumber, wrapperRef.current);
        }
    }, [isVisible, pageNumber, registerPageRef]);

    return (
        <div 
            ref={wrapperRef} 
            className="mb-4 relative bg-white shadow-md pdf-page-container mx-auto" 
            style={{ minHeight: `${800 * scale}px`, width: 'fit-content', transformOrigin: 'top left' }} 
            data-page-number={pageNumber}
            id={`pdf-page-${pageNumber}`}
        >
            {isVisible ? (
                <>
                    <Page 
                        pageNumber={pageNumber} 
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={false}
                        className="shadow-sm page-content"
                        onRenderSuccess={() => {
                            if (wrapperRef.current) {
                                const textLayer = wrapperRef.current.querySelector('.react-pdf__Page__textContent');
                                if (textLayer) {
                                    textLayer.style.userSelect = 'text'; 
                                    textLayer.style.cursor = (activeTool !== 'cursor' && activeTool !== 'eraser') ? 'text' : 'default';
                                    textLayer.querySelectorAll('span').forEach(s => s.style.pointerEvents = 'auto');
                                }
                            }
                        }}
                    >
                        {/* CAMADA DE DESTAQUES */}
                        <div className="highlight-layer absolute inset-0" style={{ zIndex: 5, pointerEvents: 'none' }}>
                            {highlights.map(h => {
                                if (!h.rects || !Array.isArray(h.rects)) return null;
                                return (
                                    <div 
                                        key={h.id}
                                        className="highlight-group absolute inset-0"
                                        style={{ 
                                            opacity: 0.4, 
                                            mixBlendMode: 'multiply',
                                            color: h.color, 
                                            pointerEvents: activeTool === 'eraser' ? 'auto' : 'none'
                                        }}
                                        onClick={(e) => {
                                            if (activeTool === 'eraser') {
                                                e.stopPropagation();
                                                onRemoveHighlight(h.id);
                                            }
                                        }}
                                        onTouchEnd={(e) => {
                                            if (activeTool === 'eraser') {
                                                e.stopPropagation();
                                                onRemoveHighlight(h.id);
                                            }
                                        }}
                                    >
                                        {h.rects.map((rect, idx) => (
                                            <div
                                                key={idx}
                                                className="absolute"
                                                style={{
                                                    left: `${rect.left}%`,
                                                    top: `${rect.top}%`,
                                                    width: `${rect.width}%`,
                                                    height: `${rect.height}%`,
                                                    backgroundColor: 'currentColor',
                                                    cursor: activeTool === 'eraser' ? 'crosshair' : 'inherit'
                                                }}
                                            />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </Page>
                    
                    <div className="absolute top-2 -right-8 text-xs text-gray-400 font-bold bg-gray-100 px-2 py-1 rounded">
                        {pageNumber}
                    </div>
                </>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-300 animate-pulse bg-gray-50 rounded" style={{ width: `${600 * scale}px` }}>
                    Carregando Pág {pageNumber}...
                </div>
            )}
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
const PDFViewer = ({ currentItem, pdfUrl, pdfMissing, onRestore, onUpdateHighlights, onSaveHighlights }) => {
    const [numPages, setNumPages] = useState(null);
    const [scale, setScale] = useState(1.0);
    const [activeTool, setActiveTool] = useState('yellow'); 
    const [activeTab, setActiveTab] = useState('pdf'); 
    const [showHighlightsOnPdf, setShowHighlightsOnPdf] = useState(true);
    const [jsonInput, setJsonInput] = useState('');

    const containerRef = useRef(null); 
    const contentRef = useRef(null);   
    const pagesRef = useRef(new Map()); 

    const colors = { yellow: '#ffea00', green: '#4ade80', red: '#f472b6' };
    
    // --- CORREÇÃO: Carrega o JSON sempre que entra na aba ou o item muda ---
    useEffect(() => {
        if (activeTab === 'json' && currentItem.highlights) {
            setJsonInput(JSON.stringify(currentItem.highlights, null, 2));
        }
    }, [activeTab, currentItem.highlights]);

    const gestureRef = useRef({
        isPinching: false,
        isSelecting: false,
        isPanning: false,
        startDist: 0,
        startScale: 1,
        lastMid: { x: 0, y: 0 },
        transformOrigin: { x: 0, y: 0 },
        startPoint: { x: 0, y: 0 },
        startPageNumber: null,
        startPan: { x: 0, y: 0 },
        startScroll: { x: 0, y: 0 }
    });

    const getDist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const getMid = (t1, t2) => ({ x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 });

    const getPageFromNode = (node) => {
        if (!node) return null;
        const pageDiv = node.nodeType === Node.ELEMENT_NODE 
            ? node.closest('[data-page-number]') 
            : node.parentElement?.closest('[data-page-number]');
        if (!pageDiv) return null;
        return { element: pageDiv, number: parseInt(pageDiv.dataset.pageNumber) };
    };

    // --- GESTOS ---
    const handleStart = (e) => {
        if (e.touches && e.touches.length === 2) {
            if(gestureRef.current.isSelecting) window.getSelection().removeAllRanges();
            e.preventDefault();
            gestureRef.current.isPinching = true;
            gestureRef.current.isSelecting = false;
            gestureRef.current.isPanning = false;
            
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            gestureRef.current.startDist = getDist(t1, t2);
            gestureRef.current.startScale = scale;
            const mid = getMid(t1, t2);
            gestureRef.current.lastMid = mid;

            if (contentRef.current && containerRef.current) {
                const contentRect = contentRef.current.getBoundingClientRect();
                const originX = mid.x - contentRect.left; 
                const originY = mid.y - contentRect.top;
                contentRef.current.style.transformOrigin = `${originX}px ${originY}px`;
                gestureRef.current.transformOrigin = { x: originX, y: originY };
            }
            return;
        }

        if (activeTab !== 'pdf') return;
        const point = e.touches ? e.touches[0] : e;

        if (activeTool === 'cursor') {
            const isTouch = e.type === 'touchstart';
            if (isTouch) {
                gestureRef.current.isPanning = true;
                gestureRef.current.startPan = { x: point.clientX, y: point.clientY };
                gestureRef.current.startScroll = { x: containerRef.current.scrollLeft, y: containerRef.current.scrollTop };
                return;
            }
        }

        if (['yellow', 'green', 'red'].includes(activeTool)) {
            let target = document.elementFromPoint(point.clientX, point.clientY);
            const isText = target && (target.tagName === 'SPAN' || target.classList.contains('react-pdf__Page__textContent'));
            
            if (isText) {
                const pageInfo = getPageFromNode(target);
                if (!pageInfo) return;

                gestureRef.current.isSelecting = true;
                gestureRef.current.startPageNumber = pageInfo.number;
                gestureRef.current.startPoint = { x: point.clientX, y: point.clientY };
                window.getSelection().removeAllRanges();
            }
        }
    };

    const handleMove = (e) => {
        if (gestureRef.current.isPinching && e.touches.length === 2) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const currentMid = getMid(t1, t2);
            const dx = currentMid.x - gestureRef.current.lastMid.x;
            const dy = currentMid.y - gestureRef.current.lastMid.y;
            if (containerRef.current) {
                containerRef.current.scrollLeft -= dx;
                containerRef.current.scrollTop -= dy;
            }
            gestureRef.current.lastMid = currentMid;

            const currentDist = getDist(t1, t2);
            const ratio = currentDist / gestureRef.current.startDist;
            let newScale = Math.min(Math.max(0.5, gestureRef.current.startScale * ratio), 4.0);
            
            if (contentRef.current) {
                const cssScale = newScale / scale; 
                contentRef.current.style.transform = `scale(${cssScale})`;
            }
            return;
        }

        const isTouch = e.type === 'touchmove';
        const point = isTouch ? e.touches[0] : e;

        if (gestureRef.current.isPanning && activeTool === 'cursor') {
            if (isTouch) e.preventDefault();
            const dx = point.clientX - gestureRef.current.startPan.x;
            const dy = point.clientY - gestureRef.current.startPan.y;
            containerRef.current.scrollLeft = gestureRef.current.startScroll.x - dx;
            containerRef.current.scrollTop = gestureRef.current.startScroll.y - dy;
            return;
        }

        if (gestureRef.current.isSelecting) {
            if (isTouch && e.cancelable) e.preventDefault(); 

            let range;
            if (document.caretRangeFromPoint) {
                range = document.caretRangeFromPoint(point.clientX, point.clientY);
            } else if (document.caretPositionFromPoint) {
                const pos = document.caretPositionFromPoint(point.clientX, point.clientY);
                if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.setEnd(pos.offsetNode, pos.offset); }
            }

            if (!range) return;

            const pageNode = range.startContainer.nodeType === Node.ELEMENT_NODE 
                ? range.startContainer.closest('[data-page-number]') 
                : range.startContainer.parentElement?.closest('[data-page-number]');
            
            if (!pageNode || parseInt(pageNode.dataset.pageNumber) !== gestureRef.current.startPageNumber) return;

            const selection = window.getSelection();
            let startRange;
            if (document.caretRangeFromPoint) startRange = document.caretRangeFromPoint(gestureRef.current.startPoint.x, gestureRef.current.startPoint.y);
            
            if (startRange && range) {
                const newRange = document.createRange();
                try {
                    if (startRange.compareBoundaryPoints(Range.START_TO_START, range) <= 0) {
                        newRange.setStart(startRange.startContainer, startRange.startOffset);
                        newRange.setEnd(range.startContainer, range.startOffset);
                    } else {
                        newRange.setStart(range.startContainer, range.startOffset);
                        newRange.setEnd(startRange.startContainer, startRange.startOffset);
                    }
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                } catch (err) {}
            }
        }
    };

    const handleEnd = (e) => {
        if (gestureRef.current.isPinching) {
            if (e.touches && e.touches.length > 0) return;
            gestureRef.current.isPinching = false;
            
            if (contentRef.current && containerRef.current) {
                const transform = contentRef.current.style.transform;
                const match = transform.match(/scale\(([^)]+)\)/);
                if (match) {
                    const cssScaleRatio = parseFloat(match[1]);
                    const oldScale = scale;
                    const newScale = Math.min(Math.max(0.5, oldScale * cssScaleRatio), 4.0);
                    const ratio = newScale / oldScale;

                    const originX = gestureRef.current.transformOrigin.x;
                    const originY = gestureRef.current.transformOrigin.y;
                    const scaleDiffRatio = (newScale - oldScale) / oldScale;
                    
                    const scrollAdjX = originX * scaleDiffRatio;
                    const scrollAdjY = originY * scaleDiffRatio;

                    contentRef.current.style.transform = '';
                    contentRef.current.style.transformOrigin = '';
                    setScale(newScale);

                    requestAnimationFrame(() => {
                        if(containerRef.current) {
                            containerRef.current.scrollLeft += scrollAdjX;
                            containerRef.current.scrollTop += scrollAdjY;
                        }
                    });
                }
            }
            return;
        }

        if (gestureRef.current.isPanning) {
            if (!e.touches || e.touches.length === 0) gestureRef.current.isPanning = false;
            return;
        }

        if (gestureRef.current.isSelecting) {
            gestureRef.current.isSelecting = false;
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
            const range = selection.getRangeAt(0);
            const text = selection.toString().trim();
            if (text) saveHighlight(range, text);
            selection.removeAllRanges();
        }
    };

    const saveHighlight = (range, text) => {
        const pageNode = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE 
            ? range.commonAncestorContainer.closest('[data-page-number]') 
            : range.commonAncestorContainer.parentElement?.closest('[data-page-number]');
            
        if (!pageNode) return;
        const pageNumber = parseInt(pageNode.dataset.pageNumber);
        const pageRect = pageNode.getBoundingClientRect();
        const clientRects = Array.from(range.getClientRects());

        const rects = clientRects.map(r => ({
            left: ((r.left - pageRect.left) / pageRect.width) * 100,
            top: ((r.top - pageRect.top) / pageRect.height) * 100,
            width: (r.width / pageRect.width) * 100,
            height: (r.height / pageRect.height) * 100
        })).filter(r => r.width > 0 && r.height > 0);

        if (rects.length > 0) {
            onUpdateHighlights(currentItem.id, {
                id: Date.now(),
                text: text,
                page: pageNumber,
                rects: rects,
                color: colors[activeTool] || colors.yellow,
                type: 'pdf_highlight',
                ySort: rects[0].top 
            });
        }
    };

    // --- SALVAR JSON ---
    const handleSaveJson = () => {
        try {
            const parsed = JSON.parse(jsonInput);
            if (!Array.isArray(parsed)) throw new Error("JSON inválido: Deve ser uma lista []");
            
            if (onSaveHighlights) {
                onSaveHighlights(currentItem.id, parsed);
                alert("Salvo com sucesso!");
            } else if (onUpdateHighlights) {
                // Fallback para quem esqueceu de atualizar o App.jsx
                onUpdateHighlights(currentItem.id, parsed, 'REPLACE_ALL'); 
                alert("Salvo via método alternativo. Se persistir erro, atualize o App.jsx");
            } else {
                alert("Erro: Função de salvar não encontrada.");
            }
        } catch (e) {
            alert("Erro no JSON: " + e.message);
        }
    };

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        el.addEventListener('mousedown', handleStart);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);

        el.addEventListener('touchstart', handleStart, { passive: false });
        el.addEventListener('touchmove', handleMove, { passive: false });
        el.addEventListener('touchend', handleEnd);

        return () => {
            el.removeEventListener('mousedown', handleStart);
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            el.removeEventListener('touchstart', handleStart);
            el.removeEventListener('touchmove', handleMove);
            el.removeEventListener('touchend', handleEnd);
        };
    }, [activeTool, activeTab, scale]); 

    const handleRemoveHighlight = (id) => {
        if (confirm("Apagar destaque?")) onUpdateHighlights(currentItem.id, null, id);
    };

    const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages);

    const highlightsByPage = useMemo(() => {
        if (!currentItem.highlights || currentItem.highlights.length === 0) return {};
        const validHighlights = currentItem.highlights.filter(h => h.rects && Array.isArray(h.rects) && h.rects.length > 0);
        const grouped = validHighlights.reduce((acc, h) => {
            if (!acc[h.page]) acc[h.page] = [];
            acc[h.page].push(h);
            return acc;
        }, {});
        Object.keys(grouped).forEach(page => {
            grouped[page].sort((a, b) => {
                const aY = a.ySort ?? (a.rects?.[0]?.top || 0);
                const bY = b.ySort ?? (b.rects?.[0]?.top || 0);
                if (Math.abs(aY - bY) > 1) return aY - bY; 
                return (a.rects?.[0]?.left || 0) - (b.rects?.[0]?.left || 0);
            });
        });
        return grouped;
    }, [currentItem.highlights]);

    const navigateToHighlight = (page) => {
        setActiveTab('pdf'); 
        setTimeout(() => {
            const el = document.getElementById(`pdf-page-${page}`);
            if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    if (currentItem.type === 'pdf') {
        return (
            <div className="flex flex-col w-full h-full bg-white">
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50 text-gray-700 font-bold shadow-sm shrink-0">
                    <Icon name="fileText" className="text-red-500"/> 
                    <span className="truncate">{currentItem.name}</span>
                </div>
                <div className="flex-1 w-full relative bg-gray-100 overflow-hidden">
                    {pdfUrl ? (
                        <iframe src={`PDF%20LEITOR.html?id=${currentItem.id}`} className="absolute inset-0 w-full h-full border-none" title="PDF Local"/>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 p-6 text-center">
                            {pdfMissing ? (
                                <><Icon name="alertCircle" size={48} className="text-red-400 mb-4"/><p className="mb-6 text-lg">Arquivo não encontrado.</p><button onClick={() => document.getElementById('local-pdf-input').click()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-md font-medium text-lg w-full max-w-xs">Selecionar Novamente</button></>
                            ) : (
                                <div className="flex flex-col items-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div><p>Carregando documento...</p></div>
                            )}
                            <input id="local-pdf-input" type="file" accept=".pdf" className="hidden" onChange={onRestore} />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const isHighlightTool = ['yellow', 'green', 'red'].includes(activeTool);

    return (
        <div className="flex flex-col h-full bg-gray-100 overflow-hidden w-full relative">
            <style>{`
                .react-pdf__Page__textContent span { cursor: text; pointer-events: auto !important; }
                .react-pdf__Page__annotations { display: none; }
                ::selection { background: rgba(33, 150, 243, 0.2); }
                .cursor-highlight { cursor: text; }
                .cursor-eraser { cursor: crosshair; }
            `}</style>

            <div className="bg-white border-b shadow-sm z-20 shrink-0">
                <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Icon name="fileText" className="text-red-600 shrink-0" size={18}/>
                        <span className="font-semibold text-gray-700 truncate">{currentItem.name}</span>
                    </div>
                    {activeTab === 'pdf' && (
                        <div className="flex items-center bg-gray-100 rounded-lg p-1 hidden sm:flex">
                            <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1 hover:bg-white rounded"><Icon name="minus" size={14}/></button>
                            <span className="text-xs font-mono w-10 text-center">{Math.round(scale*100)}%</span>
                            <button onClick={() => setScale(s => Math.min(4.0, s + 0.1))} className="p-1 hover:bg-white rounded"><Icon name="plus" size={14}/></button>
                        </div>
                    )}
                </div>

                <div className="px-4 py-2 flex gap-4">
                    <button onClick={() => setActiveTab('pdf')} className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'pdf' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <Icon name="file" size={16}/> Documento
                    </button>
                    <button onClick={() => setActiveTab('notes')} className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'notes' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <Icon name="list" size={16}/> Resumo <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${activeTab === 'notes' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'}`}>{Object.values(highlightsByPage).reduce((acc, p) => acc + p.length, 0)}</span>
                    </button>
                    <button onClick={() => setActiveTab('json')} className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'json' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <Icon name="code" size={16}/> JSON
                    </button>
                </div>

                {activeTab === 'pdf' && (
                    <div className="px-4 pb-2 flex items-center justify-center gap-4 overflow-x-auto">
                         <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-full">
                            {Object.entries(colors).map(([name, hex]) => (
                                <button key={name} onClick={() => setActiveTool(name)} className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${activeTool===name ? 'border-blue-600 scale-110 ring-1 ring-blue-300' : 'border-transparent'}`} style={{backgroundColor: hex}} title={name}/>
                            ))}
                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                            <button onClick={() => setActiveTool('eraser')} className={`p-1.5 rounded-full transition-colors ${activeTool==='eraser' ? 'bg-white text-red-600 shadow' : 'text-gray-500 hover:text-gray-700'}`} title="Borracha"><Icon name="trash2" size={16}/></button>
                            <button onClick={() => setActiveTool('cursor')} className={`p-1.5 rounded-full transition-colors ${activeTool==='cursor' ? 'bg-white text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'}`} title="Mover / Pan"><Icon name="mousePointer" size={16}/></button>
                            <button onClick={() => setShowHighlightsOnPdf(!showHighlightsOnPdf)} className={`p-1.5 rounded-full transition-colors ${!showHighlightsOnPdf ? 'bg-gray-300 text-gray-500' : 'text-blue-600'}`} title="Ocultar Realces"><Icon name={showHighlightsOnPdf ? "eye" : "eyeOff"} size={16}/></button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-hidden relative">
                <div 
                    className={`absolute inset-0 overflow-auto bg-gray-200/50 pt-4 px-4 custom-scroll ${activeTab === 'pdf' ? 'block' : 'hidden'} ${activeTool === 'eraser' ? 'cursor-eraser' : isHighlightTool ? 'cursor-highlight' : ''}`} 
                    ref={containerRef}
                    style={{ touchAction: 'none' }} 
                >
                    {!pdfUrl ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                            {pdfMissing ? <><Icon name="alertCircle" size={48} className="text-red-400"/><p>Erro ao carregar.</p></> : <><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div><p>Baixando...</p></>}
                        </div>
                    ) : (
                        <div 
                            className="flex justify-center min-h-0 select-text pb-20 origin-top-left"
                            ref={contentRef}
                            style={{ transition: gestureRef.current.isPinching ? 'none' : 'transform 0.1s ease-out' }}
                        > 
                            <Document file={pdfUrl} key={currentItem.id} onLoadSuccess={onDocumentLoadSuccess} className="outline-none">
                                {Array.from(new Array(numPages), (el, index) => {
                                    const pageNum = index + 1;
                                    const pageHighlights = showHighlightsOnPdf ? (currentItem.highlights || []).filter(h => h.page === pageNum) : [];
                                    return (
                                        <VirtualPage 
                                            key={`page_${pageNum}`} 
                                            pageNumber={pageNum} 
                                            scale={scale} 
                                            highlights={pageHighlights}
                                            onRemoveHighlight={handleRemoveHighlight}
                                            activeTool={activeTool}
                                            registerPageRef={(num, ref) => pagesRef.current.set(num, ref)}
                                        />
                                    );
                                })}
                            </Document>
                        </div>
                    )}
                </div>

                {activeTab === 'notes' && (
                    <div className="absolute inset-0 overflow-y-auto bg-white p-6 custom-scroll">
                        <div className="max-w-4xl mx-auto pb-20 space-y-12">
                            {Object.keys(highlightsByPage).length === 0 ? (
                                <div className="flex flex-col items-center justify-center pt-20 text-gray-400 opacity-50">
                                    <Icon name="layout" size={64} className="mb-4"/>
                                    <p className="text-lg font-medium">Seu resumo aparecerá aqui</p>
                                    <span className="text-sm">Realce textos no documento para começar</span>
                                </div>
                            ) : (
                                Object.entries(highlightsByPage).map(([page, highlights]) => (
                                    <div key={page} className="relative">
                                        <div className="flex items-center gap-4 mb-4">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded">Página {page}</span>
                                            <div className="h-px bg-gray-100 flex-1"></div>
                                        </div>
                                        <div className="flex flex-wrap items-baseline content-start gap-x-1.5 gap-y-2 leading-relaxed text-gray-900">
                                            {highlights.map((h, i) => {
                                                const prev = highlights[i-1];
                                                const currentY = h.ySort ?? 0;
                                                const prevY = prev?.ySort ?? 0;
                                                const isNewRow = prev && (currentY - prevY > 2.0); 
                                                return (
                                                    <React.Fragment key={h.id}>
                                                        {isNewRow && <div className="w-full h-1"></div>}
                                                        <span 
                                                            className="relative group cursor-pointer px-1 py-0.5 rounded-sm hover:opacity-90 transition-opacity text-base select-text"
                                                            style={{ backgroundColor: h.color }}
                                                            onClick={() => navigateToHighlight(h.page)}
                                                        >
                                                            {h.text}
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); if(confirm("Remover do resumo?")) onUpdateHighlights(currentItem.id, null, h.id); }}
                                                                className="absolute -top-3 -right-2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Remover"
                                                            >
                                                                <Icon name="x" size={10} />
                                                            </button>
                                                        </span>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ABA JSON */}
                {activeTab === 'json' && (
                    <div className="absolute inset-0 flex flex-col bg-gray-50">
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b">
                            <span className="text-xs font-mono text-gray-500">RAW JSON EDITOR</span>
                            <div className="flex gap-2">
                                <button onClick={() => { navigator.clipboard.writeText(jsonInput); alert("Copiado!"); }} className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50">Copiar</button>
                                <button onClick={handleSaveJson} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm">Salvar Alterações</button>
                            </div>
                        </div>
                        <div className="flex-1 relative">
                            <textarea 
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                className="w-full h-full p-4 font-mono text-xs text-gray-700 bg-white resize-none outline-none"
                                spellCheck="false"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PDFViewer;