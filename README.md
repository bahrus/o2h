# o2h

Converts JavaScript Object into canonical HTML.

o2h supports a JSON-based configuration file / stream which can tailor the output.

o2h will typically be used on the server (e.g. in a CloudFlare Worker) or in a service worker, in order to generate output from an api in a format the browser can easily digest.

The JSON-based configuration will typically contain numerous hooks for custom element placeholder tags and slots, which can allow the client-side to progressively adjust the output.



TODO:  support use of be-definitive for arrays.

## Viewing Locally

Any web server that serves static files with server-side includes will do but...

1. Install git
2. Fork/clone this repo
3. Install node.js
4. Open command window to folder where you cloned this repo
5. > git submodule add https://github.com/bahrus/types.git types
6. > git submodule update --init --recursive
7. > npm install
8. > npm run serve
9. Open http://localhost:8000/demo/ in a modern browser
