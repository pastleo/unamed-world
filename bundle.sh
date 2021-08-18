#!/bin/bash

deno bundle index.ts www/dist/browser.js
echo 'find some static file server to serve www/'
