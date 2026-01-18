import React, { useState, useMemo } from 'react';
import Icon from '../ui/Icon';

const MultiDeckCreatorModal = ({ items, currentFolderId, onCreate, onClose, showToast }) => {
    const [selectedDecks, setSelectedDecks] = useState([]);
    const [newName, setNewName] = useState("");
    
    const allDecks = useMemo(() => {
        return items.filter(i => i.type === 'deck').sort((a,b) => a.name.localeCompare(b.name));
    }, [items]);

    const toggleDeck = (id) => {
        setSelectedDecks(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
    };

    const handleCreate = () => {
        if (!newName.trim()) { alert("Digite um nome."); return; }
        if (selectedDecks.length === 0) { alert("Selecione pelo menos um deck."); return; }

        let combinedCards = [];
        selectedDecks.forEach(deckId => {
            const deck = items.find(i => i.id === deckId);
            if (deck && deck.cards) {
                combinedCards = [...combinedCards, ...deck.cards];
            }
        });

        const newMultiDeck = {
            id: Date.now().toString() + Math.random(),
            type: 'deck',
            subtype: 'multi',
            name: newName,
            parentId: currentFolderId,
            cards: combinedCards,
            progress: 0,
            completions: 0,
            views: 0
        };

        onCreate(newMultiDeck);
        if(showToast) showToast('success', `Multiflashcard "${newName}" criado!`);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><Icon name="layers" size={20} className="text-purple-600"/> Criar Multiflashcard</h3>
                    <button onClick={onClose}><Icon name="x" size={20} className="text-gray-400"/></button>
                </div>
                <div className="p-4 border-b bg-gray-50">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome da União</label>
                    <input className="w-full p-2 border rounded focus:border-purple-500 outline-none" placeholder="Ex: Revisão Geral" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    <p className="text-xs text-gray-400 px-2 mb-2">Selecione os decks:</p>
                    {allDecks.length === 0 ? <p className="text-center text-gray-400 py-4">Nenhum deck encontrado.</p> : (
                        <div className="space-y-1">
                            {allDecks.map(deck => (
                                <div key={deck.id} onClick={() => toggleDeck(deck.id)} className={`flex items-center p-3 rounded cursor-pointer border ${selectedDecks.includes(deck.id) ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${selectedDecks.includes(deck.id) ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                                        {selectedDecks.includes(deck.id) && <Icon name="check" size={14} className="text-white"/>}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-gray-700 truncate">{deck.name}</div>
                                        <div className="text-[10px] text-gray-400">{deck.cards?.length || 0} cards</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t">
                    <button onClick={handleCreate} className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-lg transition-transform active:scale-95">Criar União ({selectedDecks.length})</button>
                </div>
            </div>
        </div>
    );
};

export default MultiDeckCreatorModal;