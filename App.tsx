
import React, { useState, useMemo, useEffect } from 'react';
import { Layer, Shape, ToolMode, BaseLayer, GeoPoint } from './types';
import LayerManager from './components/LayerManager';
import MapCanvas from './components/MapCanvas';
import AnalysisModal from './components/AnalysisModal';
import { analyzeMeasurements } from './services/geminiService';
import { MousePointer2, PenTool, Ruler, Calculator, AlertTriangle, MapPin, Upload, Search, Trash2 } from 'lucide-react';
import * as turf from '@turf/turf';

// Safe ID Generator
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const App: React.FC = () => {
  // Project State
  const [layers, setLayers] = useState<Layer[]>([
    { id: '1', name: 'Murs', color: '#ef4444', type: 'surface', category: 'measurement', isVisible: true, opacity: 0.5 },
  ]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>('1');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>(ToolMode.SELECT);
  
  // Map Config State
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('plan');
  const [mapCenter, setMapCenter] = useState<GeoPoint | null>(null);
  const [mapUrl, setMapUrl] = useState('');

  // AI Analysis State
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');

  // --- Effects ---
  
  // Handle keyboard events (Global)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Ignore if typing in input fields
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        // Delete Shape
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId) {
            handleDeleteShape(selectedShapeId);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, shapes]);

  // --- Actions ---

  const handleAddLayer = (name: string, type: 'surface' | 'length', color: string) => {
    const newLayer: Layer = {
      id: generateId(),
      name,
      type,
      category: 'measurement',
      color,
      isVisible: true,
      opacity: type === 'surface' ? 0.5 : 1.0
    };
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
    setToolMode(type === 'surface' ? ToolMode.DRAW_POLYGON : ToolMode.DRAW_LINE);
    setSelectedShapeId(null);
  };

  const handleDeleteLayer = (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce calque et toutes ses mesures ?")) {
        setLayers(prev => prev.filter(l => l.id !== id));
        setShapes(prev => prev.filter(s => s.layerId !== id));
        if (activeLayerId === id) setActiveLayerId(null);
    }
  };

  const handleToggleVisibility = (id: string) => setLayers(prev => prev.map(l => l.id === id ? { ...l, isVisible: !l.isVisible } : l));
  const handleUpdateOpacity = (id: string, opacity: number) => setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l));
  
  const handleSetActiveLayer = (id: string) => {
    setActiveLayerId(id);
    const layer = layers.find(l => l.id === id);
    if (layer) {
      setToolMode(layer.type === 'surface' ? ToolMode.DRAW_POLYGON : ToolMode.DRAW_LINE);
      setSelectedShapeId(null); 
    }
  };

  const handleAddShape = (shape: Shape) => {
    setShapes(prev => [...prev, shape]);
  };

  const handleDeleteShape = (id: string) => {
    if (window.confirm("Supprimer cette forme ?")) {
        setShapes(prev => prev.filter(s => s.id !== id));
        if (selectedShapeId === id) setSelectedShapeId(null);
    }
  };

  const handleSelectShape = (id: string | null) => {
    setSelectedShapeId(id);
  };

  // ROBUST KML CONVERSION
  const handleConvertShape = (shapeId: string) => {
      const shape = shapes.find(s => s.id === shapeId);
      const targetLayer = layers.find(l => l.id === activeLayerId);

      if (!shape) return;

      if (!targetLayer || targetLayer.category !== 'measurement') {
          alert("Sélectionnez d'abord un calque de métré (Surface/Longueur) dans la colonne de gauche pour y ajouter cette forme.");
          return;
      }

      // Logic: Allow conversion if it makes sense geometry-wise
      let newType: 'polygon' | 'polyline' = shape.type;
      
      // Force type based on target layer
      if (targetLayer.type === 'surface') newType = 'polygon';
      if (targetLayer.type === 'length') newType = 'polyline';

      if (window.confirm(`Ajouter "${shape.name}" au calque "${targetLayer.name}" ?`)) {
        let measuredValue = 0;
        try {
            if (newType === 'polygon') {
                    // Close polygon if needed
                    const points = shape.points.length > 0 ? [...shape.points, shape.points[0]] : [];
                    const turfPoints = points.map(p => [p.lng, p.lat]);
                    if (turfPoints.length >= 4) { // 3 points + closure
                        const polygon = turf.polygon([turfPoints]);
                        measuredValue = turf.area(polygon);
                    }
            } else {
                    const turfPoints = shape.points.map(p => [p.lng, p.lat]);
                    if (turfPoints.length >= 2) {
                        const line = turf.lineString(turfPoints);
                        measuredValue = turf.length(line, { units: 'kilometers' }) * 1000;
                    }
            }
        } catch (err) {
            console.warn("Erreur calcul géométrie conversion:", err);
            // We proceed even if calculation fails, with 0 value
        }

        const newShape: Shape = {
            ...shape,
            id: generateId(), // New ID
            layerId: targetLayer.id, // Move to target layer
            type: newType, // Adopt target type
            measuredValue: measuredValue,
            name: shape.name === "Sans nom" ? `Import ${targetLayer.name}` : shape.name
        };

        // Remove old shape, add new one
        setShapes(prev => [...prev.filter(s => s.id !== shapeId), newShape]);
        setSelectedShapeId(newShape.id);
      }
  };

  // --- Features: URL Center & KML Import ---

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = mapUrl.match(regex);
    
    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        setMapCenter({ lat, lng });
    } else {
        alert("Lien invalide. Utilisez un lien Google Maps contenant des coordonnées (ex: @48.85,2.35).");
    }
  };

  const kmlColorToHex = (kmlColor: string | null | undefined): string => {
    if (!kmlColor) return '#9ca3af';
    const clean = kmlColor.trim().toLowerCase();
    if (clean.length === 8) return `#${clean.substring(6, 8)}${clean.substring(4, 6)}${clean.substring(2, 4)}`;
    if (clean.length === 6) return `#${clean.substring(4, 6)}${clean.substring(2, 4)}${clean.substring(0, 2)}`;
    return '#9ca3af';
  };

  const handleKmlImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) return;

        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const newLayers: Layer[] = [];
            const newShapes: Shape[] = [];
            
            // Parse Styles
            const styleMap: Record<string, string> = {};
            Array.from(xmlDoc.getElementsByTagName("Style")).forEach(style => {
                const id = style.getAttribute("id");
                if (id) {
                    const polyColor = style.getElementsByTagName("PolyStyle")[0]?.getElementsByTagName("color")[0]?.textContent;
                    const lineColor = style.getElementsByTagName("LineStyle")[0]?.getElementsByTagName("color")[0]?.textContent;
                    if (polyColor) styleMap[`#${id}`] = kmlColorToHex(polyColor);
                    else if (lineColor) styleMap[`#${id}`] = kmlColorToHex(lineColor);
                }
            });

            const parseCoords = (coordStr: string): GeoPoint[] => {
                return coordStr.trim().split(/\s+/).map(pair => {
                    const parts = pair.split(',');
                    return parts.length >= 2 ? { lat: parseFloat(parts[1]), lng: parseFloat(parts[0]) } : null;
                }).filter(p => p !== null && !isNaN(p.lat) && !isNaN(p.lng)) as GeoPoint[];
            };

            const processPlacemark = (placemark: Element, layerId: string, defaultColor: string): Shape | null => {
                 const name = placemark.getElementsByTagName("name")[0]?.textContent || "Sans nom";
                 const polygon = placemark.getElementsByTagName("Polygon")[0];
                 const lineString = placemark.getElementsByTagName("LineString")[0];
                 let points: GeoPoint[] = [];
                 let type: 'polygon' | 'polyline' = 'polygon';

                 if (polygon) {
                     type = 'polygon';
                     const coords = polygon.getElementsByTagName("coordinates")[0]?.textContent;
                     if (coords) points = parseCoords(coords);
                 } else if (lineString) {
                     type = 'polyline';
                     const coords = lineString.getElementsByTagName("coordinates")[0]?.textContent;
                     if (coords) points = parseCoords(coords);
                 }

                 if (points.length > 0) {
                    return {
                        id: generateId(),
                        name: name,
                        type,
                        points,
                        layerId,
                        measuredValue: 0
                    };
                 }
                 return null;
            };

            const folders = xmlDoc.getElementsByTagName("Folder");
            if (folders.length > 0) {
                Array.from(folders).forEach((folder, index) => {
                    const folderName = folder.getElementsByTagName("name")[0]?.textContent || `Dossier ${index + 1}`;
                    const layerId = generateId();
                    const placemarks = folder.getElementsByTagName("Placemark");
                    let layerColor = PRESET_COLORS[index % PRESET_COLORS.length];
                    
                    if (placemarks.length > 0) {
                        const styleUrl = placemarks[0].getElementsByTagName("styleUrl")[0]?.textContent;
                        if (styleUrl && styleMap[styleUrl]) layerColor = styleMap[styleUrl];
                    }

                    newLayers.push({ id: layerId, name: folderName, color: layerColor, type: 'mixed', category: 'kml', isVisible: true, opacity: 0.6 });
                    Array.from(placemarks).forEach(pm => {
                        const shape = processPlacemark(pm, layerId, layerColor);
                        if (shape) newShapes.push(shape);
                    });
                });
            } else {
                const placemarks = xmlDoc.getElementsByTagName("Placemark");
                if (placemarks.length > 0) {
                     const layerId = generateId();
                     const layerColor = '#9ca3af';
                     newLayers.push({ id: layerId, name: `Import ${file.name}`, color: layerColor, type: 'mixed', category: 'kml', isVisible: true, opacity: 0.6 });
                     Array.from(placemarks).forEach(pm => {
                        const shape = processPlacemark(pm, layerId, layerColor);
                        if (shape) newShapes.push(shape);
                     });
                }
            }

            if (newShapes.length > 0) {
                setLayers(prev => [...prev, ...newLayers]);
                setShapes(prev => [...prev, ...newShapes]);
                if (newShapes[0].points.length > 0) setMapCenter(newShapes[0].points[0]);
            } else {
                alert("Aucune forme compatible (Polygone/Ligne) trouvée.");
            }
        } catch (err) {
            console.error(err);
            alert("Erreur KML.");
        }
    };
    reader.readAsText(file);
  };
  
  const PRESET_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#f97316', '#06b6d4'];

  const layerTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    layers.forEach(l => {
        if (l.category === 'measurement') {
            totals[l.id] = shapes
                .filter(s => s.layerId === l.id)
                .reduce((sum, s) => sum + s.measuredValue, 0);
        }
    });
    return totals;
  }, [layers, shapes]);

  const handleRunAnalysis = async () => {
    setIsAnalysisOpen(true);
    setIsAnalyzing(true);
    const measurementLayers = layers.filter(l => l.category === 'measurement');
    const measurementShapes = shapes.filter(s => {
        const layer = layers.find(l => l.id === s.layerId);
        return layer && layer.category === 'measurement';
    });
    const result = await analyzeMeasurements(measurementLayers, measurementShapes);
    setAnalysisResult(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 overflow-hidden">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-30 gap-4">
        <div className="flex items-center gap-2 min-w-fit">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
            <Ruler className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 hidden md:block">MétréMaster</h1>
        </div>

        <div className="flex-1 max-w-2xl flex items-center gap-2">
            <form onSubmit={handleUrlSubmit} className="flex-1 relative flex items-center">
                <MapPin className="absolute left-3 w-4 h-4 text-gray-400" />
                <input 
                    type="text" 
                    value={mapUrl}
                    onChange={(e) => setMapUrl(e.target.value)}
                    placeholder="Lien Google Maps..."
                    className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-l-md focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button type="submit" className="px-3 py-1.5 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200 text-gray-600">
                    <Search className="w-4 h-4" />
                </button>
            </form>
            <div className="relative group">
                <label htmlFor="kml-upload" className="cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 shadow-sm">
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">KML</span>
                </label>
                <input id="kml-upload" type="file" accept=".kml,.xml" onChange={handleKmlImport} className="hidden" />
            </div>
        </div>

        <div className="flex items-center gap-3 min-w-fit">
             <div className="bg-gray-100 p-1 rounded-lg flex gap-1 border border-gray-200">
                <button
                    onClick={() => { setToolMode(ToolMode.SELECT); }}
                    className={`p-1.5 rounded-md transition-all ${toolMode === ToolMode.SELECT ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Sélectionner"
                >
                    <MousePointer2 className="w-5 h-5" />
                </button>
                <div className="w-px bg-gray-300 mx-1 my-1"></div>
                <button
                    onClick={() => { setToolMode(ToolMode.DRAW_POLYGON); setSelectedShapeId(null); }}
                    disabled={!activeLayerId || layers.find(l=>l.id===activeLayerId)?.category === 'kml' || layers.find(l=>l.id===activeLayerId)?.type === 'length'}
                    className={`p-1.5 rounded-md transition-all ${toolMode === ToolMode.DRAW_POLYGON ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700 disabled:opacity-30'}`}
                    title="Polygone"
                >
                    <PenTool className="w-5 h-5" />
                </button>
                 <button
                    onClick={() => { setToolMode(ToolMode.DRAW_LINE); setSelectedShapeId(null); }}
                    disabled={!activeLayerId || layers.find(l=>l.id===activeLayerId)?.category === 'kml' || layers.find(l=>l.id===activeLayerId)?.type === 'surface'}
                    className={`p-1.5 rounded-md transition-all ${toolMode === ToolMode.DRAW_LINE ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700 disabled:opacity-30'}`}
                    title="Ligne"
                >
                    <Ruler className="w-5 h-5" />
                </button>
            </div>
            <button 
                onClick={handleRunAnalysis}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium shadow-md"
            >
                <Calculator className="w-4 h-4" />
                <span className="hidden md:inline">IA</span>
            </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 p-4 z-20 flex flex-col gap-4">
          <LayerManager 
            layers={layers}
            shapes={shapes}
            activeLayerId={activeLayerId}
            layerTotals={layerTotals}
            baseLayer={baseLayer}
            onSetBaseLayer={setBaseLayer}
            onSetActiveLayer={handleSetActiveLayer}
            onAddLayer={handleAddLayer}
            onDeleteLayer={handleDeleteLayer}
            onDeleteShape={handleDeleteShape}
            onToggleVisibility={handleToggleVisibility}
            onUpdateLayerOpacity={handleUpdateOpacity}
          />
        </div>

        <div className="flex-1 relative bg-gray-200">
           {!activeLayerId && !selectedShapeId && (
               <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[500] bg-white/90 backdrop-blur text-gray-800 px-6 py-3 rounded-full shadow-xl flex items-center gap-3 border border-amber-200 pointer-events-none">
                   <AlertTriangle className="w-5 h-5 text-amber-500" />
                   <p className="text-sm font-medium">Sélectionnez un calque pour commencer</p>
               </div>
           )}

           <MapCanvas 
             layers={layers}
             shapes={shapes}
             activeLayerId={activeLayerId}
             selectedShapeId={selectedShapeId}
             toolMode={toolMode}
             baseLayer={baseLayer}
             mapCenter={mapCenter}
             onAddShape={handleAddShape}
             onDeleteShape={handleDeleteShape}
             onSelectShape={handleSelectShape}
             onConvertShape={handleConvertShape}
           />
        </div>
      </div>
      
      <AnalysisModal 
        isOpen={isAnalysisOpen} 
        onClose={() => setIsAnalysisOpen(false)} 
        loading={isAnalyzing}
        content={analysisResult}
      />
    </div>
  );
};

export default App;
