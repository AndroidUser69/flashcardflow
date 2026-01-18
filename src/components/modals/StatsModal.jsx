import React, { useState, useEffect } from 'react';
import Icon from '../ui/Icon';
import { safeLocalStorage, TIME_STATS_KEY, DEFAULT_THEME } from '../../utils/constants';

const StatsModal = ({ user, items, theme, lastCloudSave, onClose, onLogout, onSaveCloud, onExport, onImport, onReset }) => {
    const [memory, setMemory] = useState(null); 
    const [storage, setStorage] = useState({ local: '0', cloud: '0' }); 
    const [counts, setCounts] = useState({ deck: 0, note: 0, pdf: 0, video: 0, image: 0, folder: 0, gdrive: 0, shortcut: 0 });

    useEffect(() => { 
        setCounts({ 
            deck: items.filter(i => i.type === 'deck').length, 
            note: items.filter(i => i.type === 'note').length, 
            pdf: items.filter(i => i.type === 'pdf').length, 
            video: items.filter(i => i.type === 'video').length, 
            image: items.filter(i => i.type === 'image').length, 
            folder: items.filter(i => i.type === 'folder').length, 
            gdrive: items.filter(i => i.type === 'gdrive').length, 
            shortcut: items.filter(i => i.type === 'shortcut').length 
        }); 
        
        let localSize = 0; 
        try { for (let key in localStorage) { if (localStorage.hasOwnProperty(key)) localSize += localStorage[key].length * 2; } } catch(e) {} 
        
        const cloudContent = JSON.stringify({ items, theme }); 
        const cloudSize = cloudContent.length * 2; 
        setStorage({ local: (localSize / 1024).toFixed(2) + ' KB', cloud: (cloudSize / 1024).toFixed(2) + ' KB' }); 
        
        if (window.performance && window.performance.memory) 
            setMemory({ used: (window.performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + ' MB', limit: (window.performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1) + ' MB' }); 
    }, [items, theme]);

    // Input ref para importação interna
    const fileRef = React.useRef(null);

    return ( 
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"> 
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative flex flex-col max-h-[90vh]"> 
                <div className="flex justify-between items-center mb-6 border-b pb-2 shrink-0">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Icon name="barChart" size={24} className="text-gray-500"/> Dados e Nuvem</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><Icon name="x" size={24} /></button>
                </div> 
                <div className="overflow-y-auto pr-2 custom-scroll flex-1"> 
                    <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100"> 
                        <div className="flex justify-between mb-2">
                            <h3 className="font-bold gap-2 flex items-center"><Icon name="user" size={16}/> Conta</h3>
                            {user && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Online</span>}
                        </div> 
                        <p className="text-sm text-gray-600 mb-3">{user ? user.email : "Convidado (Offline)"}</p> 
                        {user ? (
                            <div className="space-y-2">
                                <button onClick={onSaveCloud} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center justify-center gap-2">Salvar na Nuvem</button>
                                {lastCloudSave && <p className="text-xs text-center text-gray-400">Salvo: {lastCloudSave.toLocaleString()}</p>}
                                <button onClick={onLogout} className="w-full py-2 border rounded-lg text-sm">Sair</button>
                            </div>
                        ) : (
                            <div className="space-y-2 text-center">
                                <p className="text-xs text-gray-400">Faça login para salvar na nuvem.</p>
                                <button onClick={onLogout} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"><Icon name="logIn" size={16} /> Fazer Login / Criar Conta</button>
                            </div>
                        )} 
                    </div> 
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Estatísticas</h3>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-gray-100 p-3 rounded-lg"><span className="text-xs text-gray-500 block">RAM</span><span className="font-mono text-sm font-bold text-gray-800">{memory ? memory.used : 'N/A'}</span></div>
                            <div className="bg-gray-100 p-3 rounded-lg"><span className="text-xs text-gray-500 block">Local</span><span className="font-mono text-sm font-bold text-gray-800">{storage.local}</span></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-blue-50 p-2 rounded-lg"><span className="block text-xl font-bold text-blue-700">{counts.deck}</span><span className="text-[10px] uppercase text-blue-400">Decks</span></div>
                            <div className="bg-indigo-50 p-2 rounded-lg"><span className="block text-xl font-bold text-indigo-700">{counts.note}</span><span className="text-[10px] uppercase text-indigo-400">Notas</span></div>
                            <div className="bg-pink-50 p-2 rounded-lg"><span className="block text-xl font-bold text-pink-700">{counts.video}</span><span className="text-[10px] uppercase text-pink-400">Vídeos</span></div>
                        </div>
                    </div> 
                    <div className="border-t pt-4">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Backup Local</h3>
                        <button onClick={onExport} className="w-full py-2 mb-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center justify-center gap-2"><Icon name="download" size={16} /> Exportar</button>
                        <div className="relative">
                            <button onClick={() => fileRef.current.click()} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center justify-center gap-2"><Icon name="uploadCloud" size={16} /> Importar</button>
                            <input type="file" accept=".json" ref={fileRef} onChange={onImport} className="hidden" />
                        </div>
                    </div> 
                    <div className="border-t pt-4 mt-4">
                        <button onClick={onReset} className="w-full py-3 bg-red-50 text-red-600 rounded-lg flex items-center justify-center gap-2"><Icon name="trash2" size={20}/> Resetar App</button>
                    </div> 
                </div> 
            </div> 
        </div> 
    );
};

export default StatsModal;