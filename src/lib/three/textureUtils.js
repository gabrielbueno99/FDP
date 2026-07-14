/**
 * textureUtils.js
 *
 * Helpers for loading and caching card textures efficiently.
 *
 * Key decisions:
 *   - ONE TextureLoader instance shared by the whole app (avoids repeated setup)
 *   - NearestFilter for pixel-art cards, LinearFilter for photo-realistic ones
 *   - generateMipmaps = false when using LinearFilter on a <canvas> source
 *   - A simple Map-based cache so 52 cards don't load 52 identical card backs
 */

import * as THREE from 'three';

const _loader = new THREE.TextureLoader();
const _cache  = new Map(); // url → THREE.Texture

/**
 * Load a texture from a URL, with an in-memory cache so the same URL is
 * never downloaded twice (e.g. the card back shared by all 52 cards).
 *
 * @param {string} url
 * @returns {Promise<THREE.Texture>}
 */
export function loadTexture(url) {
  if (_cache.has(url)) return Promise.resolve(_cache.get(url));

  return new Promise((resolve, reject) => {
    _loader.load(
      url,
      (tex) => {
        applyMobileSettings(tex);
        _cache.set(url, tex);
        resolve(tex);
      },
      undefined, // onProgress — not useful for single files
      reject,
    );
  });
}

/**
 * Apply GPU-friendly settings to a texture.
 * Call this once after loading; Three.js uploads on first render.
 *
 * @param {THREE.Texture} tex
 * @param {'linear'|'nearest'} [filter='linear']
 */
export function applyMobileSettings(tex, filter = 'linear') {
  // LinearMipMapLinearFilter = trilinear filtering — best quality for cards
  // NearestFilter = pixel-perfect for pixel-art decks
  tex.minFilter = filter === 'nearest'
    ? THREE.NearestFilter
    : THREE.LinearMipMapLinearFilter;
  tex.magFilter = filter === 'nearest'
    ? THREE.NearestFilter
    : THREE.LinearFilter;

  // Clamp to edge avoids a 1px border artifact on PlaneGeometry UVs
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  // Let Three.js know it needs to re-upload
  tex.needsUpdate = true;
}

/**
 * Build a texture from an <img> or <canvas> element already in memory.
 * Useful when you render card faces procedurally (Canvas 2D API).
 *
 * @param {HTMLImageElement|HTMLCanvasElement} source
 * @returns {THREE.Texture}
 */
export function textureFromElement(source) {
  const tex = new THREE.Texture(source);
  // Canvas sources don't benefit from mipmaps (non-power-of-two dimensions)
  tex.minFilter     = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate   = true;
  return tex;
}

/**
 * Preload a list of URLs in parallel.
 * Returns a Map<url, Texture> for quick lookup.
 *
 * @param {string[]} urls
 * @returns {Promise<Map<string, THREE.Texture>>}
 */
export async function preloadTextures(urls) {
  const entries = await Promise.all(
    urls.map(async (url) => [url, await loadTexture(url)])
  );
  return new Map(entries);
}

/**
 * Release a cached texture from the GPU and the cache.
 * Only call this when you're sure no card is using it.
 *
 * @param {string} url
 */
export function releaseTexture(url) {
  const tex = _cache.get(url);
  if (tex) {
    tex.dispose();
    _cache.delete(url);
  }
}

/** Clear the entire texture cache (e.g. on scene teardown). */
export function clearTextureCache() {
  for (const tex of _cache.values()) tex.dispose();
  _cache.clear();
}
