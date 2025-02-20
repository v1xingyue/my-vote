import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useState, useEffect } from "react";
import { VoteProgram } from "../utils/program";
import { VoteCardData } from "../pages";
import { Transaction } from "@solana/web3.js";
import Toast from "./Toast";
import { Connection } from "@solana/web3.js";
import { SOLANA_RPC_ENDPOINT } from "../config/constants";

interface VoteCardProps {
  card: VoteCardData;
  onUpdate: () => void;
}

export default function VoteCard({ card, onUpdate }: VoteCardProps) {
  const {
    wallet,
    publicKey: userPublicKey,
    signTransaction,
    signAllTransactions,
  } = useWallet();
  const [loading, setLoading] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  } | null>(null);

  const authorString = card.author.toString();
  const isAuthor = userPublicKey?.toString() === card.author.toString();

  console.log("Author:", card.author.toString());
  console.log("Current user:", userPublicKey?.toString());
  console.log("Is author:", isAuthor);

  const connection = new Connection(SOLANA_RPC_ENDPOINT);

  useEffect(() => {
    const checkVoteStatus = async () => {
      if (!wallet?.adapter?.publicKey || !card.voters) return;

      const userPubkey = wallet.adapter.publicKey.toString();
      setHasVoted(card.voters.some((voter) => voter.toString() === userPubkey));
    };

    checkVoteStatus();
  }, [wallet?.adapter?.publicKey, card.voters]);

  const handleVote = async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      // 检查余额
      const balance = await connection.getBalance(wallet.adapter.publicKey);
      const requiredBalance = 1_000_000; // 0.001 SOL in lamports

      if (balance < requiredBalance) {
        setToast({
          show: true,
          message: "余额不足，投票需要 0.001 SOL",
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

      await VoteProgram.castVote(
        walletAdapter as any,
        new PublicKey(card.publicKey)
      );
      onUpdate();
      setToast({
        show: true,
        message: "投票成功！",
        type: "success",
      });
    } catch (error: any) {
      console.error("Vote error:", error);
      // 检查是否是重复投票错误
      if (error.message.includes("already voted")) {
        setToast({
          show: true,
          message: "您已经投过票了！",
          type: "error",
        });
      } else {
        setToast({
          show: true,
          message: `投票失败: ${error.message}`,
          type: "error",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnvote = async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const walletAdapter = {
        publicKey: wallet.adapter.publicKey,
        signTransaction: async (tx: Transaction) => {
          return await signTransaction!(tx);
        },
        signAllTransactions: async (txs: Transaction[]) => {
          return await signAllTransactions!(txs);
        },
      };

      await VoteProgram.unvote(
        walletAdapter as any,
        new PublicKey(card.publicKey)
      );
      onUpdate();
      setHasVoted(false);
      setToast({
        show: true,
        message: "已成功取消投票，0.001 SOL 已返还！",
        type: "success",
      });
    } catch (error: any) {
      console.error("Unvote error:", error);
      setToast({
        show: true,
        message: `取消投票失败: ${error.message}`,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!wallet || !isAuthor) return;

    setLoading(true);
    try {
      const walletAdapter = {
        publicKey: wallet.adapter.publicKey,
        signTransaction: async (tx: Transaction) => {
          return await signTransaction!(tx);
        },
        signAllTransactions: async (txs: Transaction[]) => {
          return await signAllTransactions!(txs);
        },
      };

      await VoteProgram.removeCard(
        walletAdapter as any,
        new PublicKey(card.publicKey)
      );
      onUpdate(); // 刷新列表
      setShowDeleteConfirm(false);
      setToast({
        show: true,
        message: "投票已成功删除",
        type: "success",
      });
    } catch (error: any) {
      console.error("Remove error:", error);
      setToast({
        show: true,
        message: `删除失败: ${error.message}`,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex-grow">
              {card.title}
            </h3>
            {isAuthor && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-500 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors duration-200"
                title="删除投票"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>

          <p className="text-gray-600 mb-4">{card.description}</p>

          <div className="flex items-center text-sm text-gray-500 mb-4">
            <svg
              className="w-4 h-4 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              {authorString.slice(0, 4)}...{authorString.slice(-4)}
            </span>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-blue-500 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
                <span className="font-bold text-lg text-gray-800">
                  {Number(card.voteCount)}
                  <span className="text-sm text-gray-500 ml-1">票</span>
                </span>
              </div>

              <div className="flex gap-2">
                {!loading ? (
                  <>
                    {!hasVoted ? (
                      <button
                        onClick={handleVote}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center group relative"
                        disabled={loading}
                      >
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                        </svg>
                        投票
                        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          需要 0.001 SOL
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={handleUnvote}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center"
                        disabled={loading}
                      >
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                        取消投票
                      </button>
                    )}
                    {isAuthor && (
                      <button
                        onClick={handleRemove}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center"
                        disabled={loading}
                      >
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        删除
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex items-center text-gray-600">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
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
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    处理中...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">确认删除</h3>
            <p className="text-gray-600 mb-6">
              确定要删除这个投票吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={loading}
              >
                取消
              </button>
              <button
                onClick={handleRemove}
                className="px-4 py-2 text-white bg-red-500 rounded-md hover:bg-red-600 flex items-center"
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
                  "确认删除"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast?.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
