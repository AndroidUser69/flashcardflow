// Arquivo: src/components/auth/AuthScreen.jsx
import React, { useState } from 'react';
// IMPORTANTE: Agora importamos direto do utils, não usamos mais window.
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../../utils/firebase';

const AuthScreen = ({ onLogin, onGuest }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let userCredential;
            if (isRegister) {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
            } else {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            }
            // O onAuthStateChanged no App.jsx vai detectar o login automaticamente,
            // mas chamamos onLogin aqui para garantir a transição de UI se necessário.
            if (userCredential && onLogin) onLogin(userCredential.user);
        } catch (err) {
            console.error("Erro Auth:", err);
            setError(err.message === "Firebase: Error (auth/invalid-credential)." ? "Email ou senha incorretos." : err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
                <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Flashcard Flow</h1>
                
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="seu@email.com" 
                            required 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="******" 
                            required 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={loading} 
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition-colors disabled:opacity-50"
                    >
                        {loading ? "Carregando..." : (isRegister ? "Criar Conta" : "Entrar")}
                    </button>
                </form>

                <div className="mt-6 flex flex-col gap-3 text-center">
                    <button 
                        onClick={() => setIsRegister(!isRegister)} 
                        className="text-sm text-blue-600 hover:underline"
                    >
                        {isRegister ? "Já tem conta? Entrar" : "Não tem conta? Cadastre-se"}
                    </button>
                    
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-300"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OU</span>
                        <div className="flex-grow border-t border-gray-300"></div>
                    </div>

                    <button 
                        onClick={onGuest} 
                        className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                    >
                        Continuar sem conta (Modo Offline)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;