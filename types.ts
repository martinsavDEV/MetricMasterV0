
export enum ToolMode {
  SELECT = 'SELECT',
  DRAW_POLYGON = 'DRAW_POLYGON',
  DRAW_LINE = 'DRAW_LINE'
}

export type BaseLayer = 'plan' | 'satellite';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Shape {
  id: string;
  name: string; // Added name for user identification
  type: 'polygon' | 'polyline';
  points: GeoPoint[];
  layerId: string;
  measuredValue: number; // Area in m² or Length in m
}

export interface Layer {
  id: string;
  name: string;
  color: string;
  type: 'surface' | 'length' | 'mixed';
  category: 'measurement' | 'kml';
  isVisible: boolean;
  opacity: number;
}

export interface ProjectState {
  layers: Layer[];
  shapes: Shape[];
  activeLayerId: string | null;
}
