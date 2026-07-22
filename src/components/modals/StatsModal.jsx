import React, { useMemo } from 'react';
import Icon from '../ui/Icon';
import { safeLocalStorage, getStorageKey } from '../../utils/constants';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const StatsModal = ({ 
    user, 
    items = [], 
    lastCloudSave, 
    isGuest, 
    storageEstimate, 
    onClose, 
    onLogout, 
    onSaveCloud, 
    onExport, 
    onImport, 
    onImportStudyFiles, 
    onReset,
    backups = [],
    onRestoreBackup,
    onCreateManualBackup
}) => {
    // Calcula as contagens usando useMemo para evitar renders desnecessários e warnings
    const counts = useMemo(() => {
        return { 
            deck: items.filter(i => i.type === 'deck').length, 
            note: items.filter(i => i.type === 'note').length, 
            pdf: items.filter(i => i.type === 'pdf').length, 
            video: items.filter(i => i.type === 'video').length, 
            image: items.filter(i => i.type === 'image').length, 
            folder: items.filter(i => i.type === 'folder').length, 
            gdrive: items.filter(i => i.type === 'gdrive').length, 
            shortcut: items.filter(i => i.type === 'shortcut').length 
        };
    }, [items]);

    const memory = useMemo(() => {
        if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
            return {
                used: (window.performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + ' MB',
                limit: (window.performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1) + ' MB'
            };
        }
        return null;
    }, []);

    // Estimativa de armazenamento do localStorage para exibição
    const localStorageUsage = useMemo(() => {
        try {
            const key = getStorageKey(user);
            return (safeLocalStorage.getItem(key) || "").length * 2;
        } catch {
            return 0;
        }
    }, [user]);

    // Input ref para importação de backup local (.json)
    const fileRef = React.useRef(null);

    return ( 
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"> 
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative flex flex-col max-h-[90vh]"> 
                <div className="flex justify-between items-center mb-6 border-b pb-2 shrink-0">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Icon name="barChart" size={24} className="text-gray-500"/> Dados e Nuvem</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><Icon name="x" size={24} /></button>
                </div> 
                <div className="overflow-y-auto pr-2 custom-scroll flex-1"> 
                    
                    {/* Seção Conta */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100"> 
                        <div className="flex justify-between mb-2">
                            <h3 className="font-bold gap-2 flex items-center"><Icon name="user" size={16}/> Conta</h3>
                            {user && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Online</span>}
                        </div> 
                        <p className="text-sm text-gray-600 mb-3">{user ? user.email : "Convidado (Offline)"}</p> 
                        {user ? (
                            <div className="space-y-2">
                                <button onClick={onSaveCloud} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">Salvar na Nuvem</button>
                                {lastCloudSave && <p className="text-xs text-center text-gray-400">Salvo: {lastCloudSave.toLocaleString()}</p>}
                                <button onClick={onLogout} className="w-full py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors">Sair</button>
                            </div>
                        ) : (
                            <div className="space-y-2 text-center">
                                <p className="text-xs text-gray-400">Faça login para salvar na nuvem.</p>
                                <button onClick={onLogout} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"><Icon name="logIn" size={16} /> Fazer Login / Criar Conta</button>
                            </div>
                        )} 
                    </div> 

                    {/* Dashboard de Armazenamento Inteligente */}
                    <div className="mb-6 p-4 bg-gray-50 border border-gray-100 rounded-xl text-left space-y-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Icon name="database" size={12} className="text-blue-500" /> Dashboard de Armazenamento
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                                <span className="block text-[10px] text-gray-400 font-medium">IndexedDB (Local)</span>
                                <span className="font-bold text-gray-700 block mt-0.5">{storageEstimate ? formatBytes(storageEstimate.usage) : 'N/A'}</span>
                                <span className="text-[9px] text-gray-400">Limite: {storageEstimate ? formatBytes(storageEstimate.quota) : 'N/A'}</span>
                            </div>
                            
                            <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                                <span className="block text-[10px] text-gray-400 font-medium">LocalStorage</span>
                                <span className="font-bold text-gray-700 block mt-0.5">{formatBytes(localStorageUsage)}</span>
                                <span className="text-[9px] text-gray-400">Limite: 5.0 MB</span>
                            </div>
                        </div>

                        <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm flex items-center justify-between text-xs">
                            <div>
                                <span className="block text-[10px] text-gray-400 font-medium">Backup em Nuvem</span>
                                <span className="font-semibold text-gray-700 mt-0.5 block truncate max-w-[180px]">
                                    {user && !isGuest ? "Sincronizado" : "Inativo (Modo Convidado)"}
                                </span>
                            </div>
                            <span className={`w-2.5 h-2.5 rounded-full ${user && !isGuest ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
                        </div>
                    </div>

                    {/* Seção Estatísticas */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Estatísticas de Itens</h3>
                        <div className="grid grid-cols-3 gap-2 text-center mb-4">
                            <div className="bg-blue-50 p-2 rounded-lg"><span className="block text-xl font-bold text-blue-700">{counts.deck}</span><span className="text-[10px] uppercase text-blue-400">Decks</span></div>
                            <div className="bg-indigo-50 p-2 rounded-lg"><span className="block text-xl font-bold text-indigo-700">{counts.note}</span><span className="text-[10px] uppercase text-indigo-400">Notas</span></div>
                            <div className="bg-pink-50 p-2 rounded-lg"><span className="block text-xl font-bold text-pink-700">{counts.video}</span><span className="text-[10px] uppercase text-pink-400">Vídeos</span></div>
                        </div>
                        {memory && (
                            <div className="bg-gray-100 p-3 rounded-lg flex justify-between items-center text-xs">
                                <span className="text-gray-500 font-semibold">RAM Usada (JS Heap)</span>
                                <span className="font-mono font-bold text-gray-800">{memory.used}</span>
                            </div>
                        )}
                    </div> 

                    {/* Importação e Backup */}
                    <div className="border-t pt-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Ações de Importação e Backup</h3>
                        
                        {onImportStudyFiles && (
                            <button onClick={onImportStudyFiles} className="w-full py-3 mb-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 shadow transition-colors"><Icon name="filePlus" size={18} /> Importar Arquivo (.csv / .txt / .pdf)</button>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={onExport} className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"><Icon name="download" size={16} /> Exportar Backup</button>
                            <div className="relative">
                                <button onClick={() => fileRef.current.click()} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"><Icon name="uploadCloud" size={16} /> Importar Backup</button>
                                <input type="file" accept=".json" ref={fileRef} onChange={onImport} className="hidden" />
                            </div>
                        </div>
                    </div> 

                    {/* Histórico de Backups Automáticos */}
                    <div className="border-t pt-4 mt-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Icon name="clock" size={12} /> Backups ({backups.length}/3)
                        </h3>
                        
                        <button onClick={onCreateManualBackup} className="w-full py-2 mb-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors border border-amber-200">
                            <Icon name="plus" size={16} /> Criar Backup Manual
                        </button>

                        {backups.length > 0 && (
                            <>
                                <div className="space-y-2">
                                    {[...backups].reverse().map((b, i) => {
                                        const realIndex = backups.length - 1 - i;
                                        const sizeKB = b.sizeBytes ? (b.sizeBytes / 1024).toFixed(1) : '?';
                                        return (
                                            <div key={b.createdAt} className="p-2 bg-white border border-gray-100 rounded-lg text-xs">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Icon name="archive" size={14} className="text-gray-400" />
                                                        <span className="text-gray-600 font-medium">
                                                            {new Date(b.createdAt).toLocaleDateString()} {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <button onClick={() => onRestoreBackup(realIndex)} className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[10px] font-medium transition-colors border border-amber-200">Restaurar</button>
                                                </div>
                                                <div className="flex flex-col gap-0.5 mt-1 text-[10px] text-gray-400">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span>{sizeKB} KB</span>
                                                        {b.profileName && <span>• {b.profileName}</span>}
                                                        {b.ip && b.ip !== '-' && <span>• IP: {b.ip}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span>📱 {b.os || '-'}</span>
                                                        <span>🌐 {b.browser || '-'}</span>
                                                        <span>🖥️ {b.resolucao || '-'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span>📦 {b.totalArquivos || '-'} itens</span>
                                                        <span>📁 {b.totalPastas || '-'} pastas</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span>📍 {b.cidade || '-'}</span>
                                                        <span>📡 {b.provedor || '-'}</span>
                                                    </div>
                                                    {b.deviceId && b.deviceId !== 'desconhecido' && <span className="truncate max-w-[250px]" title={b.deviceId}>🖥️ {b.deviceId}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-[9px] text-gray-400 mt-2">Backup automático criado na primeira alteração após entrar.</p>
                            </>
                        )}
                    </div>

                    <div className="border-t pt-4 mt-4">
                        <button onClick={onReset} className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"><Icon name="trash2" size={16}/> Resetar App</button>
                    </div> 
                </div> 
            </div> 
        </div> 
    );
};

export default StatsModal;
