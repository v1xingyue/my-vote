import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";
import CreateVoteForm from "../components/CreateVoteForm";
import VoteCard from "../components/VoteCard";
import { Program } from "@project-serum/anchor";
import dynamic from "next/dynamic";
import { Connection } from "@solana/web3.js";
import { VoteProgram } from "../utils/program";
import { Transaction } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Wallet } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import CreateVoteDialog from "../components/CreateVoteDialog";

// 动态导入 WalletMultiButton
const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

// 在文件顶部添加类型定义
export interface VoteCardData {
  title: string;
  description: string;
  author: PublicKey;
  voteCount: number;
  createTime: number;
  publicKey: PublicKey;
  voters: PublicKey[];
}

export default function Home() {
  const { wallet } = useWallet();
  const { connection } = useConnection();
  const [voteCards, setVoteCards] = useState<VoteCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [network, setNetwork] = useState<string>("未连接");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // 获取当前连接的网络
    async function getNetworkName() {
      if (!connection) {
        setNetwork("未连接");
        return;
      }

      try {
        const genesisHash = await connection.getGenesisHash();
        let networkName = "未知网络";

        // 根据创世哈希判断网络
        switch (genesisHash) {
          case "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG":
            networkName = "Devnet";
            break;
          case "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d":
            networkName = "Mainnet Beta";
            break;
          case "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY":
            networkName = "Testnet";
            break;
        }

        setNetwork(networkName);
      } catch (error) {
        console.error("Error getting network:", error);
        setNetwork("连接错误");
      }
    }

    getNetworkName();
  }, [connection]);

  const fetchVoteCards = async () => {
    if (!wallet?.adapter?.publicKey) return;
    setLoading(true);
    try {
      const walletAdapter: Wallet = {
        publicKey: wallet.adapter.publicKey,
        signTransaction: async (tx: Transaction) => {
          return tx;
        },
        signAllTransactions: async (txs: Transaction[]) => {
          return txs;
        },
        payer: null as any,
      };

      const cards = await VoteProgram.getAllVoteCards(walletAdapter);
      cards.sort((a, b) => b.createTime - a.createTime);
      console.log("cards", cards);
      setVoteCards(cards);
    } catch (error) {
      console.error("Failed to fetch vote cards:", error);
      alert("获取投票列表失败，请检查网络连接后重试");
    } finally {
      setLoading(false);
    }
  };

  // 确保在钱包连接状态改变时重新获取数据
  useEffect(() => {
    if (wallet?.adapter?.connected) {
      fetchVoteCards();
    } else {
      setVoteCards([]); // 清空列表当钱包断开连接
    }
  }, [wallet?.adapter?.connected]);

  // 在客户端渲染之前不显示任何内容
  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="bg-white shadow-lg rounded-lg p-6 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">投票系统</h1>
            <p className="text-sm text-gray-600 mt-2">
              当前网络:{" "}
              <span className="font-medium bg-blue-100 px-2 py-1 rounded">
                {network}
              </span>
              {network !== "Devnet" && (
                <span className="text-red-500 ml-2 bg-red-50 px-2 py-1 rounded">
                  (请切换到 Devnet 网络)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {wallet && (
              <button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg transition-colors duration-200 flex items-center tooltip-container"
                title="创建新投票"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            )}
            <WalletMultiButtonDynamic />
          </div>
        </header>

        <CreateVoteDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onCreated={() => {
            fetchVoteCards();
            setIsCreateDialogOpen(false);
          }}
        />

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.isArray(voteCards) &&
              voteCards.map((card: VoteCardData) => (
                <VoteCard
                  key={card.publicKey.toString()}
                  card={card}
                  onUpdate={fetchVoteCards}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
