// Arquivo: src/components/FileExplorer.jsx
import React, { useState, useRef } from 'react';
import Icon from './ui/Icon';

const FileExplorer = ({ 
    items,      // Itens da pasta atual (filtrados)
    allItems,   // TODOS os itens (para contagem correta das pastas)
    currentFolderId, 
    setCurrentFolderId, 
    activeDeckId, 
    onItemClick, 
    searchTerm, 
    setSearchTerm, 
    activeFilters, 
    toggleFilter, 
    clearFilters, 
    clearSearch, 
    breadcrumbs, 
    // Props de Ação
    onDelete, 
    onRename, 
    onDownload, 
    onClipboard, 
    onPaste, 
    clipboard, 
    // Props de Seleção Múltipla
    isSelectionMode, 
    selectedIds, 
    toggleSelectionMode, 
    // Props de Criação
    onCreateFolder, 
    onCreateNote, 
    onCreateVideo, 
    onCreateImage, 
    onCreateShortcut, 
    onCreateGDrive, 
    onCreateEdital, 
    onCreateReport, 
    onCreateMultiDeck,
    onImportFile,
    // Props de UI/Navegação adicionais
    isGuest,
    onLoginClick,
    onOpenSettings, // NOVO
    onOpenStats,    // NOVO
    // Seleção em lote
    toggleSelection,
    onBatchDelete,
    onBatchCopy,
    onBatchCut,
    onClose // <--- ADICIONADO AQUI
}) => {
    const [showNewMenu, setShowNewMenu] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [editingItemId, setEditingItemId] = useState(null);
    const [tempName, setTempName] = useState("");
    
    const editInputRef = useRef(null);

    // CORREÇÃO: Usa 'allItems' para contar, senão mostra 0 itens se a pasta não estiver aberta
    const countItemsInFolder = (folderId) => {
        const source = allItems || items;
        return source.filter(i => i.parentId === folderId).length;
    };

    const handleSaveRename = (e) => {
        e.stopPropagation();
        if (tempName.trim()) onRename(editingItemId, tempName);
        setEditingItemId(null);
    };

    const startRenaming = (e, item) => {
        e.stopPropagation();
        setEditingItemId(item.id);
        setTempName(item.name);
        setTimeout(() => editInputRef.current?.focus(), 50);
    };

    return (
        <div className="flex flex-col h-full bg-white md:bg-gray-50 border-r border-gray-200">
            {/* Header do Explorer */}
            <div className="p-4 bg-gray-50 border-b shrink-0 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <h2 className="font-bold text-gray-700 flex items-center gap-2"><Icon name="layers" size={20} /> Explorador</h2>
                    <div className="flex gap-1">
                        {/* Botão Login (se convidado) */}
                        {isGuest && (
                            <button onClick={onLoginClick} className="p-2 hover:bg-blue-50 text-blue-600 rounded transition-colors" title="Fazer Login">
                                <Icon name="logIn" size={18} />
                            </button>
                        )}

                        {/* Botão Seleção Múltipla */}
                        <button onClick={toggleSelectionMode} className={`p-2 hover:bg-gray-200 rounded ${isSelectionMode ? 'text-blue-600 bg-blue-50' : 'text-gray-500'}`} title="Seleção Múltipla">
                            <Icon name="checkSquare" size={18}/>
                        </button>

                        {/* CORREÇÃO: Botões de Configuração e Stats restaurados */}
                        <button onClick={onOpenSettings} className="p-2 hover:bg-gray-200 rounded text-gray-500" title="Configurações">
                            <Icon name="settings" size={18}/>
                        </button>
                        <button onClick={onOpenStats} className="p-2 hover:bg-gray-200 rounded text-gray-500" title="Estatísticas e Backup">
                            <Icon name="barChart" size={18}/>
                        </button>

                        {/* --- NOVO: BOTÃO DE FECHAR (SÓ MOBILE) --- */}
                        <button onClick={onClose} className="md:hidden p-2 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded transition-colors" title="Fechar Explorador">
                            <Icon name="x" size={18}/>
                        </button>
                    </div>
                </div>

                {/* Breadcrumbs e Filtros */}
                <div className="flex items-center gap-1 text-sm overflow-x-auto whitespace-nowrap pb-1 custom-scroll">
                    {searchTerm ? (
                        <div className="flex items-center justify-between w-full">
                            <span className="text-sm font-bold text-blue-600 flex items-center gap-1"><Icon name="search" size={14}/> Busca: "{searchTerm}"</span>
                            <button onClick={clearSearch} className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded hover:bg-red-50 transition-colors"><Icon name="x" size={12}/> Limpar</button>
                        </div>
                    ) : activeFilters.length > 0 ? (
                        <div className="flex items-center justify-between w-full">
                            <span className="text-sm font-bold text-purple-600 flex items-center gap-1"><Icon name="filter" size={14}/> Filtro Ativo ({activeFilters.length})</span>
                            <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded hover:bg-red-50 transition-colors"><Icon name="x" size={12}/> Limpar</button>
                        </div>
                    ) : (
                        <>
                            <button onClick={() => setCurrentFolderId(null)} className={`flex items-center hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors ${!currentFolderId ? 'font-bold text-blue-700' : 'text-gray-500'}`}>
                                <Icon name="home" size={14} className="mr-1"/> Início
                            </button>
                            {breadcrumbs.map((folder, i) => (
                                <React.Fragment key={folder.id}>
                                    <span className="text-gray-300">/</span>
                                    <button onClick={() => setCurrentFolderId(folder.id)} className={`hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors ${i === breadcrumbs.length - 1 ? 'font-bold text-blue-700' : 'text-gray-500'}`}>
                                        {folder.name}
                                    </button>
                                </React.Fragment>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* Lista de Itens */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {!activeFilters.length && !searchTerm && currentFolderId && (
                    <button onClick={() => { 
                        if (breadcrumbs.length > 0) {
                             const parent = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].id : null;
                             setCurrentFolderId(parent);
                        }
                    }} className="w-full text-left p-2 hover:bg-gray-100 rounded text-gray-500 text-sm flex items-center gap-2 mb-2">
                        <Icon name="cornerUpLeft" size={16} /> .. Voltar
                    </button>
                )}

                {items.map(item => (
                    <div key={item.id} className={`group relative p-2 rounded-lg border transition-all cursor-pointer select-none grid grid-cols-[auto_1fr_auto] gap-3 items-center ${item.id === activeDeckId ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-200' : 'bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`} onClick={() => onItemClick(item)}>
                        {isSelectionMode ? (
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedIds.includes(item.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                {selectedIds.includes(item.id) && <Icon name="check" size={14} className="text-white"/>}
                            </div>
                        ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.type === 'folder' ? 'bg-yellow-100 text-yellow-600' : item.type === 'note' ? 'bg-indigo-100 text-indigo-600' : item.type === 'pdf' ? 'bg-red-100 text-red-600' : item.type === 'video' ? 'bg-pink-100 text-pink-600' : item.type === 'image' ? 'bg-purple-100 text-purple-600' : item.type === 'edital' ? 'bg-green-100 text-green-600' : item.type === 'report' ? 'bg-orange-100 text-orange-600' : item.type === 'gdrive' ? 'bg-blue-100 text-blue-600' : item.type === 'shortcut' ? 'bg-gray-100 text-gray-600 border border-gray-300' : (item.id === activeDeckId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500')}`}>
                                <Icon name={item.type === 'folder' ? 'folder' : item.type === 'note' ? 'fileText' : item.type === 'pdf' ? 'fileText' : item.type === 'video' ? 'video' : item.type === 'image' ? 'image' : item.type === 'edital' ? 'list' : item.type === 'report' ? 'activity' : item.type === 'gdrive' ? 'hardDrive' : item.type === 'shortcut' ? 'link' : 'play'} size={14} className={item.id === activeDeckId ? "ml-0.5" : ""} />
                            </div>
                        )}
                        
                        <div className="min-w-0">
                            {editingItemId === item.id ? (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <input ref={editInputRef} value={tempName} onChange={e => setTempName(e.target.value)} onKeyDown={e => { if(e.key==='Enter') handleSaveRename(e); if(e.key==='Escape') setEditingItemId(null); }} className="w-full text-sm border rounded px-1 py-0.5 focus:border-blue-500 outline-none" autoFocus onClick={e => e.stopPropagation()} />
                                    <button onClick={handleSaveRename} className="text-green-600 p-1"><Icon name="check" size={14}/></button>
                                </div>
                            ) : (
                                <div>
                                    <p className={`text-sm font-medium truncate ${item.id === activeDeckId ? 'text-blue-900' : 'text-gray-700'} ${item.type === 'shortcut' ? 'italic' : ''}`}>
                                        {item.name} {item.type === 'shortcut' && <span className="text-[9px] text-gray-400 font-normal not-italic ml-1">(Atalho)</span>}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {item.type === 'folder' ? <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded-full">{countItemsInFolder(item.id)} itens</span> : 
                                         item.type === 'edital' ? <span className="text-[10px] bg-green-100 text-green-600 px-1.5 rounded-full">Edital</span> :
                                         item.type === 'deck' ? <><span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded-full">{Math.round(((item.progress || 0) / (item.cards?.length || 1)) * 100)}%</span>{item.completions > 0 && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 rounded-full flex items-center gap-1 font-bold"><Icon name="trophy" size={8} /> {item.completions}</span>}</> :
                                         <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded-full capitalize">{item.type}</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {editingItemId !== item.id && !isSelectionMode && (
                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-1 mr-2">
                                    <button onClick={(e) => onDownload(e, item)} className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-blue-600 rounded" title="Baixar"><Icon name="download" size={14} /></button>
                                    <button onClick={(e) => onClipboard(e, item, 'copy')} className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-blue-600 rounded" title="Copiar"><Icon name="copy" size={14} /></button>
                                    <button onClick={(e) => onClipboard(e, item, 'cut')} className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-orange-600 rounded" title="Recortar"><Icon name="scissors" size={14} /></button>
                                    <button onClick={(e) => startRenaming(e, item)} className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-green-600 rounded" title="Renomear"><Icon name="edit2" size={14} /></button>
                                    <button onClick={(e) => onDelete(e, item.id)} className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-red-600 rounded" title="Excluir"><Icon name="trash2" size={14} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                
                {items.length === 0 && (<div className="text-center text-gray-400 py-8 text-sm italic">{activeFilters.length > 0 ? "Nenhum arquivo encontrado." : "Pasta vazia"}</div>)}
            </div>

            {/* Footer de Ações */}
            <div className="p-4 bg-gray-50 border-t shrink-0 flex flex-col gap-2">
                {isSelectionMode && selectedIds.length > 0 ? (
                    <div className="flex gap-2 w-full animate-in slide-in-from-bottom-2 duration-200">
                        <div className="flex-1 bg-blue-50 text-blue-800 text-xs font-bold rounded-lg flex items-center justify-center px-3 border border-blue-100">{selectedIds.length} selecionado(s)</div>
                        <button onClick={onBatchCopy} className="p-2 bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600 rounded-lg" title="Copiar"><Icon name="copy" size={18} /></button>
                        <button onClick={onBatchCut} className="p-2 bg-gray-100 hover:bg-orange-100 text-gray-600 hover:text-orange-600 rounded-lg" title="Recortar"><Icon name="scissors" size={18} /></button>
                        <button onClick={onBatchDelete} className="p-2 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-lg" title="Excluir"><Icon name="trash2" size={18} /></button>
                    </div>
                ) : clipboard ? (
                    <div className="flex gap-2 w-full">
                        <button onClick={onPaste} className="flex-1 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border border-orange-200 animate-pulse">
                            <Icon name="clipboard" size={16} /> Colar {clipboard.items.length} item(s) ({clipboard.mode === 'cut' ? 'Recortado' : 'Copiado'})
                        </button>
                        <button onClick={() => onClipboard(null, null, null)} className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg"><Icon name="x" size={16} /></button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <button onClick={() => setShowNewMenu(!showNewMenu)} className="w-full py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium flex items-center justify-center gap-2">
                                <Icon name="plus" size={16} /> Novo
                            </button>
                            {showNewMenu && (
                                <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden flex flex-col animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
                                    <button onClick={() => { onCreateFolder(); setShowNewMenu(false); }} className="text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2 border-b border-gray-50"><Icon name="folderPlus" size={16} className="text-yellow-500"/> Pasta</button>
                                    <button onClick={() => { onCreateShortcut(); setShowNewMenu(false); }} className="text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2 border-b border-gray-50"><Icon name="link" size={16} className="text-gray-500"/> Atalho (Pasta)</button>
                                    <button onClick={() => { onCreateMultiDeck(); setShowNewMenu(false); }} className="text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2 border-b border-gray-50"><Icon name="layers" size={16} className="text-purple-600"/> Multiflashcard (União)</button>
                                    <button onClick={() => { onCreateNote(); setShowNewMenu(false); }} className="text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2"><Icon name="fileText" size={16} className="text-indigo-500"/> Nota (Texto)</button>
                                    <button onClick={() => { onCreateEdital(); setShowNewMenu(false); }} className="text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2"><Icon name="list" size={16} className="text-green-500"/> Edital (JSON/Checklist)</button>
                                    <button onClick={() => { onCreateReport(); setShowNewMenu(false); }} className="text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2"><Icon name="activity" size={16} className="text-orange-500"/> Relatório (Analytics)</button>
                                    <button onClick={() => { onCreateVideo(); setShowNewMenu(false); }} className="text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2"><Icon name="video" size={16} className="text-pink-500"/> Vídeo (Iframe)</button>
                                    <button onClick={() => { onCreateImage(); setShowNewMenu(false); }} className="text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2"><Icon name="image" size={16} className="text-purple-500"/> Imagem (URL)</button>
                                    <button onClick={() => { onCreateGDrive(); setShowNewMenu(false); }} className="text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-2"><Icon name="hardDrive" size={16} className="text-blue-500"/> Pasta Drive</button>
                                </div>
                            )}
                        </div>
                        <button onClick={onImportFile} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2">
                            <Icon name="filePlus" size={16} /> Importar
                        </button>
                        <div className="relative">
                            <button onClick={() => setShowFilterMenu(!showFilterMenu)} className={`h-full px-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg flex items-center justify-center transition-colors ${activeFilters.length > 0 ? 'bg-purple-50 text-purple-600 border-purple-200 ring-1 ring-purple-200' : ''}`} title="Filtrar"><Icon name="filter" size={16} /></button>
                            {showFilterMenu && (
                                <div className="absolute bottom-full right-0 w-48 mb-2 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden flex flex-col animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
                                    <div className="p-3 border-b bg-gray-50 text-xs font-bold text-gray-500 uppercase">Filtrar por Tipo</div>
                                    <div className="p-2 space-y-1">
                                        {[{id: 'deck', label: 'Flashcards', color: 'bg-blue-500'},{id: 'note', label: 'Notas', color: 'bg-indigo-500'},{id: 'edital', label: 'Editais', color: 'bg-green-500'},{id: 'report', label: 'Relatórios', color: 'bg-orange-500'},{id: 'pdf', label: 'PDF', color: 'bg-red-500'},{id: 'video', label: 'Vídeo', color: 'bg-pink-500'},{id: 'image', label: 'Imagem', color: 'bg-purple-500'},{id: 'gdrive', label: 'Drive', color: 'bg-blue-500'}].map(type => (
                                            <button key={type.id} onClick={() => toggleFilter(type.id)} className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between transition-colors ${activeFilters.includes(type.id) ? 'bg-gray-100 font-medium text-gray-900' : 'hover:bg-gray-50 text-gray-600'}`}>
                                                <span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${type.color}`}></span>{type.label}</span>
                                                {activeFilters.includes(type.id) && <Icon name="check" size={14} className="text-green-600"/>}
                                            </button>
                                        ))}
                                    </div>
                                    {activeFilters.length > 0 && <div className="p-2 border-t bg-gray-50"><button onClick={clearFilters} className="w-full py-1.5 text-xs text-red-600 hover:bg-red-50 rounded font-medium">Limpar Filtros</button></div>}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileExplorer;