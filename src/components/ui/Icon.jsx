// src/components/ui/Icon.jsx
import React from 'react';
import { 
  Upload, ChevronLeft, ChevronRight, RotateCw, RotateCcw, Minus, FilePlus, FolderPlus, 
  Trash2, ArrowUp, Settings, X, Check, CheckSquare, Play, Edit2, BarChart, Download, 
  CloudUpload, Database, Trophy, Search, Folder, Copy, Scissors, Clipboard, MoreVertical, 
  CornerUpLeft, Home, Plus, FileText, Cloud, User, LogOut, Key, HelpCircle, LogIn, 
  Wifi, WifiOff, File, Video, Image, Filter, List, Activity, Clock, Link, HardDrive, 
  Share2, ExternalLink, Code, Layers, Highlighter, Eraser, Eye, EyeOff, Maximize2, Minimize2,
  Crosshair, PlusSquare, Pen, StickyNote, MessageSquare, Bold, Italic, Heading, List as ListIcon,
  Hash, Quote, Pilcrow, Code2, Table, ImageIcon, Link2, SeparatorHorizontal
} from 'lucide-react';

const Icon = ({ name, size = 24, className, onClick }) => {
    // Mapa de nomes (string) para componentes Lucide
    const icons = {
        upload: Upload, chevronLeft: ChevronLeft, chevronRight: ChevronRight, rotateCw: RotateCw, rotateCcw: RotateCcw, minus: Minus, filePlus: FilePlus, folderPlus: FolderPlus, trash2: Trash2, arrowUp: ArrowUp, settings: Settings, x: X, check: Check, checkSquare: CheckSquare, play: Play, edit2: Edit2, barChart: BarChart, download: Download, uploadCloud: CloudUpload, database: Database, trophy: Trophy, search: Search, folder: Folder, copy: Copy, scissors: Scissors, clipboard: Clipboard, cornerUpLeft: CornerUpLeft, home: Home, plus: Plus, fileText: FileText, user: User, logOut: LogOut, logIn: LogIn, video: Video, image: Image, filter: Filter, list: List, activity: Activity, clock: Clock, link: Link, hardDrive: HardDrive, layers: Layers, highlighter: Highlighter, eraser: Eraser, eye: Eye, eyeOff: EyeOff, pdf: FileText, share2: Share2,
        externalLink: ExternalLink, code: Code, maximize2: Maximize2, minimize2: Minimize2, crosshair: Crosshair, plusSquare: PlusSquare,
        pen: Pen, stickyNote: StickyNote, messageSquare: MessageSquare,
        bold: Bold, italic: Italic, heading: Heading, hash: Hash, quote: Quote,
        pilcrow: Pilcrow, code2: Code2, table: Table, imageIcon: ImageIcon, link2: Link2,
        separatorHorizontal: SeparatorHorizontal
    };

    // Converte kebab-case para camelCase se necessário
    const normalizeName = (n) => n ? n.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) : '';
    
    const LucideIcon = icons[normalizeName(name)] || icons[name] || File;

    return <LucideIcon size={size} className={className} onClick={onClick} />;
};

export default Icon;