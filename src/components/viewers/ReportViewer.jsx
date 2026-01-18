import React from 'react';
import Icon from '../ui/Icon';
import { safeLocalStorage, TIME_STATS_KEY } from '../../utils/constants';

const ReportViewer = ({ currentItem, items, onItemClick }) => {
    // Lógica complexa de estatísticas extraída do render
    const getReportData = () => {
        const getDescendantIds = (rootId) => {
            let ids = [rootId];
            const children = items.filter(i => i.type === 'folder' && i.parentId === rootId);
            children.forEach(c => ids = ids.concat(getDescendantIds(c.id)));
            return ids;
        };
        const contextIds = currentItem.parentId ? getDescendantIds(currentItem.parentId) : null;
        const contextItems = contextIds ? items.filter(i => contextIds.includes(i.parentId)) : items;
        
        // Estatísticas de Editais
        const editais = contextItems.filter(i => i.type === 'edital');
        const editaisStats = editais.map(ed => {
            let t = 0, l = 0, r = 0;
            try {
                const data = JSON.parse(ed.content);
                data.disciplinas?.forEach(d => d.itens?.forEach(i => {
                    t++;
                    const p = ed.progressMap?.[d.id]?.[i.path];
                    const isLido = typeof p === 'boolean' ? p : (p?.lido || false);
                    const isRevisado = typeof p === 'object' ? (p?.revisado || false) : false;
                    if (isLido) l++;
                    if (isRevisado) r++;
                }));
            } catch(e) {}
            return { ...ed, stats: { total: t, lido: l, revisado: r, pctLido: t > 0 ? Math.round((l/t)*100) : 0 } };
        });

        let totalTopics = 0, totalLido = 0, totalRevisado = 0;
        editaisStats.forEach(e => { totalTopics += e.stats.total; totalLido += e.stats.lido; totalRevisado += e.stats.revisado; });
        
        // Estatísticas de Arquivos
        const counts = contextItems.reduce((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {});
        const excludedTypes = ['folder', 'edital', 'report'];
        const topViewed = contextItems.filter(i => !excludedTypes.includes(i.type) && (i.views || 0) > 0).sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
        
        // Tempo
        const timeStatsRaw = safeLocalStorage.getItem(TIME_STATS_KEY);
        const timeStats = timeStatsRaw ? JSON.parse(timeStatsRaw) : { totalMinutes: 0, days: [] };
        const hours = Math.floor(timeStats.totalMinutes / 60);

        return {
            pctLido: totalTopics > 0 ? Math.round((totalLido/totalTopics)*100) : 0,
            pctRevisado: totalTopics > 0 ? Math.round((totalRevisado/totalTopics)*100) : 0,
            totalLido, totalRevisado, totalTopics,
            editaisStats, counts, topViewed,
            timeDisplay: { days: Math.floor(hours / 24), hours: hours % 24, minutes: timeStats.totalMinutes % 60, avg: timeStats.days.length > 0 ? (timeStats.totalMinutes / timeStats.days.length / 60).toFixed(1) : 0, activeDays: timeStats.days.length }
        };
    };

    const data = getReportData();

    return (
        <div className="w-full max-w-5xl flex-1 flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-0">
            <div className="bg-gray-50 border-b p-3 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 font-semibold text-gray-700">
                    <Icon name="activity" size={18} className="text-orange-500" />
                    {currentItem.name}
                </div>
                <span className="text-xs text-gray-400">Relatório Automático</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scroll bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {/* Progresso Geral */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 md:col-span-2">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Icon name="list" size={20} className="text-green-500"/> Progresso Geral dos Editais</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                                <span className="text-sm text-green-600 block mb-1">Conteúdo Lido</span>
                                <div className="text-3xl font-bold text-green-800">{data.pctLido}%</div>
                                <div className="w-full bg-green-200 h-2 rounded-full mt-2"><div className="bg-green-600 h-2 rounded-full transition-all" style={{width: `${data.pctLido}%`}}></div></div>
                                <p className="text-xs text-green-600 mt-2">{data.totalLido} de {data.totalTopics} tópicos</p>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                                <span className="text-sm text-purple-600 block mb-1">Conteúdo Revisado</span>
                                <div className="text-3xl font-bold text-purple-800">{data.pctRevisado}%</div>
                                <div className="w-full bg-purple-200 h-2 rounded-full mt-2"><div className="bg-purple-600 h-2 rounded-full transition-all" style={{width: `${data.pctRevisado}%`}}></div></div>
                                <p className="text-xs text-purple-600 mt-2">{data.totalRevisado} de {data.totalTopics} tópicos</p>
                            </div>
                        </div>
                    </div>

                    {/* Progresso por Edital */}
                    {data.editaisStats.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 md:col-span-2">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Icon name="list" size={20} className="text-blue-500"/> Progresso por Edital</h3>
                            <div className="space-y-3">
                                {data.editaisStats.map(ed => (
                                    <div key={ed.id} onClick={() => onItemClick(ed)} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-100 group">
                                        <div className="flex-1 min-w-0 pr-4"><p className="text-sm font-medium text-gray-700 truncate group-hover:text-blue-600">{ed.name}</p></div>
                                        <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                                            <div className="flex flex-col items-end w-24">
                                                <div className="flex justify-between w-full mb-1"><span className="font-bold text-gray-700">{ed.stats.pctLido}%</span><span className="text-gray-400">{ed.stats.lido}/{ed.stats.total}</span></div>
                                                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden"><div className="bg-blue-500 h-full rounded-full" style={{width: `${ed.stats.pctLido}%`}}></div></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tempo de Estudo */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Icon name="clock" size={20} className="text-blue-500"/> Tempo de Estudo (Global)</h3>
                        <div className="space-y-4">
                            <div><span className="text-gray-500 text-sm">Tempo Total</span><div className="text-2xl font-mono text-gray-800">{data.timeDisplay.days}d {data.timeDisplay.hours}h {data.timeDisplay.minutes}m</div></div>
                            <div><span className="text-gray-500 text-sm">Média Diária</span><div className="text-2xl font-mono text-gray-800">{data.timeDisplay.avg} horas/dia</div><p className="text-xs text-gray-400">Baseado em {data.timeDisplay.activeDays} dias ativos</p></div>
                        </div>
                    </div>

                    {/* Contagem de Arquivos */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Icon name="database" size={20} className="text-gray-500"/> Arquivos na Pasta</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Flashcards</span> <span className="font-bold">{data.counts.deck||0}</span></div>
                            <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Notas</span> <span className="font-bold">{data.counts.note||0}</span></div>
                            <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Editais</span> <span className="font-bold">{data.counts.edital||0}</span></div>
                            <div className="flex justify-between p-2 bg-gray-50 rounded"><span>PDFs</span> <span className="font-bold">{data.counts.pdf||0}</span></div>
                        </div>
                    </div>

                    {/* Top 10 */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 md:col-span-2">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Icon name="trophy" size={20} className="text-yellow-500"/> Top 10 Mais Visualizados</h3>
                        {data.topViewed.length === 0 ? (<p className="text-gray-400 text-sm italic">Nenhum arquivo visualizado ainda nesta pasta.</p>) : (
                            <div className="space-y-2">
                                {data.topViewed.map((item, idx) => (
                                    <div key={item.id} onClick={() => onItemClick(item)} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-gray-200">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{idx + 1}</span>
                                            <div className="truncate"><p className="font-medium text-gray-700 group-hover:text-blue-600 truncate">{item.name}</p><p className="text-[10px] text-gray-400 uppercase">{item.type}</p></div>
                                        </div>
                                        <div className="flex items-center gap-1 text-gray-400 text-xs"><Icon name="play" size={12} /> {item.views}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportViewer;