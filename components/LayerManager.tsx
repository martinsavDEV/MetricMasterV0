
import React, { useState } from 'react';
import { Layer, BaseLayer, Shape } from '../types';
import { Layers, Eye, EyeOff, Trash2, Plus, Ruler, Square, Map as MapIcon, Satellite, FolderOpen, ChevronDown, ChevronRight, X } from 'lucide-react';

interface LayerManagerProps {
  layers: Layer[];
  shapes: Shape[]; // Received shapes to list details
  activeLayerId: string | null;
  layerTotals: Record<string, number>;
  baseLayer: BaseLayer;
  onSetBaseLayer: (mode: BaseLayer) => void;
  onSetActiveLayer: (id: string) => void;
  onAddLayer: (name: string, type: 'surface' | 'length', color: string) => void;
  onToggleVisibility: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onDeleteShape: (id: string) => void; // Ability to delete single shape from list
  onUpdateLayerOpacity: (id: string, opacity: number) => void;
}

const PRESET_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#f97316', '#06b6d4'];

const LayerManager: React.FC<LayerManagerProps> = ({
  layers,
  shapes,
  activeLayerId,
  layerTotals,
  baseLayer,
  onSetBaseLayer,
  onSetActiveLayer,
  onAddLayer,
  onToggleVisibility,
  onDeleteLayer,
  onDeleteShape,
  onUpdateLayerOpacity
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerType, setNewLayerType] = useState<'surface' | 'length'>('surface');
  const [newLayerColor, setNewLayerColor] = useState(PRESET_COLORS[0]);
  
  // State to track expanded layers (for showing shape details)
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());

  const handleAdd = () => {
    if (newLayerName.trim()) {
      onAddLayer(newLayerName, newLayerType, newLayerColor);
      setNewLayerName('');
      setIsAdding(false);
    }
  };

  const toggleLayerExpansion = (e: React.MouseEvent, layerId: string) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedLayers);
    if (newExpanded.has(layerId)) {
        newExpanded.delete(layerId);
    } else {
        newExpanded.add(layerId);
    }
    setExpandedLayers(newExpanded);
  };

  const measurementLayers = layers.filter(l => l.category === 'measurement');
  const kmlLayers = layers.filter(l => l.category === 'kml');

  const renderLayerItem = (layer: Layer, isKml: boolean) => {
    const total = layerTotals[layer.id] || 0;
    const isActive = activeLayerId === layer.id;
    const isExpanded = expandedLayers.has(layer.id);
    const layerShapes = shapes.filter(s => s.layerId === layer.id);

    return (
      <div 
        key={layer.id}
        onClick={() => !isKml && onSetActiveLayer(layer.id)}
        className={`
          relative rounded-lg border transition-all shadow-sm mb-2 overflow-hidden
          ${isActive ? 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-md' : 'bg-white border-gray-200'}
          ${!isKml ? 'cursor-pointer hover:border-blue-300' : ''}
        `}
      >
        <div className="p-3">
            <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 overflow-hidden">
                {/* Expand Toggle */}
                {!isKml && (
                    <button 
                        onClick={(e) => toggleLayerExpansion(e, layer.id)}
                        className="p-0.5 hover:bg-gray-100 rounded text-gray-400"
                    >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                )}
                
                <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: layer.color }}
                />
                <div className="flex flex-col overflow-hidden">
                    <span className="font-semibold text-gray-800 truncate leading-tight" title={layer.name}>
                        {layer.name}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                        {isKml ? 'Import KML' : (layer.type === 'surface' ? 'Surface' : 'Linéaire')}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-1">
                <button 
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                title={layer.isVisible ? "Masquer" : "Afficher"}
                >
                {layer.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button 
                onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded"
                title="Supprimer le calque"
                >
                <Trash2 className="w-4 h-4" />
                </button>
            </div>
            </div>
            
            {/* Controls */}
            <div className="flex justify-between items-end mt-2">
            <div className="flex flex-col w-2/3 pr-2">
                <label className="text-[10px] text-gray-400">Opacité</label>
                <input 
                    type="range" 
                    min="0.0" 
                    max="1" 
                    step="0.1"
                    value={layer.opacity}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onUpdateLayerOpacity(layer.id, parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
            </div>
            
            {!isKml && (
                <div className="text-right flex-1">
                    <span className="block text-xl font-bold text-gray-800 leading-none">
                        {total.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">
                        {layer.type === 'surface' ? 'm²' : 'm'}
                    </span>
                </div>
            )}
            </div>
        </div>

        {/* Shape Details List (Expanded) */}
        {!isKml && isExpanded && layerShapes.length > 0 && (
            <div className="bg-gray-50 border-t border-gray-100 p-2 max-h-40 overflow-y-auto">
                {layerShapes.map(shape => (
                    <div key={shape.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-200 last:border-0 hover:bg-gray-100 px-2 rounded">
                        <span className="font-medium text-gray-700 truncate max-w-[50%]">{shape.name}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500">
                                {shape.measuredValue.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} 
                                {layer.type === 'surface' ? ' m²' : ' m'}
                            </span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteShape(shape.id); }}
                                className="text-gray-300 hover:text-red-500"
                                title="Supprimer cette forme"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
        {!isKml && isExpanded && layerShapes.length === 0 && (
             <div className="bg-gray-50 border-t border-gray-100 p-3 text-xs text-center text-gray-400 italic">
                Aucune mesure enregistrée.
             </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Background Selector */}
      <div className="p-3 bg-gray-50 border-b border-gray-200 flex gap-2 shrink-0">
         <button
            onClick={() => onSetBaseLayer('plan')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md border transition-all ${
                baseLayer === 'plan' 
                ? 'bg-white border-blue-500 text-blue-600 shadow-sm ring-1 ring-blue-500' 
                : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200'
            }`}
         >
            <MapIcon className="w-3 h-3" /> Plan
         </button>
         <button
            onClick={() => onSetBaseLayer('satellite')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md border transition-all ${
                baseLayer === 'satellite' 
                ? 'bg-gray-800 border-gray-900 text-white shadow-sm' 
                : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200'
            }`}
         >
            <Satellite className="w-3 h-3" /> Satellite
         </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50/50">
          {/* KML Section */}
          {kmlLayers.length > 0 && (
            <div className="mb-4">
                <div className="px-4 py-2 bg-purple-50 border-b border-purple-100 text-purple-800 text-xs font-bold uppercase tracking-wider flex items-center gap-2 sticky top-0 z-10 backdrop-blur-sm">
                    <FolderOpen className="w-3 h-3" />
                    Calques Importés (KML)
                </div>
                <div className="p-2">
                    {kmlLayers.map(l => renderLayerItem(l, true))}
                </div>
            </div>
          )}

          {/* Measurement Section */}
          <div>
              <div className="px-4 py-2 bg-gray-100 border-y border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider flex justify-between items-center sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3 h-3" />
                    Calques de Métré
                  </div>
                  <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors border border-gray-300 bg-white"
                    title="Nouveau calque"
                  >
                    <Plus className="w-3 h-3 text-gray-600" />
                  </button>
              </div>

              {isAdding && (
                <div className="p-4 bg-blue-50 border-b border-blue-100 space-y-3">
                  <input
                    type="text"
                    placeholder="Nom du calque (ex: Murs)"
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newLayerName}
                    onChange={(e) => setNewLayerName(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewLayerType('surface')}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded border ${
                        newLayerType === 'surface' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'
                      }`}
                    >
                      <Square className="w-3 h-3" /> Surface
                    </button>
                    <button
                      onClick={() => setNewLayerType('length')}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded border ${
                        newLayerType === 'length' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'
                      }`}
                    >
                      <Ruler className="w-3 h-3" /> Longueur
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewLayerColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${newLayerColor === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button 
                    onClick={handleAdd}
                    disabled={!newLayerName.trim()}
                    className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    Créer
                  </button>
                </div>
              )}

              <div className="p-2">
                {measurementLayers.length === 0 && (
                   <p className="text-gray-400 text-center text-sm py-4 italic">Aucun calque de métré.</p>
                )}
                {measurementLayers.map(l => renderLayerItem(l, false))}
              </div>
          </div>
      </div>
    </div>
  );
};

export default LayerManager;
