import React from 'react';
import { Map, Moon, Satellite, Sword } from "lucide-react";

export interface MapStyle {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  url: string;
  attribution: string;
  preview?: string;
}

export const MAP_STYLES: Record<string, MapStyle> = {
  original: {
    key: "original",
    name: "Original",
    description: "Clean, bright cartography",
    icon: React.createElement(Map, { className: "h-4 w-4" }),
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  dark: {
    key: "dark",
    name: "Dark Mode", 
    description: "Dark theme for night use",
    icon: React.createElement(Moon, { className: "h-4 w-4" }),
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  satellite: {
    key: "satellite",
    name: "Satellite",
    description: "Aerial imagery view",
    icon: React.createElement(Satellite, { className: "h-4 w-4" }),
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
  },
  adventure: {
    key: "adventure",
    name: "Quest Map",
    description: "For true adventurers",
    icon: React.createElement(Sword, { className: "h-4 w-4" }),
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }
};

export const ADVENTURE_COLORS = {
  primary: '#a0825a', // Bronze
  primaryLight: '#b4966e', // Light bronze
  accent: '#d4af37', // Gold
  background: '#f5f1e8', // Parchment
  text: '#3c2e1f', // Dark brown
  textMuted: '#6b5b3f', // Medium brown
};