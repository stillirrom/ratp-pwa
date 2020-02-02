importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js');

workbox.setConfig({ debug: true });

workbox.core.setCacheNameDetails({
    prefix: 'my-app',
    suffix: 'v1',
    precache: 'precache-cache',
    runtime: 'runtime-cache',
});

workbox.routing.registerRoute(
    new RegExp('/.*'),
    new workbox.strategies.StaleWhileRevalidate({
        cacheName: 'myapp-cache',
    })
);

workbox.routing.registerRoute(
    new RegExp('^https:\/\/api-ratp\.pierre-grimaud\.fr\/v3\/'),
    new workbox.strategies.StaleWhileRevalidate({
        cacheName: 'myapp-data-cache',
    })
);