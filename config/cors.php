<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may be executed
    | in web browsers. The values here will be used to set headers that will
    | be passed to the web browser upon a request to your Laravel application
    | from a browser on a different domain.
    |
    | `supportsCredentials` being true, allows cookies to be included in
    | cross-origin requests as described by the W3C specification of the Access
    | Control Allow Credentials header.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:3000')],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
