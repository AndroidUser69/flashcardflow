import React from 'react';
import Icon from '../ui/Icon';

const CompletionModal = ({ onFinish }) => (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600">
                <Icon name="trophy" size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Fim do Baralho!</h2>
            <div className="flex gap-3">
                <button onClick={() => onFinish(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium">Não</button>
                <button onClick={() => onFinish(true)} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Sim</button>
            </div>
        </div>
    </div>
);

export default CompletionModal;