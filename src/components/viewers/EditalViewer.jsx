import React from 'react';
import Icon from '../ui/Icon';

const EditalViewer = ({ currentItem, updateEditalContent, updateEditalProgress, onSmartSearch, onToggleEdit }) => {
    // Calcula progresso localmente para exibição no header
    const calculateProgress = () => {
        let total = 0, lidoCount = 0;
        try {
            const data = JSON.parse(currentItem.content);
            data.disciplinas?.forEach(d => { d.itens?.forEach(i => { total++; const p = currentItem.progressMap?.[d.id]?.[i.path]; const isLido = typeof p === 'boolean' ? p : (p?.lido || false); if (isLido) lidoCount++; }); });
        } catch(e) {}
        return total > 0 ? Math.round((lidoCount/total)*100) : 0;
    };

    const pct = calculateProgress();

    return (
        <div className="w-full max-w-5xl flex-1 flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-0">
            <div className="bg-gray-50 border-b p-3 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 font-semibold text-gray-700"><Icon name="list" size={18} className="text-green-500" />{currentItem.name}</div>
                <div className="flex gap-2">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold self-center">{pct}% Lido</span>
                    <button onClick={() => onToggleEdit(currentItem.id, !currentItem.isEditing)} className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded font-medium transition-colors">{currentItem.isEditing ? "Ver Checklist" : "Editar JSON"}</button>
                    <span className="text-xs text-gray-400 self-center">Edital</span>
                </div>
            </div>
            {currentItem.isEditing ? (
                <textarea className="flex-1 p-6 w-full resize-none focus:outline-none text-gray-700 font-mono text-xs leading-relaxed bg-slate-50" value={currentItem.content || ''} onChange={(e) => updateEditalContent(currentItem.id, e.target.value)} placeholder="Cole o JSON aqui..."></textarea>
            ) : (
                <div className="flex-1 overflow-y-auto p-6 custom-scroll">
                    {(() => {
                        try {
                            const data = JSON.parse(currentItem.content);
                            if (!data.disciplinas) return <div className="text-red-500">JSON inválido: Falta 'disciplinas'.</div>;
                            return (
                                <div className="space-y-8">
                                    {data.disciplinas.map(disc => (
                                        <div key={disc.id} className="border-l-4 border-blue-500 pl-4">
                                            <h2 className="text-xl font-bold text-gray-800 mb-4">{disc.titulo}</h2>
                                            <div className="space-y-2">
                                                {disc.itens.map(item => {
                                                    const progress = currentItem.progressMap?.[disc.id]?.[item.path] || {};
                                                    const isLido = typeof progress === 'boolean' ? progress : (progress.lido || false);
                                                    const isRevisado = typeof progress === 'object' ? (progress.revisado || false) : false;
                                                    const isFacil = typeof progress === 'object' ? (progress.facil || false) : false;
                                                    const isDificil = typeof progress === 'object' ? (progress.dificil || false) : false;
                                                    return (
                                                        <div key={item.path} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0 group">
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className={`font-semibold text-gray-800 break-words ${isLido ? 'text-gray-500' : ''}`}>{item.path}. {item.titulo}</h3>
                                                                <div className="text-sm text-gray-600 mt-1 cursor-pointer hover:text-blue-600 hover:bg-blue-50 p-1 -ml-1 rounded transition-colors inline-block" onClick={() => onSmartSearch(item.aula)} title="Clique para buscar este conteúdo no Explorer"><span className="font-bold text-blue-600">({item.aula})</span> - {item.descricao}</div>
                                                            </div>
                                                            <div className="flex gap-2 shrink-0 self-start sm:self-center bg-gray-50 p-2 rounded-lg">
                                                                {[ { id: 'lido', label: 'Lido', color: 'blue' }, { id: 'revisado', label: 'Revisado', color: 'purple' }, { id: 'facil', label: 'Fácil', color: 'green' }, { id: 'dificil', label: 'Difícil', color: 'red' } ].map(btn => {
                                                                    const checked = btn.id === 'lido' ? isLido : btn.id === 'revisado' ? isRevisado : btn.id === 'facil' ? isFacil : isDificil;
                                                                    return (
                                                                        <button key={btn.id} onClick={() => updateEditalProgress(currentItem.id, disc.id, item.path, btn.id, !checked)} className={`flex flex-col items-center justify-center p-1 rounded transition-all w-12 h-12 border ${checked ? `bg-${btn.color}-50 border-${btn.color}-500 text-${btn.color}-600` : 'bg-white border-gray-100 text-gray-400 hover:border-gray-300'}`} title={btn.label}>
                                                                            <span className="text-[9px] font-bold uppercase mb-1 leading-none">{btn.label.substr(0,4)}</span>
                                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? `bg-${btn.color}-500 border-${btn.color}-500` : 'border-gray-300'}`}>{checked && <Icon name="check" size={10} className="text-white" />}</div>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        } catch (e) { return <div className="text-red-500 p-4">Erro ao ler JSON: {e.message}</div>; }
                    })()}
                </div>
            )}
        </div>
    );
};

export default EditalViewer;