import React from 'react';
import Icon from '../ui/Icon';

const FlashcardViewer = ({ 
    currentItem, 
    currentCardIndex, 
    isFlipped, 
    onFlip, 
    onNext, 
    onPrev, 
    theme 
}) => {
    const currentCard = (currentItem && Array.isArray(currentItem.cards)) ? currentItem.cards[currentCardIndex] : null;

    return (
        <div className="w-full max-w-5xl flex-1 flex flex-col items-center my-auto">
            <div className="flex items-center justify-center w-full gap-4 md:gap-8">
                {/* Botão Anterior Desktop */}
                <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="hidden md:flex p-4 rounded-full bg-white text-gray-700 hover:text-blue-600 shadow-lg border transition-all active:scale-95">
                    <Icon name="chevronLeft" size={32} />
                </button>

                {/* Card Container */}
                <div className="perspective-1000 w-full max-w-2xl h-[350px] md:h-[500px] cursor-pointer group relative" onClick={onFlip}>
                    <div className={`relative w-full h-full text-center transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                        
                        {/* Frente */}
                        <div className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-2xl flex flex-col border border-gray-100 overflow-hidden" style={{ backgroundColor: theme.frontBg, color: theme.frontText }}>
                            <div className="h-2 w-full" style={{ backgroundColor: `${theme.progressColor}33` }}>
                                <div className="h-full transition-all duration-300" style={{ width: `${(((currentCardIndex || 0) + 1) / (currentItem.cards?.length || 1)) * 100}%`, backgroundColor: theme.progressColor }}></div>
                            </div>
                            <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto custom-scroll">
                                <div className="flex flex-col gap-6 w-full">
                                    <div className="flex justify-between items-center w-full opacity-50">
                                        <span className="uppercase text-xs font-bold py-1 px-2 border border-current rounded">Pergunta</span>
                                        <span className="text-xs font-mono">{currentCardIndex + 1}/{currentItem.cards?.length || 0}</span>
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-semibold leading-snug">{currentCard ? currentCard.front : ""}</h2>
                                </div>
                            </div>
                            <div className="p-4 text-xs font-medium border-t border-black/5 opacity-50">Toque para virar</div>
                        </div>

                        {/* Verso */}
                        <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-slate-900 rounded-3xl shadow-2xl flex flex-col border border-slate-700 overflow-hidden" style={{ backgroundColor: theme.backBg, color: theme.backText }}>
                            <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto custom-scroll">
                                <div className="flex flex-col gap-6 w-full">
                                    <span className="uppercase text-xs font-bold py-1 px-2 border border-current rounded self-center opacity-60">Resposta</span>
                                    <p className="text-xl md:text-2xl font-light leading-relaxed whitespace-pre-wrap">{currentCard ? currentCard.back : ""}</p>
                                    {currentCard && (
                                        <button onClick={(e) => { e.stopPropagation(); const q = encodeURIComponent(`${currentCard.front} ${currentCard.back} explicar detalhadamente`).replace(/%20/g, '+'); window.open(`https://www.google.com/search?udm=50&aep=11&q=${q}`, '_blank'); }} className="mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs font-medium border border-current opacity-60 hover:opacity-100 hover:bg-white/10 transition-all self-center">
                                            <Icon name="search" size={14} /> Saber mais
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 text-xs font-medium border-t border-white/10 opacity-50">Próximo...</div>
                        </div>
                    </div>
                </div>

                {/* Botão Próximo Desktop */}
                <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="hidden md:flex p-4 rounded-full bg-white text-gray-700 hover:text-blue-600 shadow-lg border transition-all active:scale-95">
                    <Icon name="chevronRight" size={32} />
                </button>
            </div>

            {/* Controles Mobile */}
            <div className="flex md:hidden items-center justify-between w-full max-w-2xl mt-6 gap-4">
                <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="p-4 bg-white rounded-full shadow text-gray-700"><Icon name="chevronLeft" size={24} /></button>
                <button onClick={(e) => { e.stopPropagation(); onFlip(); }} className="flex-1 py-4 text-white rounded-xl shadow font-semibold flex justify-center items-center gap-2" style={{ backgroundColor: theme.progressColor }}><Icon name="rotateCw" size={20} /> Virar</button>
                <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="p-4 bg-white rounded-full shadow text-gray-700"><Icon name="chevronRight" size={24} /></button>
            </div>
        </div>
    );
};

export default FlashcardViewer;