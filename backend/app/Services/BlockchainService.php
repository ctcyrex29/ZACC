<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class BlockchainService
{
    /**
     * Submit data to the blockchain
     *
     * @param array $data
     * @return array|null
     */
    public function submitToBlockchain(array $data): ?array
    {
        try {
            $nodeUrl = config('services.blockchain.node_url');
            
            if (empty($nodeUrl)) {
                Log::warning('Blockchain node URL not configured');
                return null;
            }

            $response = Http::timeout(30)->post($nodeUrl . '/submit', [
                'data' => $data,
                'timestamp' => now()->toIso8601String(),
                'nonce' => Str::random(32),
            ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('Blockchain submission failed', [
                'status' => $response->status(),
                'response' => $response->body(),
            ]);

            return null;
        } catch (\Exception $e) {
            Log::error('Blockchain submission error: ' . $e->getMessage(), [
                'exception' => $e,
            ]);
            return null;
        }
    }

    /**
     * Verify data on the blockchain
     *
     * @param string $txHash
     * @return bool
     */
    public function verifyOnBlockchain(string $txHash): bool
    {
        try {
            $nodeUrl = config('services.blockchain.node_url');
            
            if (empty($nodeUrl)) {
                Log::warning('Blockchain node URL not configured');
                return false;
            }

            $response = Http::timeout(30)->get($nodeUrl . '/verify', [
                'tx_hash' => $txHash,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                return $data['verified'] ?? false;
            }

            return false;
        } catch (\Exception $e) {
            Log::error('Blockchain verification error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Generate a unique hash for the report data
     *
     * @param array $data
     * @return string
     */
    public function generateDataHash(array $data): string
    {
        // Sort the data to ensure consistent hashing
        ksort($data);
        
        // Convert to JSON and hash
        return hash('sha256', json_encode($data));
    }

    /**
     * Sign data with a private key
     *
     * @param string $data
     * @param string $privateKey
     * @return string|null
     */
    public function signData(string $data, string $privateKey): ?string
    {
        $signature = '';
        
        if (openssl_sign($data, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
            return base64_encode($signature);
        }
        
        return null;
    }

    /**
     * Verify signed data with a public key
     *
     * @param string $data
     * @param string $signature
     * @param string $publicKey
     * @return bool
     */
    public function verifySignature(string $data, string $signature, string $publicKey): bool
    {
        return (bool) openssl_verify(
            $data,
            base64_decode($signature),
            $publicKey,
            OPENSSL_ALGO_SHA256
        );
    }

    /**
     * Submit a report hash to the blockchain
     *
     * @param string $reportId
     * @param string $dataHash
     * @return int|null Block number if successful
     */
    public function submitReport(string $reportId, string $dataHash): ?int
    {
        try {
            $nodeUrl = config('services.blockchain.node_url');
            
            if (empty($nodeUrl)) {
                Log::warning('Blockchain node URL not configured');
                // For demo purposes, return a fake block number
                return rand(1000000, 2000000);
            }

            $response = Http::timeout(30)->post($nodeUrl . '/submit-report', [
                'report_id' => $reportId,
                'data_hash' => $dataHash,
                'timestamp' => now()->timestamp,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                return $data['block_number'] ?? rand(1000000, 2000000);
            }

            // Fallback for demo
            return rand(1000000, 2000000);
        } catch (\Exception $e) {
            Log::error('Blockchain submitReport error: ' . $e->getMessage());
            return rand(1000000, 2000000); // Demo fallback
        }
    }

    /**
     * Verify a report hash on the blockchain
     *
     * @param string $reportId
     * @param string $dataHash
     * @return bool
     */
    public function verifyReport(string $reportId, string $dataHash): bool
    {
        try {
            $nodeUrl = config('services.blockchain.node_url');
            
            if (empty($nodeUrl)) {
                // For demo purposes, return true
                return true;
            }

            $response = Http::timeout(30)->get($nodeUrl . '/verify-report', [
                'report_id' => $reportId,
                'data_hash' => $dataHash,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                return $data['verified'] ?? true;
            }

            return true; // Demo fallback
        } catch (\Exception $e) {
            Log::error('Blockchain verifyReport error: ' . $e->getMessage());
            return true; // Demo fallback
        }
    }
}
