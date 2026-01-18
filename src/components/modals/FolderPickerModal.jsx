import React, { useMemo } from 'react';
import Icon from '../ui/Icon';

const FolderPickerModal = ({ items, currentPath, setCurrentPath, onConfirm, onClose }) => {
    const pickerFolders = items.filter(i => i.type === 'folder' && i.parentId === currentPath).sort((a,b) => a.name.localeCompare(b.name));
    
    const breadcrumbs = useMemo(() => { 
        const p = []; let c = currentPath; 
        while(c) { const f = items.find(i => i.id === c); if(f) { p.unshift(f); c = f.parentId; } else break; } 
        return p; 
    }, [currentPath, items]);

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-0 overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2"> <Icon name="link" size={20} className="text-blue-500"/> Criar Atalho </h3>
                    <button onClick={onClose}><Icon name="x" size={20} className="text-gray-400"/></button>
                </div>
                <div className="p-2 bg-white border-b flex items-center gap-1 text-sm overflow-x-auto whitespace-nowrap">
                    <button onClick={() => setCurrentPath(null)} className={`flex items-center px-2 py-1 rounded hover:bg-gray-100 ${!currentPath ? 'font-bold text-blue-700' : 'text-gray-500'}`}> <Icon name="home" size={14} className="mr-1"/> Início </button>
                    {breadcrumbs.map((f, i) => ( <React.Fragment key={f.id}> <span className="text-gray-300">/</span> <button onClick={() => setCurrentPath(f.id)} className={`px-2 py-1 rounded hover:bg-gray-100 ${i === breadcrumbs.length - 1 ? 'font-bold text-blue-700' : 'text-gray-500'}`}> {f.name} </button> </React.Fragment> ))}
                </div>
                <div className="flex-1 overflow-y-auto p-2 bg-gray-50">
                    <div className="text-xs text-gray-500 uppercase font-bold px-2 py-1 mb-1"> Selecione o destino </div>
                    {pickerFolders.length === 0 ? ( <div className="text-center py-8 text-gray-400 text-sm"> Nenhuma subpasta aqui. </div> ) : (
                        <div className="space-y-1">
                            {pickerFolders.map(folder => (
                                <div key={folder.id} className="flex items-center justify-between bg-white p-2 rounded border border-gray-100 hover:border-blue-300 transition-colors group">
                                    <button onClick={() => setCurrentPath(folder.id)} className="flex items-center gap-2 flex-1 text-left min-w-0" > <Icon name="folder" size={16} className="text-yellow-500 shrink-0"/> <span className="text-sm text-gray-700 truncate">{folder.name}</span> </button>
                                    <button onClick={() => onConfirm(folder)} className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-3 py-1 rounded text-xs font-bold transition-colors ml-2" > Selecionar </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-3 border-t bg-white text-xs text-center text-gray-400"> Navegue até encontrar a pasta desejada e clique em "Selecionar". </div>
            </div>
        </div>
    );
};

export default FolderPickerModal;