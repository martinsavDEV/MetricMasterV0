
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, useMap, useMapEvents, FeatureGroup } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { Layer, Shape, ToolMode, GeoPoint, BaseLayer } from '../types';
import { Check, Plus, Trash2, X } from 'lucide-react';

// --- LEAFLET ICON FIX ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- HELPER COMPONENTS ---

// Safe ID Generator
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const MapController: React.FC<{ center: GeoPoint | null; zoom: number }> = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo([center.lat, center.lng], zoom, { duration: 1.5 });
        }
    }, [center, zoom, map]);
    return null;
};

// --- DRAWING MANAGER ---
interface DrawingManagerProps {
  mode: ToolMode;
  color: string;
  onFinish: (points: GeoPoint[]) => void;
  onCancel: () => void;
}

const DrawingManager: React.FC<DrawingManagerProps> = ({ mode, color, onFinish, onCancel }) => {
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [cursorPos, setCursorPos] = useState<GeoPoint | null>(null);
  const finishBtnRef = useRef<HTMLDivElement>(null);

  // Refs for callbacks to prevent stale closures
  const onFinishRef = useRef(onFinish);
  const onCancelRef = useRef(onCancel);
  const pointsRef = useRef(points);

  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);
  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => { pointsRef.current = points; }, [points]);

  // Disable propagation on the Finish Button
  useEffect(() => {
    if (finishBtnRef.current) {
        L.DomEvent.disableClickPropagation(finishBtnRef.current);
        L.DomEvent.disableScrollPropagation(finishBtnRef.current);
    }
  }, [points.length]); // Re-run when button appears

  const handleTryFinish = useCallback(() => {
      const currentPoints = pointsRef.current;
      
      if (mode === ToolMode.DRAW_POLYGON && currentPoints.length >= 3) {
          onFinishRef.current(currentPoints);
          setPoints([]); 
      } else if (mode === ToolMode.DRAW_LINE && currentPoints.length >= 2) {
          onFinishRef.current(currentPoints);
          setPoints([]); 
      }
  }, [mode]);

  // Leaflet Events
  useMapEvents({
    click(e) {
        if (mode === ToolMode.SELECT) return;
        setPoints(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
    },
    mousemove(e) {
        if (mode === ToolMode.SELECT) return;
        setCursorPos({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    contextmenu(e) {
        // Right click finish
        if (mode === ToolMode.SELECT) return;
        handleTryFinish();
    }
  });

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
          if (mode === ToolMode.SELECT) return;
          if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleTryFinish();
          }
          if (e.key === 'Escape') {
              setPoints([]);
              onCancelRef.current();
          }
      };
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
  }, [mode, handleTryFinish]);

  if (mode === ToolMode.SELECT) return null;

  return (
      <>
        {points.map((p, i) => (
            <Marker 
                key={i} 
                position={[p.lat, p.lng]} 
                eventHandlers={{
                    click: (e) => {
                        L.DomEvent.stopPropagation(e.originalEvent);
                        // Close loop logic
                        if (i === 0 && mode === ToolMode.DRAW_POLYGON && points.length >= 3) {
                            handleTryFinish();
                        }
                    },
                    contextmenu: (e) => {
                        L.DomEvent.stopPropagation(e.originalEvent);
                        L.DomEvent.preventDefault(e.originalEvent);
                        handleTryFinish();
                    }
                }}
            />
        ))}

        {points.length > 0 && (
            <Polyline 
                positions={points.map(p => [p.lat, p.lng])} 
                color={color} 
                weight={3} 
            />
        )}

        {points.length > 0 && cursorPos && (
            <Polyline 
                positions={[
                    [points[points.length - 1].lat, points[points.length - 1].lng],
                    [cursorPos.lat, cursorPos.lng]
                ]}
                dashArray="5, 10"
                color={color}
                weight={1}
                opacity={0.6}
            />
        )}

        {mode === ToolMode.DRAW_POLYGON && points.length >= 3 && (
            <Polygon 
                positions={points.map(p => [p.lat, p.lng])}
                color={color}
                fillOpacity={0.1}
                stroke={false}
            />
        )}

        {/* FINISH BUTTON */}
        {((mode === ToolMode.DRAW_POLYGON && points.length >= 3) || (mode === ToolMode.DRAW_LINE && points.length >= 2)) && (
            <div className="leaflet-bottom leaflet-left" style={{ bottom: '80px', left: '50%', transform: 'translateX(-50%)', marginBottom: '0', pointerEvents: 'auto' }}>
                 <div className="leaflet-control" ref={finishBtnRef}>
                     <button 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTryFinish();
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-full shadow-lg font-bold flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
                     >
                         <Check className="w-5 h-5" />
                         Terminer
                     </button>
                 </div>
            </div>
        )}
      </>
  );
};


// --- MAIN COMPONENT ---
interface MapCanvasProps {
  layers: Layer[];
  shapes: Shape[];
  activeLayerId: string | null;
  selectedShapeId: string | null;
  toolMode: ToolMode;
  baseLayer: BaseLayer;
  mapCenter: GeoPoint | null;
  onAddShape: (shape: Shape) => void;
  onDeleteShape: (id: string) => void;
  onSelectShape: (id: string | null) => void;
  onConvertShape: (id: string) => void;
}

const MapCanvas: React.FC<MapCanvasProps> = ({
  layers,
  shapes,
  activeLayerId,
  selectedShapeId,
  toolMode,
  baseLayer,
  mapCenter,
  onAddShape,
  onDeleteShape,
  onSelectShape,
  onConvertShape
}) => {
  const activeLayer = layers.find(l => l.id === activeLayerId);
  const selectedShape = shapes.find(s => s.id === selectedShapeId);
  const isKmlSelection = selectedShape && layers.find(l => l.id === selectedShape.layerId)?.category === 'kml';
  
  // Ref for the selection toolbar to disable propagation
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (toolbarRef.current) {
          L.DomEvent.disableClickPropagation(toolbarRef.current);
          L.DomEvent.disableScrollPropagation(toolbarRef.current);
      }
  }, [selectedShapeId]);

  const sortedLayers = [...layers].sort((a, b) => {
    if (a.category === 'measurement' && b.category === 'kml') return 1;
    if (a.category === 'kml' && b.category === 'measurement') return -1;
    return 0;
  });

  const handleShapeComplete = useCallback((points: GeoPoint[]) => {
      if (!activeLayer) {
          alert("Erreur: Calque actif introuvable.");
          return;
      }

      let measuredValue = 0;
      try {
        if (activeLayer.type === 'surface') {
            const turfPoints = [...points, points[0]].map(p => [p.lng, p.lat]);
            const polygon = turf.polygon([turfPoints]);
            measuredValue = turf.area(polygon); 
        } else {
            const turfPoints = points.map(p => [p.lng, p.lat]);
            const line = turf.lineString(turfPoints);
            measuredValue = turf.length(line, { units: 'kilometers' }) * 1000;
        }
      } catch (e) {
          console.error("Calculation error", e);
      }

      if (isNaN(measuredValue)) measuredValue = 0;

      // Small delay to ensure UI clears before prompt
      setTimeout(() => {
          const defaultName = activeLayer.type === 'surface' ? 'Surface' : 'Longueur';
          const name = window.prompt("Nom de la mesure :", `${defaultName} ${shapes.filter(s => s.layerId === activeLayer.id).length + 1}`);
          
          if (name !== null) { 
              const newShape: Shape = {
                  id: generateId(),
                  name: name || defaultName,
                  type: activeLayer.type === 'surface' ? 'polygon' : 'polyline',
                  points: points,
                  layerId: activeLayer.id,
                  measuredValue: measuredValue
              };
              onAddShape(newShape);
          }
      }, 50);
  }, [activeLayer, shapes, onAddShape]);

  return (
    <div className="w-full h-full relative">
       <MapContainer 
         center={[48.8566, 2.3522]} 
         zoom={18} 
         className="w-full h-full z-0"
         zoomControl={false}
       >
          <MapController center={mapCenter} zoom={18} />
          
          {baseLayer === 'plan' ? (
              <TileLayer maxNativeZoom={20} maxZoom={22} attribution='Google' url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
          ) : (
              <TileLayer maxNativeZoom={20} maxZoom={22} attribution='Google Hybrid' url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
          )}

          {/* Render Layers */}
          {sortedLayers.filter(l => l.isVisible).map(layer => {
              const layerShapes = shapes.filter(s => s.layerId === layer.id);
              return (
                  <FeatureGroup key={layer.id}>
                      {layerShapes.map(shape => {
                          const isSelected = selectedShapeId === shape.id;
                          const pathOptions = {
                              color: isSelected ? '#fbbf24' : layer.color,
                              weight: isSelected ? 5 : 3,
                              fillColor: isSelected ? '#fbbf24' : layer.color,
                              fillOpacity: isSelected ? 0.6 : layer.opacity,
                              dashArray: isSelected ? '10, 10' : undefined
                          };

                          return shape.type === 'polygon' ? (
                              <Polygon 
                                key={shape.id} 
                                positions={shape.points.map(p => [p.lat, p.lng])}
                                pathOptions={pathOptions}
                                eventHandlers={{
                                    click: (e) => {
                                        L.DomEvent.stopPropagation(e);
                                        if (toolMode === ToolMode.SELECT) onSelectShape(shape.id);
                                    }
                                }}
                              />
                          ) : (
                             <Polyline 
                                key={shape.id} 
                                positions={shape.points.map(p => [p.lat, p.lng])}
                                pathOptions={pathOptions}
                                eventHandlers={{
                                    click: (e) => {
                                        L.DomEvent.stopPropagation(e);
                                        if (toolMode === ToolMode.SELECT) onSelectShape(shape.id);
                                    }
                                }}
                              />
                          );
                      })}
                  </FeatureGroup>
              );
          })}

          {toolMode !== ToolMode.SELECT && activeLayer && (
              <DrawingManager 
                 mode={toolMode}
                 color={activeLayer.color}
                 onFinish={handleShapeComplete}
                 onCancel={() => onSelectShape(null)}
              />
          )}

       </MapContainer>

       {/* SELECTION TOOLBAR - Wrapped in ref to stop propagation */}
       {selectedShapeId && selectedShape && (
           <div 
             ref={toolbarRef} 
             className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-lg shadow-xl p-2 flex items-center gap-3 animate-in slide-in-from-bottom-2"
             // Redundant handlers to be absolutely sure
             onClick={(e) => e.stopPropagation()}
             onMouseDown={(e) => e.stopPropagation()}
             onDoubleClick={(e) => e.stopPropagation()}
           >
               <div className="px-3 border-r border-gray-200">
                   <p className="text-[10px] text-gray-400 font-bold uppercase">Sélection</p>
                   <p className="text-sm font-bold text-gray-800">{selectedShape.name}</p>
               </div>
               
               {isKmlSelection ? (
                   <button 
                     onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         onConvertShape(selectedShapeId);
                     }}
                     className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded font-bold flex items-center gap-2 cursor-pointer"
                   >
                       <Plus className="w-4 h-4" />
                       Ajouter au Métré
                   </button>
               ) : (
                   <button 
                     onClick={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         onDeleteShape(selectedShapeId);
                     }}
                     className="bg-red-50 hover:bg-red-100 text-red-600 text-xs px-3 py-2 rounded font-bold flex items-center gap-2 cursor-pointer"
                   >
                       <Trash2 className="w-4 h-4" />
                       Supprimer
                   </button>
               )}
               <button 
                 onClick={(e) => {
                     e.preventDefault();
                     e.stopPropagation();
                     onSelectShape(null);
                 }} 
                 className="p-2 hover:bg-gray-100 rounded text-gray-500"
               >
                   <X className="w-4 h-4" />
               </button>
           </div>
       )}
    </div>
  );
};

export default MapCanvas;
