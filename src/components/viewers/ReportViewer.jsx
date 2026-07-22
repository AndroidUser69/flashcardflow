import React from 'react';
import Icon from '../ui/Icon';
import { safeLocalStorage, TIME_STATS_KEY } from '../../utils/constants';

const ReportViewer = ({ currentItem, items, onItemClick }) => {
    // Função auxiliar para formatar minutos em dias/horas/minutos
    const formatMinutes = (totalMinutes) => {
        if (!totalMinutes || totalMinutes <= 0) return { days: 0, hours: 0, minutes: 0 };
        const days = Math.floor(totalMinutes / 60 / 24);
        const hours = Math.floor((totalMinutes / 60) % 24);
        const minutes = Math.round(totalMinutes % 60);
        return { days, hours, minutes };
    };

    // Função para pegar as SUBPASTAS IMEDIATAS da pasta onde o report está
    // Ex: se o report está em "PastaXX", mostra "PastaXX2" e "PastaXX3" (subpastas diretas)
    // Não mostra pastas aninhadas mais profundas (ex: PastaXX2.1)
    const getFolderStudyTimes = (items, timeStats, parentId) => {
        if (!items || !timeStats?.folderMinutes) return [];
        
        // O parentId para buscar as subpastas é:
        // - Se o report tem pasta pai, usa o parentId do report (a pasta onde ele está)
        // - Se o report está na raiz (parentId = null), mostra pastas da raiz
        const targetParentId = parentId || null;
        
        // Pega as pastas que são FILHAS DIRETAS da pasta onde o report está
        const childFolders = items
            .filter(i => i.type === 'folder' && i.parentId === targetParentId)
            .map(folder => {
                const folderData = timeStats.folderMinutes[folder.id];
                const totalMin = folderData?.totalMinutes || 0;
                const formatted = formatMinutes(totalMin);
                return {
                    id: folder.id,
                    name: folder.name,
                    totalMinutes: totalMin,
                    ...formatted
                };
            })
            .sort((a, b) => b.totalMinutes - a.totalMinutes);
        
        return childFolders;
    };

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
            } catch {
                // ignora erros de parsing
            }
            return { ...ed, stats: { total: t, lido: l, revisado: r, pctLido: t > 0 ? Math.round((l/t)*100) : 0 } };
        });

        let totalTopics = 0, totalLido = 0, totalRevisado = 0;
        editaisStats.forEach(e => { totalTopics += e.stats.total; totalLido += e.stats.lido; totalRevisado += e.stats.revisado; });
        
        // Estatísticas de Arquivos - TODOS os tipos
        const counts = contextItems.reduce((acc, i) => {
            // Mapeia tipos compostos para exibição amigável
            let typeLabel = i.type;
            if (i.type === 'deck') typeLabel = 'flashcard';
            if (i.type === 'pdf_drive') typeLabel = 'pdf';
            if (i.type === 'gdrive') typeLabel = 'gdrive';
            if (i.type === 'external_link') typeLabel = 'link';
            acc[typeLabel] = (acc[typeLabel] || 0) + 1;
            return acc;
        }, {});
        
        // Tipos excluídos do Top 10
        const excludedTypes = ['folder', 'report'];
        
        // Top 10 - inclui TODOS os tipos de arquivo que têm views
        const topViewed = contextItems
            .filter(i => !excludedTypes.includes(i.type) && (i.views || 0) > 0)
            .sort((a, b) => (b.views || 0) - (a.views || 0))
            .slice(0, 10);
        
        // Tempo Global + Por Pasta
        const timeStatsRaw = safeLocalStorage.getItem(TIME_STATS_KEY);
        const timeStats = timeStatsRaw ? JSON.parse(timeStatsRaw) : { totalMinutes: 0, days: [], dailyMinutes: {}, folderMinutes: {} };
        
        // Migração suave: se não tem dailyMinutes, cria
        if (!timeStats.dailyMinutes) timeStats.dailyMinutes = {};
        if (!timeStats.folderMinutes) timeStats.folderMinutes = {};
        
        const hours = Math.floor(timeStats.totalMinutes / 60);
        const totalMinutes = timeStats.totalMinutes;
        
        // Calcular total de dias únicos com base no dailyMinutes (mais preciso)
        const activeDays = Object.keys(timeStats.dailyMinutes || {}).length || timeStats.days?.length || 0;
        
        // Tempo por pasta (escopo do relatório)
        let folderTimeDisplay = null;
        if (currentItem.parentId) {
            const folderStats = timeStats.folderMinutes?.[currentItem.parentId];
            if (folderStats && folderStats.totalMinutes > 0) {
                const fh = Math.floor(folderStats.totalMinutes / 60);
                folderTimeDisplay = {
                    totalMinutes: folderStats.totalMinutes,
                    days: Math.floor(fh / 24),
                    hours: fh % 24,
                    minutes: Math.round(folderStats.totalMinutes % 60)
                };
            }
        }

        // Tempo de estudo por pastas FILHAS da pasta onde o report está
        // Se o report está dentro de "PastaXX", mostra "PastaXX2", "PastaXX3" etc.
        // Se o report está na raiz (parentId = null), mostra pastas da raiz
        const folderStudyTimes = getFolderStudyTimes(items, timeStats, currentItem.parentId);
        
        // --- Calendário do mês atual ---
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-based
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0=domingo
        
        // Array de dias do mês com dados
        const calendarDays = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === today.toISOString().split('T')[0];
            const minutesOnDay = timeStats.dailyMinutes?.[dateStr] || 0;
            const wasActive = minutesOnDay > 0 || timeStats.days?.includes(dateStr);
            calendarDays.push({
                day: d,
                dateStr,
                isToday,
                wasActive,
                minutes: minutesOnDay
            });
        }

        return {
            pctLido: totalTopics > 0 ? Math.round((totalLido/totalTopics)*100) : 0,
            pctRevisado: totalTopics > 0 ? Math.round((totalRevisado/totalTopics)*100) : 0,
            totalLido, totalRevisado, totalTopics,
            editaisStats, counts, topViewed,
            timeDisplay: {
                days: Math.floor(hours / 24),
                hours: hours % 24,
                minutes: Math.round(totalMinutes % 60),
                avg: activeDays > 0 ? (totalMinutes / activeDays / 60).toFixed(1) : 0,
                activeDays,
                totalMinutes
            },
            folderTimeDisplay,
            folderStudyTimes,
            calendarDays,
            firstDayOfWeek,
            monthName: today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
            daysOfWeek: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
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

                    {/* Tempo de Estudo Global + Calendário */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 md:col-span-2">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Icon name="clock" size={20} className="text-blue-500"/> Tempo de Estudo (Global)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <span className="text-gray-500 text-sm">Tempo Total</span>
                                    <div className="text-2xl font-mono text-gray-800">
                                        {data.timeDisplay.days}d {data.timeDisplay.hours}h {data.timeDisplay.minutes}m
                                    </div>
                                </div>
                                <div>
                                    <span className="text-gray-500 text-sm">Média Diária</span>
                                    <div className="text-2xl font-mono text-gray-800">{data.timeDisplay.avg} h/dia</div>
                                    <p className="text-xs text-gray-400">Baseado em {data.timeDisplay.activeDays} dias ativos</p>
                                </div>
                            </div>
                            
                            {/* Calendário do Mês Atual */}
                            <div className="md:col-span-2">
                                <div className="text-sm font-semibold text-gray-600 mb-2 capitalize">{data.monthName}</div>
                                <div className="grid grid-cols-7 gap-1 text-center">
                                    {data.daysOfWeek.map(dow => (
                                        <div key={dow} className="text-[10px] font-semibold text-gray-400 py-1">{dow}</div>
                                    ))}
                                    {/* Espaços vazios antes do primeiro dia */}
                                    {Array.from({ length: data.firstDayOfWeek }).map((_, i) => (
                                        <div key={`empty-${i}`} className="p-1"></div>
                                    ))}
                                    {data.calendarDays.map(d => {
                                        let bgClass = 'bg-gray-50 text-gray-500';
                                        let ringClass = '';
                                        let title = '';
                                        if (d.isToday) {
                                            bgClass = 'bg-blue-500 text-white';
                                            ringClass = 'ring-2 ring-blue-300';
                                        } else if (d.wasActive) {
                                            bgClass = 'bg-green-100 text-green-700';
                                        }
                                        if (d.wasActive && d.minutes > 0) {
                                            const h = Math.floor(d.minutes / 60);
                                            const m = Math.round(d.minutes % 60);
                                            title = `${h}h ${m}m de estudo`;
                                        } else {
                                            title = `${d.day} - sem atividade`;
                                        }
                                        return (
                                            <div
                                                key={d.day}
                                                title={title}
                                                className={`p-1 rounded-md text-xs font-medium cursor-default ${bgClass} ${ringClass} transition-colors relative group`}
                                            >
                                                <span>{d.day}</span>
                                                {/* Tooltip customizado via título já funciona */}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div> Com atividade</div>
                                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500"></div> Hoje</div>
                                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-gray-50 border border-gray-200"></div> Sem atividade</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tempo de Estudo por Pasta (Escopo do Relatório) */}
                    {data.folderTimeDisplay && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 md:col-span-2">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Icon name="folder" size={20} className="text-indigo-500"/> Tempo de Estudo nesta Pasta</h3>
                            <div className="flex items-center gap-6">
                                <div>
                                    <span className="text-gray-500 text-sm">Tempo Total</span>
                                    <div className="text-2xl font-mono text-gray-800">
                                        {data.folderTimeDisplay.days}d {data.folderTimeDisplay.hours}h {data.folderTimeDisplay.minutes}m
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NOVA SEÇÃO: Tempo de Estudo por Pastas Principais */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 md:col-span-2">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Icon name="layers" size={20} className="text-emerald-500"/> Tempo de Estudo por Pastas</h3>
                        {data.folderStudyTimes.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <Icon name="folder" size={48} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Nenhuma pasta criada na raiz ainda.</p>
                                <p className="text-xs mt-1">Crie pastas na raiz para ver o tempo acumulado de cada uma.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data.folderStudyTimes.map((folder, idx) => {
                                    // Cores alternadas para distinguir as pastas
                                    const colors = [
                                        'border-l-emerald-400 bg-emerald-50',
                                        'border-l-blue-400 bg-blue-50',
                                        'border-l-violet-400 bg-violet-50',
                                        'border-l-amber-400 bg-amber-50',
                                        'border-l-rose-400 bg-rose-50',
                                        'border-l-cyan-400 bg-cyan-50',
                                        'border-l-orange-400 bg-orange-50',
                                        'border-l-teal-400 bg-teal-50'
                                    ];
                                    const colorClass = colors[idx % colors.length];
                                    
                                    return (
                                        <div 
                                            key={folder.id} 
                                            className={`flex items-center justify-between p-4 rounded-lg border-l-4 ${colorClass} transition-colors`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Icon name="folder" size={20} className="text-gray-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-gray-700 truncate">{folder.name}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-4">
                                                <div className="text-lg font-mono font-bold text-gray-800">
                                                    {folder.days > 0 ? `${folder.days}d ` : ''}
                                                    {folder.hours}h {folder.minutes}m
                                                </div>
                                                {folder.totalMinutes > 0 && (
                                                    <div className="w-full bg-gray-200 h-1.5 rounded-full mt-1 overflow-hidden min-w-[80px]">
                                                        <div 
                                                            className="bg-emerald-500 h-full rounded-full transition-all"
                                                            style={{ 
                                                                width: data.timeDisplay.totalMinutes > 0 
                                                                    ? `${(folder.totalMinutes / data.timeDisplay.totalMinutes) * 100}%` 
                                                                    : '0%' 
                                                            }}
                                                        ></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Contagem de Arquivos - TODOS os tipos */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Icon name="database" size={20} className="text-gray-500"/> Arquivos na Pasta</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(data.counts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                                const typeLabels = {
                                    'flashcard': 'Flashcards',
                                    'note': 'Notas',
                                    'edital': 'Editais',
                                    'pdf': 'PDFs',
                                    'video': 'Vídeos',
                                    'image': 'Imagens',
                                    'gdrive': 'Google Drive',
                                    'link': 'Links Externos',
                                    'map': 'Mapas Mentais'
                                };
                                const typeIcons = {
                                    'flashcard': '🃏',
                                    'note': '📝',
                                    'edital': '📋',
                                    'pdf': '📄',
                                    'video': '🎬',
                                    'image': '🖼️',
                                    'gdrive': '☁️',
                                    'link': '🔗',
                                    'map': '🗺️'
                                };
                                return (
                                    <div key={type} className="flex justify-between p-2 bg-gray-50 rounded items-center">
                                        <span><span className="mr-1">{typeIcons[type] || '📁'}</span>{typeLabels[type] || type}</span>
                                        <span className="font-bold">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Top 10 Mais Visualizados */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 md:col-span-2">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Icon name="trophy" size={20} className="text-yellow-500"/> Top 10 Mais Visualizados</h3>
                        {data.topViewed.length === 0 ? (<p className="text-gray-400 text-sm italic">Nenhum arquivo visualizado ainda nesta pasta.</p>) : (
                            <div className="space-y-2">
                                {data.topViewed.map((item, idx) => {
                                    const typeLabels = {
                                        'deck': 'Flashcard',
                                        'note': 'Nota',
                                        'edital': 'Edital',
                                        'pdf': 'PDF',
                                        'pdf_drive': 'PDF',
                                        'video': 'Vídeo',
                                        'image': 'Imagem',
                                        'gdrive': 'Google Drive',
                                        'external_link': 'Link Externo',
                                        'map': 'Mapa Mental'
                                    };
                                    return (
                                        <div key={item.id} onClick={() => onItemClick(item)} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-gray-200">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{idx + 1}</span>
                                                <div className="truncate"><p className="font-medium text-gray-700 group-hover:text-blue-600 truncate">{item.name}</p><p className="text-[10px] text-gray-400 uppercase">{typeLabels[item.type] || item.type}</p></div>
                                            </div>
                                            <div className="flex items-center gap-1 text-gray-400 text-xs"><Icon name="play" size={12} /> {item.views}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportViewer;