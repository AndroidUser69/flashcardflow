import React from 'react';
import Icon from '../ui/Icon';
import { DEFAULT_THEME } from '../../utils/constants';

const SettingsModal = ({ theme, setTheme, onClose, onSave }) => {
    const handleThemeChange = (k, v) => setTheme(p => ({...p, [k]: v}));

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
                <div className="flex justify-between items-center mb-6 border-b pb-2">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Icon name="settings" size={24} /> Cores e Tema</h2>
                    <button onClick={onClose}><Icon name="x" size={24} /></button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Fundo (Frente)</label>
                            <input type="color" value={theme.frontBg} onChange={(e) => handleThemeChange('frontBg', e.target.value)} className="h-10 w-full rounded border p-1" />
                        </div>
                        {/* Você pode adicionar os outros inputs de cor aqui se desejar expandir */}
                    </div>
                </div>
                <div className="mt-8 flex justify-between gap-3 border-t pt-4 items-center">
                    <button onClick={() => setTheme(DEFAULT_THEME)} className="text-xs text-gray-400 hover:underline">Restaurar Padrão</button>
                    <button onClick={onSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"><Icon name="check" size={16} /> Salvar</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;