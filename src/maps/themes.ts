import * as THREE from 'three';
import { ThemePreset } from './MapTypes';

export const THEME_SEOUL: ThemePreset = {
  name: 'Seoul Evening',
  skyColorTop: 0x0a1a3a, // Deep blue
  skyColorBottom: 0x6b4984, // Purple haze
  fogColor: 0x2a2a4a,
  fogNear: 50,
  fogFar: 400,
  ambientLightIntensity: 0.4,
  sunColor: 0xaaccff, // Cool moonlight
  sunIntensity: 0.8,
  sunPosition: new THREE.Vector3(50, 100, 50),
  groundColor: 0x1a2a1a // Darker grass/pavement
};

export const THEME_TOKYO: ThemePreset = {
  name: 'Tokyo Neon',
  skyColorTop: 0x000000,
  skyColorBottom: 0x110022,
  fogColor: 0x050510,
  fogNear: 20,
  fogFar: 300,
  ambientLightIntensity: 0.2, // Darker ambient
  sunColor: 0xff00ff, // Neon pink directional "city glow"
  sunIntensity: 0.6,
  sunPosition: new THREE.Vector3(-50, 80, -50),
  groundColor: 0x111111 // Asphalt
};

export const THEME_NEW_YORK: ThemePreset = {
  name: 'NY Golden Hour',
  skyColorTop: 0x2255aa,
  skyColorBottom: 0xffaa55, // Orange sunset
  fogColor: 0xffccaa,
  fogNear: 100,
  fogFar: 600,
  ambientLightIntensity: 0.6,
  sunColor: 0xffaa00, // Golden sun
  sunIntensity: 1.2,
  sunPosition: new THREE.Vector3(0, 30, 100), // Lower sun
  groundColor: 0x445544 // Central Park Green
};
