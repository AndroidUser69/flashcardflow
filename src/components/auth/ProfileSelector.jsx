// src/components/auth/ProfileSelector.jsx
import React, { useState } from 'react';
import Icon from '../ui/Icon';
import { profilesHelper } from '../../utils/profiles';
import { MAX_LOCAL_PROFILES } from '../../utils/constants';

const ProfileSelector = ({ onSelectProfile, onCloudLogin }) => {
    const [profiles, setProfiles] = useState(() => profilesHelper.getProfiles());
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');

    const refresh = () => setProfiles(profilesHelper.getProfiles());

    const handleCreate = (e) => {
        e.preventDefault();
        const created = profilesHelper.addProfile(name);
        if (!created) {
            alert(profiles.length >= MAX_LOCAL_PROFILES
                ? `Limite de ${MAX_LOCAL_PROFILES} perfis locais atingido.`
                : 'Já existe um perfil com esse nome.');
            return;
        }
        setName('');
        setCreating(false);
        refresh();
        onSelectProfile(created.id);
    };

    const handleDelete = (id) => {
        if (confirm('Apagar este perfil local? Os dados dele serão removidos do dispositivo.')) {
            profilesHelper.deleteProfile(id);
            refresh();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <Icon name="user" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Flashcard Flow</h1>
                        <p className="text-sm text-gray-500">Escolha um perfil local</p>
                    </div>
                </div>

                {/* Lista de perfis */}
                <div className="space-y-2 mb-4">
                    {profiles.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">
                            Nenhum perfil ainda. Crie o primeiro abaixo.
                        </p>
                    )}
                    {profiles.map(p => (
                        <div key={p.id} className="flex items-center gap-2">
                            <button
                                onClick={() => onSelectProfile(p.id)}
                                className="flex-1 flex items-center gap-3 p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl transition-colors text-left"
                            >
                                <div className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
                                    {p.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-gray-700 truncate">{p.name}</span>
                            </button>
                            {p.name !== 'Convidado' && (
                                <button
                                    onClick={() => handleDelete(p.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Apagar perfil"
                                >
                                    <Icon name="trash2" size={18} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Criar novo perfil */}
                {creating ? (
                    <form onSubmit={handleCreate} className="space-y-2 mb-4">
                        <input
                            autoFocus
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Nome do perfil"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            maxLength={30}
                        />
                        <div className="flex gap-2">
                            <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
                                Criar
                            </button>
                            <button type="button" onClick={() => { setCreating(false); setName(''); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
                                Cancelar
                            </button>
                        </div>
                    </form>
                ) : (
                    profiles.length < MAX_LOCAL_PROFILES && (
                        <button
                            onClick={() => setCreating(true)}
                            className="w-full flex items-center justify-center gap-2 py-3 mb-4 border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-600 rounded-xl transition-colors font-medium"
                        >
                            <Icon name="plus" size={18} /> Novo perfil local
                        </button>
                    )
                )}

                <div className="relative flex py-3 items-center">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OU</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <div className="flex flex-col gap-2">
                    <button
                        onClick={onCloudLogin}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Icon name="cloud" size={18} /> Entrar com Conta na Nuvem
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileSelector;