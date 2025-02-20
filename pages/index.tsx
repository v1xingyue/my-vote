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
import type { WalletContextState } from "@solana/wallet-adapter-react";
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
  const wallet = useWallet() as WalletContextState;
  const { connection } = useConnection();
  const [voteCards, setVoteCards] = useState<VoteCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [network, setNetwork] = useState<string>("未连接");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

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

  // 检查程序初始化状态
  useEffect(() => {
    const checkInitialization = async () => {
      try {
        const initialized = await VoteProgram.checkProgramInitialized(
          connection
        );
        setIsInitialized(initialized);
      } catch (error) {
        console.error("Failed to check program initialization:", error);
        setIsInitialized(false);
      }
    };

    checkInitialization();
  }, [connection]);

  const fetchVoteCards = async () => {
    if (!wallet?.publicKey) return;
    setLoading(true);
    try {
      const walletAdapter = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
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
    if (wallet?.publicKey) {
      fetchVoteCards();
    } else {
      setVoteCards([]); // 清空列表当钱包断开连接
    }
  }, [wallet?.publicKey]);

  // 初始化程序
  const handleInitialize = async () => {
    if (!wallet?.publicKey) {
      alert("请先连接钱包");
      return;
    }

    try {
      setIsInitializing(true);
      const walletAdapter = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
        payer: null as any,
      };

      const tx = await VoteProgram.initializeProgram(walletAdapter);
      console.log("Program initialized successfully:", tx);
      setIsInitialized(true);
    } catch (error) {
      console.error("Failed to initialize program:", error);
      alert("初始化程序失败");
    } finally {
      setIsInitializing(false);
    }
  };

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

        {/* 初始化状态检查中 */}
        {isInitialized === null && (
          <div className="text-center">
            <p>检查程序状态中...</p>
          </div>
        )}

        {/* 未初始化时显示初始化按钮 */}
        {isInitialized === false && (
          <div className="text-center p-4 bg-yellow-100 rounded-lg">
            <p className="mb-4">程序尚未初始化</p>
            <button
              onClick={handleInitialize}
              disabled={!wallet?.publicKey || isInitializing}
              className={`
                px-4 py-2 rounded-lg
                ${
                  isInitializing
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                }
                text-white font-semibold
              `}
            >
              {isInitializing ? "初始化中..." : "初始化程序"}
            </button>
          </div>
        )}

        {/* 程序已初始化，显示正常内容 */}
        {isInitialized === true && (
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
