/*! coi-serviceworker v0.2.0 - Enhanced Safari compatibility */
// Based on: https://github.com/gzuidhof/coi-serviceworker
// Enhanced for better Safari and GitHub Pages compatibility

if (typeof window === 'undefined') {
    // We are in the service worker context
    
    self.addEventListener('install', (event) => {
        console.log('[COI SW] Installing...');
        self.skipWaiting();
    });
    
    self.addEventListener('activate', (event) => {
        console.log('[COI SW] Activating...');
        event.waitUntil(
            self.clients.claim().then(() => {
                console.log('[COI SW] All clients claimed');
            })
        );
    });
    
    self.addEventListener('fetch', (event) => {
        // Skip cache-only requests that are not same-origin
        if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
            return;
        }
        
        // Skip non-HTTP requests
        if (!event.request.url.startsWith('http')) {
            return;
        }
        
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Don't modify responses with status 0 (opaque responses)
                    if (response.status === 0) {
                        return response;
                    }
                    
                    // Clone the response to avoid consuming it
                    const responseClone = response.clone();
                    const newHeaders = new Headers(responseClone.headers);
                    
                    // Add COOP and COEP headers
                    newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
                    newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
                    
                    // For Safari, also add additional headers that might help
                    newHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
                    
                    return new Response(responseClone.body, {
                        status: responseClone.status,
                        statusText: responseClone.statusText,
                        headers: newHeaders
                    });
                })
                .catch((error) => {
                    console.error('[COI SW] Fetch failed:', error);
                    return fetch(event.request); // Fallback to normal fetch
                })
        );
    });
    
} else {
    // We are in the main thread context
    
    // Enhanced registration function with better Safari support
    function registerCOIServiceWorker() {
        // Check if we already reloaded to avoid infinite loops
        const hasReloaded = sessionStorage.getItem('coi-sw-reloaded');
        if (hasReloaded === 'true') {
            sessionStorage.removeItem('coi-sw-reloaded');
            console.log('[COI] Page reloaded for service worker activation');
            return;
        }
        
        // Check if cross-origin isolation is already enabled
        if (window.crossOriginIsolated) {
            console.log('[COI] Already cross-origin isolated');
            return;
        }
        
        // Check for service worker support
        if (!('serviceWorker' in navigator)) {
            console.warn('[COI] Service workers not supported');
            return;
        }
        
        // Register the service worker
        navigator.serviceWorker.register('/coi-serviceworker.js', {
            scope: '/'
        })
        .then((registration) => {
            console.log('[COI] Service Worker registered:', registration.scope);
            
            // Handle different registration states
            if (registration.installing) {
                console.log('[COI] Service Worker installing...');
                registration.installing.addEventListener('statechange', function() {
                    if (this.state === 'installed') {
                        handleServiceWorkerReady(registration);
                    }
                });
            } else if (registration.waiting) {
                console.log('[COI] Service Worker waiting...');
                handleServiceWorkerReady(registration);
            } else if (registration.active) {
                console.log('[COI] Service Worker active');
                handleServiceWorkerReady(registration);
            }
        })
        .catch((error) => {
            console.error('[COI] Service Worker registration failed:', error);
        });
        
        function handleServiceWorkerReady(registration) {
            // If we're not cross-origin isolated and there's no controller,
            // we need to reload to activate the service worker
            if (!window.crossOriginIsolated && !navigator.serviceWorker.controller) {
                console.log('[COI] Reloading to activate cross-origin isolation...');
                sessionStorage.setItem('coi-sw-reloaded', 'true');
                
                // Use a slight delay to ensure the service worker is fully registered
                setTimeout(() => {
                    window.location.reload();
                }, 100);
            }
        }
    }
    
    // Register when the DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', registerCOIServiceWorker);
    } else {
        registerCOIServiceWorker();
    }
}
