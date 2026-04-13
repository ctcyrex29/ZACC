import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../services/api';

interface BlockchainVerificationProps {
  reportId: string;
}

const BlockchainVerification: React.FC<BlockchainVerificationProps> = ({ reportId }) => {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/reports/${reportId}/verify`);
      setVerified(response.verified);
      setBlockNumber(response.block_number);
      setTxHash(response.tx_hash);
    } catch (err: any) {
      console.error('Verification failed:', err);
      toast.error(err.message || 'Verification failed');
      setError(err.message || 'Verification failed');
      setVerified(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 p-5 border border-slate-700/50 rounded-xl bg-slate-900/50 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Blockchain Integrity Check
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold bg-slate-800 px-2 py-1 rounded">Immutable Proof</span>
      </div>
      
      <p className="text-sm text-slate-400 mb-4">
        Verify that this report data remains unchanged and exists on the ZACC Integrity Nexus blockchain ledger.
      </p>

      <button
        onClick={verifyReport}
        disabled={loading}
        className={`w-full py-3 rounded-lg text-white font-bold transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 ${
          loading 
            ? 'bg-blue-900/50 cursor-not-allowed text-blue-300' 
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20'
        }`}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Verifying Ledger...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Verify on Blockchain
          </>
        )}
      </button>
      
      {verified !== null && (
        <div className={`mt-4 overflow-hidden transition-all duration-500`}>
          <div className={`p-4 rounded-lg border flex items-start gap-4 ${
            verified 
              ? 'bg-emerald-900/20 border-emerald-500/40 text-emerald-100' 
              : 'bg-red-900/20 border-red-500/40 text-red-100'
          }`}>
            <div className={`p-2 rounded-full ${verified ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              {verified ? (
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            
            <div className="flex-1">
              <p className="font-bold mb-1">
                {verified ? 'Integrity Verified' : 'Verification Failed'}
              </p>
              <p className="text-sm opacity-80 mb-3">
                {verified 
                  ? 'Data hash matches the record on the immutable ledger.' 
                  : error || 'The report hash could not be found or has been tampered with.'}
              </p>
              
              {verified && blockNumber && (
                <div className="space-y-2 text-[11px] font-mono bg-black/30 p-3 rounded border border-white/5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Block Number:</span>
                    <span className="text-blue-400">{blockNumber}</span>
                  </div>
                  {txHash && (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500">Transaction Hash:</span>
                      <span className="text-blue-400 break-all">{txHash}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-top border-white/5 pt-1 mt-1">
                    <span className="text-slate-500">Ledger Type:</span>
                    <span className="text-blue-400">Hyperledger / Ethereum</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockchainVerification;
