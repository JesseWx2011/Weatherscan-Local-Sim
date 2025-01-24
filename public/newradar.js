import mapboxgl from 'https://esm.sh/mapbox-gl@3.9.0';
import { apiKey } from './config.js';
import { primaryLoc, dataPopulationPromise } from './data.js';

mapboxgl.accessToken = 'pk.eyJ1Ijoid2VhdGhlciIsImEiOiJjaW4wbzllcjkwYWtrd2JsdWl3dG1hZjZ1In0.AdcjoWQiVfvjHfOB0nsyeQ';

const state = {
    radarTimestamps: [],
    satTimestamps: [],
    animationInterval: null,
    maps: new Map(),
    loadedSources: {
        radar: new Map(),
        sat: new Map()
    }
};

// Max frame counts for radar and satellite. I lowkey bullshit these numbers, but it looks close enough to the real thing, and no one will notice (except you, after reading this).
const RADAR_FRAME_COUNT = 16; // Maximum number of radar frames to keep
const SAT_FRAME_COUNT = 20;  // Maximum number of satellite frames to keep

async function fetchTimestamps(type) {
    try {
        const response = await fetch(`https://api.weather.com/v3/TileServer/series/productSet/PPAcore?filter=${type}&apiKey=${apiKey}`);
        const data = await response.json();
        const seriesKey = type === 'sat' ? 'sat' : 'radar';
        
        if (!data.seriesInfo?.[seriesKey]) {
            console.error(`No series info found for ${seriesKey}`);
            return false;
        }
        
        const timestamps = data.seriesInfo[seriesKey].series
            .sort((a, b) => a.ts - b.ts)
            .map(ts => ts.ts)
            .slice(-(type === 'sat' ? SAT_FRAME_COUNT : RADAR_FRAME_COUNT));

        if (type === 'sat') {
            state.satTimestamps = timestamps;
        } else {
            state.radarTimestamps = timestamps;
        }

        return timestamps;
    } catch (error) {
        console.error(`Failed to fetch ${type} timestamps:`, error);
        return false;
    }
}

function cleanupOldSources(map, type) {
    const timestamps = type === 'sat' ? state.satTimestamps : state.radarTimestamps;
    const sourceCache = state.loadedSources[type];
    
    // Get all sources of this type from the map
    const sources = Object.keys(map.getStyle().sources)
        .filter(id => id.startsWith(`${type}_`));
    
    // Remove sources and layers that are no longer in the timestamps
    sources.forEach(sourceId => {
        const timestamp = sourceId.split('_')[1];
        if (!timestamps.includes(Number(timestamp))) {
            const layerId = `${type}layer_${timestamp}`;
            if (map.getLayer(layerId)) {
                map.removeLayer(layerId);
            }
            if (map.getSource(sourceId)) {
                map.removeSource(sourceId);
            }
            sourceCache.delete(Number(timestamp));
        }
    });
}

async function loadMapSource(map, type, timestamp) {
    const sourceId = `${type}_${timestamp}`;
    const layerId = `${type}layer_${timestamp}`;
    const sourceCache = state.loadedSources[type];

    if (!sourceCache.has(timestamp)) {
        const source = {
            type: 'raster',
            tiles: [`https://api.weather.com/v3/TileServer/tile/${type === 'radar' ? 'twcRadarMosaic' : 'sat'}?ts=${timestamp}&xyz={x}:{y}:{z}&apiKey=${apiKey}`],
            tileSize: 512,
            scheme: "xyz",
            minzoom: type === 'radar' ? 5 : 4,
            maxzoom: 12,
            attribution: ''
        };
        sourceCache.set(timestamp, source);
    }

    if (!map.getSource(sourceId)) {
        try {
            map.addSource(sourceId, sourceCache.get(timestamp));
            map.addLayer({
                id: layerId,
                type: 'raster',
                source: sourceId,
                layout: { visibility: 'none' },
                paint: {
                    'raster-opacity': 0.9,
                    'raster-fade-duration': 0,
                    'raster-brightness-max': type === 'sat' ? 1 : 0.9
                }
            });

            // Wait for source to load with timeout
            await Promise.race([
                new Promise(resolve => {
                    const checkLoaded = () => {
                        if (map.isSourceLoaded(sourceId)) {
                            resolve();
                        } else {
                            map.once('sourcedata', checkLoaded);
                        }
                    };
                    checkLoaded();
                }),
                new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
            ]);
        } catch (e) {
            console.debug(`Error loading source ${sourceId}:`, e);
        }
    }

    // Add cleanup after loading new sources
    cleanupOldSources(map, type);
}

async function initializeMapLayers(map) {
    const dataType = map.getContainer().getAttribute('dataType') || '';
    const type = dataType.includes('Sat') ? 'sat' : 'radar';
    const timestamps = type === 'sat' ? state.satTimestamps : state.radarTimestamps;

    // Load all sources sequentially to prevent overwhelming the API
    for (const timestamp of timestamps) {
        await loadMapSource(map, type, timestamp);
    }
}

function smoothAnimationLoop(map, timestamps) {
    const container = map.getContainer();
    const type = container.getAttribute('dataType').includes('Sat') ? 'sat' : 'radar';
    const layerPrefix = `${type}layer_`;
    
    if (state.animationInterval) {
        clearInterval(state.animationInterval);
    }

    const validLayers = timestamps
        .map(ts => `${layerPrefix}${ts}`)
        .filter(layerId => {
            try {
                return map.getLayer(layerId);
            } catch (e) {
                return false;
            }
        });

    if (validLayers.length === 0) {
        console.log('No valid layers found, waiting for initialization...');
        // Try again in a short moment if no layers are ready
        setTimeout(() => {
            if (map.loaded()) {
                startRadarAnimation(map);
            }
        }, 500);
        return;
    }

    let currentIndex = 0;
    let shouldAnimate = true;  

    // Safely set layer visibility
    const setLayerVisibility = (layerId, visibility) => {
        try {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', visibility);
            }
        } catch (e) {
            console.debug(`Layer ${layerId} not ready`);
        }
    };

    // Initially hide all layers
    validLayers.forEach(layerId => {
        setLayerVisibility(layerId, 'none');
    });

    // Show first frame
    setLayerVisibility(validLayers[0], 'visible');

    const observer = new IntersectionObserver((entries) => {
        shouldAnimate = entries[0].isIntersecting;
        if (!shouldAnimate) {
            clearInterval(state.animationInterval);
            validLayers.forEach(layerId => {
                setLayerVisibility(layerId, 'none');
            });
        }
    });
    observer.observe(container);

    state.animationInterval = setInterval(() => {
        if (!shouldAnimate || !container.offsetParent) return;

        try {
            setLayerVisibility(validLayers[currentIndex], 'none');
            currentIndex = (currentIndex + 1) % validLayers.length;
            setLayerVisibility(validLayers[currentIndex], 'visible');

            if (currentIndex === validLayers.length - 1) {
                shouldAnimate = false;
                setTimeout(() => {
                    if (container.offsetParent) {
                        shouldAnimate = true;
                        currentIndex = 0;
                        validLayers.forEach((layerId, i) => {
                            setLayerVisibility(layerId, i === 0 ? 'visible' : 'none');
                        });
                    }
                }, 1650);
            }
        } catch (e) {
            console.debug('Animation frame error, continuing...', e);
        }
    }, 100);

    return () => {
        observer.disconnect();
        if (state.animationInterval) {
            clearInterval(state.animationInterval);
            state.animationInterval = null;
        }
        validLayers.forEach(layerId => {
            setLayerVisibility(layerId, 'none');
        });
    };
}

export async function startRadarAnimation(map) {
    const container = map.getContainer();
    const type = container.getAttribute('dataType').includes('Sat') ? 'sat' : 'radar';
    const timestamps = type === 'sat' ? state.satTimestamps : state.radarTimestamps;

    if (container._cleanup) {
        container._cleanup();
    }
    container._cleanup = smoothAnimationLoop(map, timestamps);
}

export async function initializeMaps() {
    await fetchTimestamps('radar');
    await fetchTimestamps('sat');
    
    const radarContainers = Array.from(document.querySelectorAll('.map-container[dataType*="Radar"]'));
    const satContainers = Array.from(document.querySelectorAll('.map-container[dataType*="Sat"]'));
    let index = 0;

    // Initialize radar maps first
    for (const container of radarContainers) {
        const id = `${container.id}-${index++}`;
        container.id = id;
        const zoomLevel = container.getAttribute('dataType').startsWith('regional') ? 5.7 : 8.7;

        const map = new mapboxgl.Map({
            container,
            style: 'mapbox://styles/tyetenna/cm4uiu2xk000a01s8emz0bn89',
            center: [primaryLoc.lon, primaryLoc.lat],
            zoom: zoomLevel,
            attributionControl: false,
            maxZoom: 10,
            minZoom: 4,
            preserveDrawingBuffer: true,
            failIfMajorPerformanceCaveat: false,
            validateStyle: false 
        });

        map.once('load', async () => {
            await initializeMapLayers(map);
            document.querySelectorAll('.mapboxgl-control-container')
                .forEach(ctrl => ctrl.style.display = 'none');
        });

        // Add error handling
        map.on('error', (e) => {
            console.warn('Map error:', e);
        });

        // Cleanup on map removal
        map.on('remove', () => {
            if (container._cleanup) {
                container._cleanup();
                container._cleanup = null;
            }
        });

        state.maps.set(id, map);
    }

    // Then initialize satellite maps
    for (const container of satContainers) {
        const id = `${container.id}-${index}`;
        container.id = id;
        const zoomLevel = container.getAttribute('dataType').startsWith('regional') ? 5.7 : 8.7;

        const map = new mapboxgl.Map({
            container,
            style: 'mapbox://styles/tyetenna/cm4uiu2xk000a01s8emz0bn89',
            center: [primaryLoc.lon, primaryLoc.lat],
            zoom: zoomLevel,
            attributionControl: false,
            maxZoom: 10,
            minZoom: 4,
            preserveDrawingBuffer: true,
            failIfMajorPerformanceCaveat: false,
            validateStyle: false 
        });

        map.once('load', async () => {
            await initializeMapLayers(map);
            document.querySelectorAll('.mapboxgl-control-container')
                .forEach(ctrl => ctrl.style.display = 'none');
        });

        // Add error handling
        map.on('error', (e) => {
            console.warn('Map error:', e);
        });

        // Cleanup on map removal
        map.on('remove', () => {
            if (container._cleanup) {
                container._cleanup();
                container._cleanup = null;
            }
        });

        state.maps.set(id, map);
    }

    startTimestampRefresh();
    return state.maps;
}

// Add cleanup function for map instances
export function cleanupMap(mapId) {
    const map = state.maps.get(mapId);
    if (map) {
        if (map.getContainer()._cleanup) {
            map.getContainer()._cleanup();
        }
        map.remove();
        state.maps.delete(mapId);
    }
}

// Add periodic timestamp refresh
function startTimestampRefresh() {
    // Refresh radar timestamps every 2 minutes
    setInterval(async () => {
        await fetchTimestamps('radar');
        state.maps.forEach(map => {
            if (map.getContainer().getAttribute('dataType').includes('Radar')) {
                initializeMapLayers(map);
            }
        });
    }, 2 * 60 * 1000);

    // Refresh satellite timestamps every 10 minutes
    setInterval(async () => {
        await fetchTimestamps('sat');
        state.maps.forEach(map => {
            if (map.getContainer().getAttribute('dataType').includes('Sat')) {
                initializeMapLayers(map);
            }
        });
    }, 10 * 60 * 1000);
}


export { state as maps };
