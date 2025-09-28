/*! coi-serviceworker v0.1.6 - Guido Zuidhof, licensed under MIT */
// From: https://github.com/gzuidhof/coi-serviceworker
// This service worker enables cross-origin isolation by adding the required headers

if(typeof window === 'undefined') {
    // We are in the service worker

    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

    self.addEventListener("fetch", event => {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.status === 0) {
                        return response;
                    }

                    // Only add headers to HTML and JS responses to avoid issues with other content types
                    if (event.request.destination === 'document' || 
                        event.request.destination === 'script' || 
                        event.request.destination === 'worker') {
                        const newHeaders = new Headers(response.headers);
                        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                        return new Response(response.body, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: newHeaders
                        });
                    }
                    
                    return response;
                })
                .catch(e => console.error(e))
        );
    });

} else {
    // We are in the main thread

    (function() {
        // Check if cross-origin isolation is already enabled (Vercel server headers)
        if (window.crossOriginIsolated) {
            console.log('[COI ServiceWorker] Cross-origin isolation is already enabled via server headers');
            return;
        }
        
        const reloadedBySelf = window.sessionStorage.getItem("coi-reloaded");
        if (reloadedBySelf) {
            window.sessionStorage.removeItem("coi-reloaded");
            return;
        }

        const needsCoiHeaders = !window.crossOriginIsolated;

        if (needsCoiHeaders && window.isSecureContext) {
            if (window.navigator && window.navigator.serviceWorker && window.navigator.serviceWorker.register) {
                window.navigator.serviceWorker.register(window.document.currentScript.src).then(
                    registration => {
                        console.log('[COI ServiceWorker] Registration successful with scope: ', registration.scope);
                        
                        if (registration.active && !window.navigator.serviceWorker.controller) {
                            window.sessionStorage.setItem("coi-reloaded", "1");
                            window.location.reload();
                        }
                    },
                    err => {
                        console.log('[COI ServiceWorker] Registration failed: ', err);
                    }
                );
            }
        }
    })();
}
