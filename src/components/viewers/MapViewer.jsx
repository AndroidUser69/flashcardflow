import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import Icon from '../ui/Icon';

const DEFAULT_MAP_DATA = {
    "name": "Novo Mapa Mental",
    "children": [
        { "name": "Ideia Principal 1" },
        { "name": "Ideia Principal 2", "children": [
            { "name": "Detalhe A" },
            { "name": "Detalhe B" }
        ]}
    ]
};

const MapViewer = ({ currentItem, updateMapContent }) => {
    const [viewMode, setViewMode] = useState('map'); // 'map' ou 'editor'
    const [jsonInput, setJsonInput] = useState('');
    const [errorMsg, setErrorMsg] = useState(null);
    
    // Refs para o D3
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const gRef = useRef(null);
    const rootRef = useRef(null); // Mantém o estado da árvore (o que está aberto/fechado)
    const treeMapRef = useRef(null);
    const zoomBehaviorRef = useRef(null);

    // Variáveis de controle de animação
    const duration = 750;
    let i = 0; // Contador para IDs únicos dos nós

    // --- 1. Inicialização do Input (Editor) ---
    useEffect(() => {
        if (currentItem) {
            const content = currentItem.content || JSON.stringify(DEFAULT_MAP_DATA, null, 2);
            setJsonInput(typeof content === 'object' ? JSON.stringify(content, null, 2) : content);
        }
    }, [currentItem.id]);

    // --- 2. Inicialização e Desenho do Mapa (D3) ---
    useEffect(() => {
        if (viewMode === 'map' && containerRef.current) {
            initD3();
            // Carrega os dados
            let data;
            try {
                data = typeof currentItem.content === 'string' ? JSON.parse(currentItem.content) : currentItem.content;
            } catch (e) {
                data = DEFAULT_MAP_DATA;
            }
            if (!data) data = DEFAULT_MAP_DATA;

            // Configura a raiz
            rootRef.current = d3.hierarchy(data, d => d.children);
            rootRef.current.x0 = containerRef.current.clientHeight / 2;
            rootRef.current.y0 = 0;

            // Desenha a primeira vez
            update(rootRef.current);
            centerMap();
        }
        
        // Cleanup ao desmontar ou mudar de view
        return () => {
            if (svgRef.current) {
                d3.select(svgRef.current).on(".zoom", null);
                d3.select(svgRef.current).selectAll("*").remove();
            }
        };
    }, [viewMode, currentItem.id, currentItem.content]); // Recarrega se o ID ou conteúdo mudar externamente

    // --- LÓGICA CORE DO D3 (Portada do mapa.html) ---

    const initD3 = () => {
        if (!containerRef.current) return;
        
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // Limpa tudo antes de iniciar
        d3.select(containerRef.current).selectAll("svg").remove();

        zoomBehaviorRef.current = d3.zoom().on("zoom", (event) => {
            if(gRef.current) gRef.current.attr("transform", event.transform);
        });

        const svg = d3.select(containerRef.current).append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .call(zoomBehaviorRef.current)
            .on("dblclick.zoom", null);

        svgRef.current = svg.node();
        gRef.current = svg.append("g");
        treeMapRef.current = d3.tree().nodeSize([40, 250]); // Altura entre nós, Largura entre níveis
    };

    const update = (source) => {
        if (!gRef.current || !treeMapRef.current) return;

        const treeData = treeMapRef.current(rootRef.current);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // Normaliza a profundidade fixa
        nodes.forEach(d => { d.y = d.depth * 280; });

        // --- NÓS ---
        const node = gRef.current.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        // Enter
        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr("transform", d => `translate(${source.y0},${source.x0})`)
            .on('click', click)
            .style("cursor", "pointer");

        nodeEnter.append('circle')
            .attr('class', 'node')
            .attr('r', 1e-6)
            .style("fill", d => d._children ? "#e0e0e0" : d.depth === 0 ? "#332b00" : d.depth === 1 ? "#002633" : "#330d20")
            .style("stroke", d => {
                if (d.depth === 0) return "#FFD700";
                if (d.depth === 1) return "#00BFFF";
                if (d.depth === 2) return "#FF69B4";
                return "#7FFF00";
            })
            .style("stroke-width", "2px");

        nodeEnter.append('text')
            .attr("dy", ".35em")
            .attr("x", d => d.children || d._children ? -15 : 15)
            .attr("text-anchor", d => d.children || d._children ? "end" : "start")
            .text(d => d.data.name)
            .style('fill-opacity', 1e-6)
            .style("fill", "#e0e0e0")
            .style("font-family", "Inter, sans-serif")
            .style("font-size", "14px")
            .style("text-shadow", "0 1px 3px rgba(0,0,0,0.8)")
            .style("pointer-events", "none");

        // Update
        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition().duration(duration)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('circle')
            .attr('r', 8)
            .style("fill", d => d._children ? "#fff" : d.depth === 0 ? "#332b00" : d.depth === 1 ? "#002633" : "#330d20");

        nodeUpdate.select('text')
            .style('fill-opacity', 1);

        // Exit
        const nodeExit = node.exit().transition().duration(duration)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('circle').attr('r', 1e-6);
        nodeExit.select('text').style('fill-opacity', 1e-6);

        // --- LINKS ---
        const link = gRef.current.selectAll('path.link')
            .data(links, d => d.target.id);

        const linkEnter = link.enter().insert('path', "g")
            .attr("class", "link")
            .attr('d', d => {
                const o = {x: source.x0, y: source.y0};
                return diagonal(o, o);
            })
            .style("fill", "none")
            .style("stroke", "#444")
            .style("stroke-width", "1.5px")
            .style("opacity", "0.6");

        const linkUpdate = linkEnter.merge(link);

        linkUpdate.transition().duration(duration)
            .attr('d', d => diagonal(d.source, d.target));

        link.exit().transition().duration(duration)
            .attr('d', d => {
                const o = {x: source.x, y: source.y};
                return diagonal(o, o);
            })
            .remove();

        // Guarda as posições antigas para transição
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    };

    // Função de curva dos links
    const diagonal = (s, d) => {
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
    };

    // Handler de Clique (Expandir/Recolher)
    const click = (event, d) => {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        update(d);
        // Opcional: Centralizar no nó clicado
        // centerOnNode(d); 
    };

    // --- FUNÇÕES DE CONTROLE ---

    const collapse = (d) => {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    };

    const expand = (d) => {
        var children = (d.children) ? d.children : d._children;
        if (d._children) {
            d.children = d._children;
            d._children = null;
        }
        if (children) children.forEach(expand);
    };

    const handleCollapseAll = () => {
        if (rootRef.current) {
            rootRef.current.children.forEach(collapse);
            update(rootRef.current);
            centerMap();
        }
    };

    const handleExpandAll = () => {
        if (rootRef.current) {
            expand(rootRef.current);
            update(rootRef.current);
            centerMap();
        }
    };

    const centerMap = () => {
        if (!svgRef.current || !containerRef.current) return;
        const height = containerRef.current.clientHeight;
        const t = d3.zoomIdentity.translate(100, height / 2).scale(0.8);
        d3.select(svgRef.current).transition().duration(750).call(zoomBehaviorRef.current.transform, t);
    };

    const handleSaveJson = () => {
        try {
            const parsed = JSON.parse(jsonInput);
            setErrorMsg(null);
            updateMapContent(currentItem.id, parsed);
            setViewMode('map');
        } catch (e) {
            setErrorMsg("Erro no JSON: " + e.message);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#121212] text-gray-200 rounded-lg overflow-hidden border border-gray-800 shadow-xl">
            {/* Header / Tabs */}
            <div className="flex justify-between items-center p-3 bg-[#1e1e1e] border-b border-gray-700 shrink-0">
                <div className="flex gap-2">
                    <button 
                        onClick={() => setViewMode('editor')}
                        className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${viewMode === 'editor' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-800'}`}
                    >
                        <Icon name="code" size={16} /> Editor JSON
                    </button>
                    <button 
                        onClick={() => setViewMode('map')}
                        className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${viewMode === 'map' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-800'}`}
                    >
                        <Icon name="share2" size={16} /> Visualizar Mapa
                    </button>
                </div>
                
                {/* Botões de Ação do Mapa */}
                {viewMode === 'map' && (
                    <div className="flex gap-2">
                        <button onClick={handleExpandAll} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300" title="Expandir Tudo">
                            <Icon name="maximize2" size={16} /> {/* Ícone sugerido, verifique Icon.jsx ou use Plus */}
                        </button>
                        <button onClick={handleCollapseAll} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300" title="Recolher Tudo">
                            <Icon name="minimize2" size={16} /> {/* Ícone sugerido, verifique Icon.jsx ou use Minus */}
                        </button>
                        <button onClick={centerMap} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300" title="Centralizar">
                            <Icon name="crosshair" size={16} />
                        </button>
                    </div>
                )}

                {viewMode === 'editor' && (
                    <button onClick={handleSaveJson} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-2">
                        <Icon name="play" size={14} /> Gerar Mapa
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 relative overflow-hidden w-full h-full">
                {/* Editor View */}
                <div className={`absolute inset-0 flex flex-col p-4 bg-[#0d0d0d] ${viewMode === 'editor' ? 'z-10' : 'z-0 invisible'}`}>
                    <textarea 
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        className="flex-1 w-full bg-[#1e1e1e] text-[#aaddff] font-mono text-sm p-4 rounded border border-gray-700 focus:border-blue-500 outline-none resize-none"
                        spellCheck="false"
                    />
                    {errorMsg && <div className="mt-2 text-red-400 text-sm font-mono">{errorMsg}</div>}
                </div>

                {/* Map View */}
                <div ref={containerRef} className={`absolute inset-0 bg-[#121212] w-full h-full ${viewMode === 'map' ? 'z-10' : 'z-0'}`}>
                    {/* O SVG será injetado aqui pelo D3 */}
                    <div className="absolute bottom-4 right-4 bg-gray-800/80 p-2 rounded text-xs text-gray-400 pointer-events-none select-none z-20 border border-gray-600">
                        Scroll: Zoom • Clique: Expandir/Recolher • Arrastar: Mover
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MapViewer;