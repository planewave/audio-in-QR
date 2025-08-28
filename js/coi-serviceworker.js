/*! coi-serviceworker v0.1.7 - Modified for better Safari compatibility */
// Based on: https://github.com/gzuidhof/coi-serviceworker
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

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders
                    });
                })
                .catch(e => console.error("Fetch failed:", e))
        );
    });

} else {
    // We are in the main thread

    // Check if we're already cross-origin isolated
    if (window.crossOriginIsolated) {
        // Already isolated
    } else {
        // Try to register the service worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
                navigator.serviceWorker.register('./js/coi-serviceworker.js')
                    .then(function(registration) {
                        console.log('[COI ServiceWorker] Registration successful with scope: ', registration.scope);
                        
                        // If the service worker is installed but we're not isolated, reload
                        if (!window.crossOriginIsolated && registration.active) {
                            console.log('[COI] Reloading to activate cross-origin isolation...');
                            window.sessionStorage.setItem("coi-reload", "1");
                            window.location.reload();
                        }
                    })
                    .catch(function(err) {
                        console.log('[COI ServiceWorker] Registration failed: ', err);
                    });
            });
        }
    }
}
