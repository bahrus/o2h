# o2h

Converts JavaScript Object into canonical HTML.

o2h supports a JSON-based configuration file / stream which can tailor the output.

o2h will typically be used on the server (e.g. in a CloudFlare Worker) or in a service worker, in order to generate output from an api in a format the browser can easily digest.

The JSON-based configuration will typically contain numerous hooks for custom element placeholder tags and slots, which can allow the client-side to progressively adjust the output.



TODO:  support use of be-definitive for arrays.