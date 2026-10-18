// Shared physically based materials. Textures are original procedural maps in assets/tex.
import * as THREE from 'three';

let cache = null;

export function materials(lab) {
  if (cache) return cache;
  const t = (n, r, s) => lab.tex(n, { repeat: r, srgb: s });
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  cache = {
    // aircraft paint with clearcoat and subtle panel seams
    paint: phys({ color: 0xf3f2ec, metalness: 0.05, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, normalMap: t('panels_normal.jpg', [3, 2]), normalScale: new THREE.Vector2(0.35, 0.35) }),
    paintPlain: phys({ color: 0xf3f2ec, metalness: 0.05, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }),
    navy: phys({ color: 0x14324d, metalness: 0.25, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
    gold: phys({ color: 0xc9964f, metalness: 0.6, roughness: 0.32, clearcoat: 0.6 }),
    belly: phys({ color: 0x9aa3a8, metalness: 0.35, roughness: 0.38, clearcoat: 0.5 }),
    wingGrey: std({ color: 0xb4bbbf, metalness: 0.45, roughness: 0.42, normalMap: t('panels_normal.jpg', [6, 2]), normalScale: new THREE.Vector2(0.4, 0.4) }),
    aluminum: std({ color: 0xc3c8ca, metalness: 0.92, roughness: 0.28 }),
    brushed: std({ color: 0xa9aeb0, metalness: 0.95, roughness: 0.36 }),
    steel: std({ color: 0x5c656a, metalness: 0.9, roughness: 0.32 }),
    darkMetal: std({ color: 0x2b3236, metalness: 0.7, roughness: 0.45 }),
    rubber: std({ color: 0x141618, roughness: 0.92 }),
    plastic: std({ color: 0x1b2024, roughness: 0.62 }),
    plasticGrey: std({ color: 0x6d7479, roughness: 0.55 }),
    cockpitGlass: phys({ color: 0x16252e, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide }),
    glass: phys({ color: 0x9fc3cf, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.5 }),
    tintedGlass: phys({ color: 0x24404f, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.72, envMapIntensity: 1.8, clearcoat: 1 }),
    // ground surfaces
    concrete: std({ map: t('concrete_albedo.jpg', [1, 1], true), roughnessMap: t('concrete_rough.jpg', [1, 1]), normalMap: t('concrete_normal.jpg', [1, 1]), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1 }),
    asphalt: std({ map: t('asphalt_albedo.jpg', [1, 1], true), roughnessMap: t('asphalt_rough.jpg', [1, 1]), normalMap: t('asphalt_normal.jpg', [1, 1]), roughness: 1 }),
    grass: std({ map: t('grass_albedo.jpg', [1, 1], true), normalMap: t('grass_normal.jpg', [1, 1]), roughness: 0.95 }),
    epoxy: std({ map: t('epoxy_albedo.jpg', [10, 10], true), roughnessMap: t('epoxy_rough.jpg', [10, 10]), roughness: 1, metalness: 0.0, envMapIntensity: 1.2 }),
    // markings
    paintYellow: std({ color: 0xe0b220, roughness: 0.7 }),
    paintRed: std({ color: 0xb8322a, roughness: 0.7 }),
    paintWhite: std({ color: 0xe9e9e4, roughness: 0.7 }),
    hiVis: std({ color: 0xd8ff2a, roughness: 0.6, emissive: 0x2c3300 }),
    hiVisOrange: std({ color: 0xff7a1a, roughness: 0.6, emissive: 0x2a1000 }),
    reflective: std({ color: 0xdfe5e8, metalness: 0.6, roughness: 0.25 }),
    // interior
    fabric: std({ map: t('fabric_albedo.jpg', [2, 2], true), normalMap: t('fabric_normal.jpg', [2, 2]), roughness: 0.95 }),
    leather: std({ color: 0x2a2f33, roughness: 0.72 }),
    carpet: std({ map: t('carpet_albedo.jpg', [1, 12], true), roughness: 1 }),
    cabinWall: std({ color: 0xe6e3dc, roughness: 0.55 }),
    cabinTrim: std({ color: 0xbfbcb6, roughness: 0.45 }),
    stainless: std({ color: 0xd2d5d6, metalness: 1, roughness: 0.22 }),
    red: std({ color: 0xb0281f, roughness: 0.45, metalness: 0.2 }),
    green: std({ color: 0x2a7a46, roughness: 0.45, metalness: 0.2 }),
    orange: std({ color: 0xe36a18, roughness: 0.55 }),
    wood: std({ color: 0x8a6440, roughness: 0.7 }),
    emissiveWhite: new THREE.MeshBasicMaterial({ color: 0xfffbf0 }),
    emissiveWarm: new THREE.MeshBasicMaterial({ color: 0xffe2b0 }),
  };
  for (const [k, m] of Object.entries(cache)) m.name = k;
  return cache;
}
