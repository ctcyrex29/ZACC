<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'blockchain' => [
        'node_url' => env('BLOCKCHAIN_NODE_URL', 'http://localhost:8545'),
        'contract_address' => env('BLOCKCHAIN_CONTRACT_ADDRESS'),
        'private_key' => env('BLOCKCHAIN_PRIVATE_KEY'),
    ],

    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-2.0-flash'),
        'fallback_models' => array_values(array_filter(array_map('trim', explode(',', (string) env('GEMINI_FALLBACK_MODELS', 'gemini-1.5-flash,gemini-1.5-flash-8b'))))),
        'routing_strategy' => strtolower((string) env('GEMINI_ROUTING_STRATEGY', 'balanced')),
        'strategy_orders' => [
            'fast' => array_values(array_filter(array_map('trim', explode(',', (string) env('GEMINI_FAST_MODEL_ORDER', 'gemini-2.0-flash,gemini-1.5-flash-8b,gemini-1.5-flash'))))),
            'balanced' => array_values(array_filter(array_map('trim', explode(',', (string) env('GEMINI_BALANCED_MODEL_ORDER', ''))))),
            'quality' => array_values(array_filter(array_map('trim', explode(',', (string) env('GEMINI_QUALITY_MODEL_ORDER', 'gemini-1.5-flash,gemini-2.0-flash,gemini-1.5-flash-8b'))))),
        ],
        'timeout' => (int) env('GEMINI_TIMEOUT', 15),
    ],

];
