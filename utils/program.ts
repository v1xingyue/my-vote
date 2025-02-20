import { Program, AnchorProvider, Wallet } from "@project-serum/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../idl.json";
import { SOLANA_RPC_ENDPOINT } from "../config/constants";

const programID = new PublicKey("6RcLuYsYfmbfbwkd1bDeFy2MpnU3fUg4NMmWmx5Dy3bE");

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
    });
    const program = new Program(idl as any, programID, provider);

    try {
      // 获取 program-admin PDA
      const [programAdminPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("program-admin")],
        programID
      );

      // 获取 vote-card PDA
      const [voteCardPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote-card"),
          wallet.publicKey.toBuffer(),
          Buffer.from(title),
        ],
        programID
      );

      const tx = await program.methods
        .createVoteCard(title, description)
        .accounts({
          voteCard: voteCardPDA,
          author: wallet.publicKey,
          programAdmin: programAdminPDA,
          feeReceiver: programAdminPDA, // 使用 programAdmin 作为费用接收者
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
    });
    const program = new Program(idl as any, programID, provider);

    try {
      // 获取 program-admin PDA
      const [programAdminPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("program-admin")],
        programID
      );

      const tx = await program.methods
        .castVote()
        .accounts({
          voteCard: voteCardPubkey,
          voter: wallet.publicKey,
          programAdmin: programAdminPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Vote transaction signature:", tx);

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
      console.error("Error in castVote:", error);
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
    });
    const program = new Program(idl as any, programID, provider);

    try {
      // 获取 program-admin PDA
      const [programAdminPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("program-admin")],
        programID
      );

      const tx = await program.methods
        .unvote()
        .accounts({
          voteCard: voteCardPubkey,
          voter: wallet.publicKey,
          programAdmin: programAdminPDA,
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
      console.error("Error in unvote:", error);
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

  static async checkProgramInitialized(
    connection: Connection
  ): Promise<boolean> {
    try {
      // 获取 program-admin PDA
      const [programAdminPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("program-admin")],
        programID
      );

      // 创建 provider 和 program 实例
      const provider = new AnchorProvider(
        connection,
        // 使用空钱包，因为我们只是读取状态
        { publicKey: PublicKey.default } as any,
        { commitment: "confirmed" }
      );

      const program = new Program(idl as any, programID, provider);

      // 获取管理员账户并正确类型转换
      const adminAccount = (await program.account.programAdmin.fetch(
        programAdminPDA
      )) as any;

      // 检查账户是否存在并已初始化
      return adminAccount && adminAccount.isInitialized === true;
    } catch (error) {
      console.log("Program not initialized:", error);
      return false;
    }
  }

  static async initializeProgram(wallet: Wallet): Promise<string> {
    const connection = new Connection(SOLANA_RPC_ENDPOINT);
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    const program = new Program(idl as any, programID, provider);

    try {
      // 获取 program-admin PDA
      const [programAdminPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("program-admin")],
        programID
      );

      const tx = await program.methods
        .initialize()
        .accounts({
          programAdmin: programAdminPDA,
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // 等待交易确认
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature: tx,
          ...latestBlockhash,
        },
        "confirmed"
      );

      console.log("Program initialized with tx:", tx);
      return tx;
    } catch (error) {
      console.error("Failed to initialize program:", error);
      throw error;
    }
  }
}
