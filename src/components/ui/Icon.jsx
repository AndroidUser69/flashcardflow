// src/components/ui/Icon.jsx
import React from 'react';
import { 
  Upload, ChevronLeft, ChevronRight, RotateCw, RotateCcw, Minus, FilePlus, FolderPlus, 
  Trash2, ArrowUp, Settings, X, Check, CheckSquare, Play, Edit2, BarChart, Download, 
  CloudUpload, Database, Trophy, Search, Folder, Copy, Scissors, Clipboard, MoreVertical, 
  CornerUpLeft, Home, Plus, FileText, Cloud, User, LogOut, Key, HelpCircle, LogIn, 
  Wifi, WifiOff, File, Video, Image, Filter, List, Activity, Clock, Link, HardDrive, 
  Layers, Highlighter, Eraser, Eye, EyeOff 
} from 'lucide-react';

const Icon = ({ name, size = 24, className, onClick }) => {
    // Mapa de nomes (string) para componentes Lucide
    const icons = {
        upload: Upload, chevronLeft: ChevronLeft, chevronRight: ChevronRight, rotateCw: RotateCw, rotateCcw: RotateCcw, minus: Minus, filePlus: FilePlus, folderPlus: FolderPlus, trash2: Trash2, arrowUp: ArrowUp, settings: Settings, x: X, check: Check, checkSquare: CheckSquare, play: Play, edit2: Edit2, barChart: BarChart, download: Download, uploadCloud: CloudUpload, database: Database, trophy: Trophy, search: Search, folder: Folder, copy: Copy, scissors: Scissors, clipboard: Clipboard, cornerUpLeft: CornerUpLeft, home: Home, plus: Plus, fileText: FileText, user: User, logOut: LogOut, logIn: LogIn, video: Video, image: Image, filter: Filter, list: List, activity: Activity, clock: Clock, link: Link, hardDrive: HardDrive, layers: Layers, highlighter: Highlighter, eraser: Eraser, eye: Eye, eyeOff: EyeOff, pdf: FileText
    };

    // Converte kebab-case para camelCase se necessário
    const normalizeName = (n) => n ? n.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) : '';
    
    const LucideIcon = icons[normalizeName(name)] || icons[name] || File;

    return <LucideIcon size={size} className={className} onClick={onClick} />;
};

export default Icon;