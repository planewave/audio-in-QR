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

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders
                    });
                })
                .catch(e => console.error(e))
        );
    });

} else {
    // We are in the main thread

    (() => {
        const reloadedBySelf = window.sessionStorage.getItem("coi-reloaded");
        if (reloadedBySelf) {
            window.sessionStorage.removeItem("coi-reloaded");
            return;
        }

        const needsCoiHeaders = (() => {
            return !window.crossOriginIsolated;
        })();

        const coiServiceWorker = (() => {
            if (typeof window === 'undefined') {
                return {};
            }
            
            if (window.navigator && window.navigator.serviceWorker && window.navigator.serviceWorker.register) {
                window.navigator.serviceWorker.register(window.document.currentScript.src).then(
                    registration => {
                        console.log('[COI ServiceWorker] Registration successful with scope: ', registration.scope);
                        
                        if (needsCoiHeaders) {
                            if (registration.active && !window.navigator.serviceWorker.controller) {
                                window.sessionStorage.setItem("coi-reloaded", "1");
                                window.location.reload();
                            }
                        }
                    },
                    err => {
                        console.log('[COI ServiceWorker] Registration failed: ', err);
                    }
                );
            }
        })();
    })();
}
