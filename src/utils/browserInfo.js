// src/utils/browserInfo.js
// Coleta informações do navegador/usuário para enriquecer os backups

// Detecta SO
export const getOS = () => {
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Mac/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    if (/CrOS/i.test(ua)) return 'ChromeOS';
    return navigator.platform || '-';
};

// Detecta navegador
export const getBrowser = () => {
    const ua = navigator.userAgent || '';
    if (/Edg/i.test(ua)) return 'Edge';
    if (/OPR|Opera/i.test(ua)) return 'Opera';
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return 'Chrome';
    if (/Firefox/i.test(ua)) return 'Firefox';
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
    if (/MSIE|Trident/i.test(ua)) return 'Internet Explorer';
    return '-';
};

// Resolução da tela
export const getScreenResolution = () => {
    try {
        return `${window.screen.width}x${window.screen.height}`;
    } catch {
        return '-';
    }
};

// Contagem de itens
export const getItemCounts = (items) => {
    if (!items) return { total: 0, pastas: 0, arquivos: 0 };
    const pastas = items.filter(i => i.type === 'folder').length;
    const total = items.length;
    return { total, pastas, arquivos: total - pastas };
};

// Geodados via ip-api.com (cidade + provedor)
export const fetchGeoInfo = async () => {
    try {
        const r = await fetch('https://ip-api.com/json/?fields=status,country,city,isp,query', { 
            signal: AbortSignal.timeout(3000) // Timeout de 3s
        });
        const d = await r.json();
        if (d.status === 'success') {
            return {
                ip: d.query || '-',
                cidade: d.city || '-',
                pais: d.country || '-',
                provedor: d.isp || '-'
            };
        }
        return { ip: '-', cidade: '-', pais: '-', provedor: '-' };
    } catch {
        return { ip: '-', cidade: '-', pais: '-', provedor: '-' };
    }
};