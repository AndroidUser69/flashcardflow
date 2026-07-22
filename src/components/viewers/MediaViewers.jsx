import React, { useState } from 'react';
import Icon from '../ui/Icon';
import { getEmbedUrl, getHostname } from '../../utils/formatHelpers';

export const VideoViewer = ({ currentItem }) => (
    <div className="w-full max-w-5xl flex-1 flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-0">
        <div className="bg-gray-50 border-b p-3 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 font-semibold text-gray-700"><Icon name="video" size={18} className="text-pink-500" />{currentItem.name}</div>
            <span className="text-xs text-gray-400">Vídeo Link</span>
        </div>
        <div className="flex-1 bg-black relative">
            <iframe src={getEmbedUrl(currentItem.content)} className="absolute inset-0 w-full h-full border-none" title={currentItem.name} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
        </div>
    </div>
);

export const ImageViewer = ({ currentItem }) => {
    const [imageZoom, setImageZoom] = useState(1);
    const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e) => { e.preventDefault(); setIsDraggingImage(true); setDragStart({ x: e.clientX - imagePos.x, y: e.clientY - imagePos.y }); };
    const handleMouseMove = (e) => { if (!isDraggingImage) return; e.preventDefault(); setImagePos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
    const handleMouseUp = () => { setIsDraggingImage(false); };
    const reset = () => { setImageZoom(1); setImagePos({ x: 0, y: 0 }); };

    return (
        <div className="w-full max-w-5xl flex-1 flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-0">
            <div className="bg-gray-50 border-b p-3 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 font-semibold text-gray-700"><Icon name="image" size={18} className="text-purple-500" />{currentItem.name}</div>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{getHostname(currentItem.content)}</span>
                    <span className="text-xs text-gray-400">Imagem Web</span>
                </div>
            </div>
            <div className="flex-1 bg-gray-100 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                <div className="absolute top-4 right-4 z-10 flex gap-2 bg-white/80 p-1 rounded-lg shadow backdrop-blur-sm">
                    <button onClick={() => setImageZoom(z => Math.max(0.1, z - 0.1))} className="p-1 hover:bg-gray-200 rounded"><Icon name="minus" size={16}/></button>
                    <span className="text-xs w-8 text-center self-center">{Math.round(imageZoom * 100)}%</span>
                    <button onClick={() => setImageZoom(z => z + 0.1)} className="p-1 hover:bg-gray-200 rounded"><Icon name="plus" size={16}/></button>
                    <button onClick={reset} className="p-1 hover:bg-gray-200 rounded text-red-500" title="Resetar"><Icon name="rotateCcw" size={16}/></button>
                </div>
                <div className="w-full h-full flex items-center justify-center pointer-events-none">
                    <img src={currentItem.content} alt={currentItem.name} style={{ transform: `translate(${imagePos.x}px, ${imagePos.y}px) scale(${imageZoom})`, transformOrigin: 'center', transition: isDraggingImage ? 'none' : 'transform 0.2s ease-out', cursor: isDraggingImage ? 'grabbing' : 'grab' }} className="max-w-full max-h-full object-contain pointer-events-auto" draggable="false" onError={(e) => {e.target.onerror = null; e.target.src = 'https://via.placeholder.com/400x300?text=Erro+ao+carregar+imagem'}} />
                </div>
            </div>
        </div>
    );
};

export const GDriveViewer = ({ currentItem }) => (
    <div className="w-full max-w-5xl flex-1 flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-0">
        <div className="bg-gray-50 border-b p-3 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 font-semibold text-gray-700"><Icon name="hardDrive" size={18} className="text-blue-600" />{currentItem.name}</div>
            <span className="text-xs text-gray-400">Pasta Google Drive</span>
        </div>
        <div className="flex-1 bg-white relative">
            <iframe src={`pastadrive.html?key=AIzaSyA7KSKkCsGcyu7M_6O57lKVMvpUQ53GKJc&folder=${currentItem.content}`} width="100%" height="100%" style={{border: 'none'}} title="Google Drive Content"></iframe>
        </div>
    </div>
);