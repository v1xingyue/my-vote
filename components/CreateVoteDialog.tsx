import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { VoteProgram } from "../utils/program";
import { Transaction } from "@solana/web3.js";
import { Connection } from "@solana/web3.js";
import { SOLANA_RPC_ENDPOINT } from "../config/constants";

interface CreateVoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateVoteDialog({
  isOpen,
  onClose,
  onCreated,
}: CreateVoteDialogProps) {
  const { wallet, signTransaction, signAllTransactions } = useWallet();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "error",
  });
  const connection = new Connection(SOLANA_RPC_ENDPOINT);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet?.adapter?.publicKey) return;

    setLoading(true);
    try {
      // 检查余额
      const balance = await connection.getBalance(wallet.adapter.publicKey);
      const requiredBalance = 10000000; // 0.01 SOL in lamports

      if (balance < requiredBalance) {
        setToast({
          show: true,
          message: "余额不足，创建投票需要 0.01 SOL",
          type: "error",
        });
        return;
      }

      const walletAdapter = {
        publicKey: wallet.adapter.publicKey,
        signTransaction: async (tx: Transaction) => {
          return await signTransaction!(tx);
        },
        signAllTransactions: async (txs: Transaction[]) => {
          return await signAllTransactions!(txs);
        },
      };

      await VoteProgram.createVoteCard(
        walletAdapter as any,
        title,
        description
      );
      onCreated();
      onClose();
      setTitle("");
      setDescription("");
    } catch (error: any) {
      console.error("Create vote error:", error);
      alert(`创建投票失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">创建新投票</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              标题
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              描述
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 flex items-center"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  处理中...
                </>
              ) : (
                "创建投票"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
