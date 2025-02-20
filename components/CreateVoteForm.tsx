import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { VoteProgram } from "../utils/program";
import { Transaction } from "@solana/web3.js";

interface CreateVoteFormProps {
  onCreated: () => void;
}

export default function CreateVoteForm({ onCreated }: CreateVoteFormProps) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !signTransaction) return;

    setLoading(true);
    try {
      const walletAdapter = {
        publicKey,
        signTransaction: async (tx: Transaction) => {
          return await signTransaction(tx);
        },
        signAllTransactions: async (txs: Transaction[]) => {
          return await Promise.all(txs.map((tx) => signTransaction(tx)));
        },
      };

      await VoteProgram.createVoteCard(
        walletAdapter as any,
        title,
        description
      );

      setTitle("");
      setDescription("");
      onCreated();
    } catch (error) {
      console.error("Create error:", error);
      alert(
        `创建失败: ${error.message}\n请确保您的钱包已连接到 Devnet 并且有足够的 SOL`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="mb-4">
        <label className="block mb-2">标题</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={50}
          className="w-full px-3 py-2 border rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block mb-2">描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={280}
          className="w-full px-3 py-2 border rounded"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading || !publicKey}
        className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-400"
      >
        {loading ? "创建中..." : "创建投票"}
      </button>
    </form>
  );
}
