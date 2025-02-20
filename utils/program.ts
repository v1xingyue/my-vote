import { Program, AnchorProvider, Wallet } from "@project-serum/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../idl.json";
import { SOLANA_RPC_ENDPOINT } from "../config/constants";

const programID = new PublicKey("HpCD3a3oLppiu3C9hGDQreu89UdXitwxgNS7iX2sZM1x");

interface VoteCardAccount {
  data: number[] | string; // base64 encoded data
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch: number;
  space: number;
}

export class VoteProgram {
  static async createVoteCard(
    wallet: Wallet,
    title: string,
    description: string
  ) {
    const connection = new Connection(SOLANA_RPC_ENDPOINT);

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });

    const program = new Program(idl as any, programID, provider);

    try {
      // 生成 PDA
      const [voteCardPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote-card"),
          wallet.publicKey.toBuffer(),
          Buffer.from(title),
        ],
        programID
      );

      console.log("Creating vote card with PDA:", voteCardPDA.toString());

      // 直接使用 program.methods 的 rpc() 方法，而不是手动构建交易
      const tx = await program.methods
        .createVoteCard(title, description)
        .accounts({
          voteCard: voteCardPDA,
          author: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Transaction signature:", tx);

      // 改进的交易确认逻辑
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature: tx,
          ...latestBlockhash,
        },
        "confirmed"
      );

      // 添加重试逻辑来获取账户
      let account = null;
      let retries = 10;
      while (retries > 0 && !account) {
        try {
          account = await program.account.voteCard.fetch(voteCardPDA);
          console.log("Vote card created:", account);
          break;
        } catch (e) {
          console.log(`Retry attempt ${6 - retries} to fetch account...`);
          retries--;
          if (retries === 0) throw e;
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待1秒后重试
        }
      }

      return voteCardPDA;
    } catch (error: any) {
      console.error("Error in createVoteCard:", error);
      console.error("Error details:", {
        message: error.message,
        logs: error.logs,
        errorLogs: error.logs?.filter((log: string) => log.includes("Error")),
      });
      throw error;
    }
  }

  static async castVote(wallet: Wallet, voteCardPubkey: PublicKey) {
    const connection = new Connection(SOLANA_RPC_ENDPOINT);

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });

    const program = new Program(idl as any, programID, provider);

    try {
      console.log("Casting vote for:", voteCardPubkey.toString());
      console.log("Voter:", provider.wallet.publicKey.toString());
      console.log("System Program ID:", SystemProgram.programId.toString());

      // 直接使用 rpc() 方法
      const txSignature = await program.methods
        .castVote()
        .accounts({
          voteCard: voteCardPubkey,
          voter: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Vote transaction signature:", txSignature);

      // 等待交易确认
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature: txSignature,
          ...latestBlockhash,
        },
        "confirmed"
      );

      return txSignature;
    } catch (error: any) {
      console.error("Error casting vote:", error);
      console.error("Error details:", {
        message: error.message,
        logs: error.logs,
        errorLogs: error.logs?.filter((log: string) => log.includes("Error")),
      });
      throw error;
    }
  }

  static async unvote(wallet: Wallet, voteCardPubkey: PublicKey) {
    const connection = new Connection(SOLANA_RPC_ENDPOINT);

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });

    const program = new Program(idl as any, programID, provider);

    try {
      console.log("Unvoting from:", voteCardPubkey.toString());

      const tx = await program.methods
        .unvote()
        .accounts({
          voteCard: voteCardPubkey,
          voter: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Unvote transaction signature:", tx);

      // 等待交易确认
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature: tx,
          ...latestBlockhash,
        },
        "confirmed"
      );

      return tx;
    } catch (error: any) {
      console.error("Error unvoting:", error);
      if (error.logs) {
        console.error("Program logs:", error.logs.join("\n"));
      }
      throw error;
    }
  }

  static async removeCard(wallet: Wallet, voteCardPubkey: PublicKey) {
    const connection = new Connection(SOLANA_RPC_ENDPOINT);

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });

    const program = new Program(idl as any, programID, provider);

    try {
      console.log("Removing vote card:", voteCardPubkey.toString());

      const tx = await program.methods
        .removeCard()
        .accounts({
          voteCard: voteCardPubkey,
          author: provider.wallet.publicKey,
        })
        .rpc();

      console.log("Remove transaction signature:", tx);

      // 等待交易确认
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature: tx,
          ...latestBlockhash,
        },
        "confirmed"
      );

      return tx;
    } catch (error: any) {
      console.error("Error removing vote card:", error);
      if (error.logs) {
        console.error("Program logs:", error.logs.join("\n"));
      }
      throw new Error(`Failed to remove vote card: ${error.message}`);
    }
  }

  static async getAllVoteCards(wallet: Wallet) {
    const connection = new Connection(SOLANA_RPC_ENDPOINT);

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });

    const program = new Program(idl as any, programID, provider);

    try {
      const voteCards = await program.account.voteCard.all();
      console.log("Found vote cards:", voteCards.length);
      return voteCards.map((card) => {
        const data = card.account as any;
        return {
          publicKey: new PublicKey(card.publicKey),
          title: data.title,
          description: data.description,
          author: data.author,
          voteCount: data.voteCount,
          voters: data.voters,
          createTime: data.createTime,
        };
      });
    } catch (error) {
      console.error("Error fetching vote cards:", error);
      throw new Error(`Failed to fetch vote cards: ${error.message}`);
    }
  }
}
