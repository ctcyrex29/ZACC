import React from 'react';
import axios from 'axios';

export default function BlockchainVerification({ reportId }) {
    const [verified, setVerified] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [blockNumber, setBlockNumber] = React.useState(null);
    const [txHash, setTxHash] = React.useState(null);

    const verifyReport = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/reports/${reportId}/verify`);
            setVerified(response.data.verified);
            setBlockNumber(response.data.block_number);
            setTxHash(response.data.tx_hash);
        } catch (error) {
            console.error('Verification failed:', error);
            setVerified(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-4 p-4 border rounded bg-white shadow-sm">
            <h3 className="text-lg font-medium mb-3 text-gray-800">Blockchain Verification</h3>
            
            <button
                onClick={verifyReport}
                disabled={loading}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                    loading 
                        ? 'bg-blue-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                } transition-colors`}
            >
                {loading ? 'Verifying...' : 'Verify on Blockchain'}
            </button>
            
            {verified !== null && (
                <div className="mt-3">
                    <div className={`p-3 rounded-md ${
                        verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                        {verified ? (
                            <>
                                <div className="flex items-center">
                                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span>Successfully verified on blockchain</span>
                                </div>
                                {blockNumber && (
                                    <div className="mt-2 text-sm">
                                        <p>Block: <span className="font-mono">{blockNumber}</span></p>
                                        {txHash && (
                                            <p className="truncate">
                                                TX: <span className="font-mono">{txHash}</span>
                                            </p>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center">
                                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <span>Verification failed. Report not found on blockchain.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div className="mt-3 text-xs text-gray-500">
                <p>This verifies that the report data is stored immutably on the blockchain.</p>
            </div>
        </div>
    );
}
