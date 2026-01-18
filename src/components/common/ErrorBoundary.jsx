import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, errorInfo) { console.error("Critical Error:", error, errorInfo); }
    render() {
        if (this.state.hasError) {
            return <div className="p-6 text-center text-red-600"><h2>Ops! Erro crítico.</h2><button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-100 rounded">Recarregar</button></div>;
        }
        return this.props.children;
    }
}

export default ErrorBoundary;