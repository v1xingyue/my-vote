describe("Vote Program Tests", () => {
    it("Create Vote Card", async () => {
        // 测试数据
        const title = "Test Vote";
        const description = "This is a test vote description";

        // 计算 PDA
        const [voteCardPda] = await web3.PublicKey.findProgramAddress(
            [
                Buffer.from("vote-card"),
                pg.wallet.publicKey.toBuffer(),
                Buffer.from(title)
            ],
            pg.program.programId
        );

        // 发送创建投票卡片的交易
        const txHash = await pg.program.methods
            .createVoteCard(title, description)
            .accounts({
                voteCard: voteCardPda,
                author: pg.wallet.publicKey,
                systemProgram: web3.SystemProgram.programId,
            })
            .rpc();

        console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

        // 确认交易
        await pg.connection.confirmTransaction(txHash);

        // 获取创建的投票卡片数据
        const voteCardData = await pg.program.account.voteCard.fetch(
            voteCardPda
        );

        // 验证数据
        assert.equal(voteCardData.title, title);
        assert.equal(voteCardData.description, description);
        assert.equal(voteCardData.author.toBase58(), pg.wallet.publicKey.toBase58());
        assert.equal(voteCardData.voteCount.toNumber(), 0);
    });

    it("Cast Vote", async () => {
        // 首先创建一个投票卡片
        const title = "Test Vote for Casting";
        const description = "Testing vote casting functionality";

        const [voteCardPda] = await web3.PublicKey.findProgramAddress(
            [
                Buffer.from("vote-card"),
                pg.wallet.publicKey.toBuffer(),
                Buffer.from(title)
            ],
            pg.program.programId
        );

        await pg.program.methods
            .createVoteCard(title, description)
            .accounts({
                voteCard: voteCardPda,
                author: pg.wallet.publicKey,
                systemProgram: web3.SystemProgram.programId,
            })
            .rpc();

        // 进行投票
        const txHash = await pg.program.methods
            .castVote()
            .accounts({
                voteCard: voteCardPda,
                voter: pg.wallet.publicKey,
            })
            .rpc();

        await pg.connection.confirmTransaction(txHash);

        // 验证投票是否成功
        const voteCardData = await pg.program.account.voteCard.fetch(
            voteCardPda
        );
        assert.equal(voteCardData.voteCount.toNumber(), 1);
    });

    it("Should fail when title is too long", async () => {
        const longTitle = "x".repeat(51); // 51个字符，超过50字符的限制
        const description = "Testing title length validation";

        const [voteCardPda] = await web3.PublicKey.findProgramAddress(
            [
                Buffer.from("vote-card"),
                pg.wallet.publicKey.toBuffer(),
                Buffer.from(longTitle)
            ],
            pg.program.programId
        );

        try {
            await pg.program.methods
                .createVoteCard(longTitle, description)
                .accounts({
                    voteCard: voteCardPda,
                    author: pg.wallet.publicKey,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
            assert.fail("Should have thrown an error");
        } catch (err) {
            assert.equal(err.error.errorCode.code, "TitleTooLong");
        }
    });

    it("Should fail when description is too long", async () => {
        const title = "Test Vote";
        const longDescription = "x".repeat(281); // 281个字符，超过280字符的限制

        const [voteCardPda] = await web3.PublicKey.findProgramAddress(
            [
                Buffer.from("vote-card"),
                pg.wallet.publicKey.toBuffer(),
                Buffer.from(title)
            ],
            pg.program.programId
        );

        try {
            await pg.program.methods
                .createVoteCard(title, longDescription)
                .accounts({
                    voteCard: voteCardPda,
                    author: pg.wallet.publicKey,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();
            assert.fail("Should have thrown an error");
        } catch (err) {
            assert.equal(err.error.errorCode.code, "DescriptionTooLong");
        }
    });

    it("Should fail when voting twice", async () => {
        // 创建投票卡片
        const title = "Test Double Vote";
        const description = "Testing double voting prevention";

        const [voteCardPda] = await web3.PublicKey.findProgramAddress(
            [
                Buffer.from("vote-card"),
                pg.wallet.publicKey.toBuffer(),
                Buffer.from(title)
            ],
            pg.program.programId
        );

        await pg.program.methods
            .createVoteCard(title, description)
            .accounts({
                voteCard: voteCardPda,
                author: pg.wallet.publicKey,
                systemProgram: web3.SystemProgram.programId,
            })
            .rpc();

        // 第一次投票
        await pg.program.methods
            .castVote()
            .accounts({
                voteCard: voteCardPda,
                voter: pg.wallet.publicKey,
            })
            .rpc();

        // 尝试第二次投票
        try {
            await pg.program.methods
                .castVote()
                .accounts({
                    voteCard: voteCardPda,
                    voter: pg.wallet.publicKey,
                })
                .rpc();
            assert.fail("Should have thrown an error");
        } catch (err) {
            assert.equal(err.error.errorCode.code, "AlreadyVoted");
        }
    });

    it("Successfully unvote", async () => {
        // 创建投票卡片
        const title = "Test Unvote";
        const description = "Testing unvote functionality";

        const [voteCardPda] = await web3.PublicKey.findProgramAddress(
            [
                Buffer.from("vote-card"),
                pg.wallet.publicKey.toBuffer(),
                Buffer.from(title)
            ],
            pg.program.programId
        );

        await pg.program.methods
            .createVoteCard(title, description)
            .accounts({
                voteCard: voteCardPda,
                author: pg.wallet.publicKey,
                systemProgram: web3.SystemProgram.programId,
            })
            .rpc();

        // 投票
        await pg.program.methods
            .castVote()
            .accounts({
                voteCard: voteCardPda,
                voter: pg.wallet.publicKey,
            })
            .rpc();

        // 取消投票
        await pg.program.methods
            .unvote()
            .accounts({
                voteCard: voteCardPda,
                voter: pg.wallet.publicKey,
            })
            .rpc();

        // 验证投票已被取消
        const voteCardData = await pg.program.account.voteCard.fetch(
            voteCardPda
        );
        assert.equal(voteCardData.voteCount.toNumber(), 0);
        assert.equal(voteCardData.voters.length, 0);
    });

    it("Successfully remove card and verify account cleanup", async () => {
        // 创建投票卡片
        const title = "Test Remove Card";
        const description = "Testing remove card functionality";

        const [voteCardPda] = await web3.PublicKey.findProgramAddress(
            [
                Buffer.from("vote-card"),
                pg.wallet.publicKey.toBuffer(),
                Buffer.from(title)
            ],
            pg.program.programId
        );

        await pg.program.methods
            .createVoteCard(title, description)
            .accounts({
                voteCard: voteCardPda,
                author: pg.wallet.publicKey,
                systemProgram: web3.SystemProgram.programId,
            })
            .rpc();

        // 获取作者初始 lamports
        const authorInitialBalance = await pg.connection.getBalance(pg.wallet.publicKey);
        
        // 获取投票卡片账户的 lamports
        const voteCardBalance = await pg.connection.getBalance(voteCardPda);

        // 删除投票卡片
        await pg.program.methods
            .removeCard()
            .accounts({
                voteCard: voteCardPda,
                author: pg.wallet.publicKey,
            })
            .rpc();

        // 验证作者收到了账户的 lamports
        const authorFinalBalance = await pg.connection.getBalance(pg.wallet.publicKey);
        assert.approximately(
            authorFinalBalance,
            authorInitialBalance + voteCardBalance,
            1000000, // 允许有少量误差（因为交易费用）
            "Author should receive account lamports"
        );

        // 验证账户数据被清零
        const accountInfo = await pg.connection.getAccountInfo(voteCardPda);
        if (accountInfo) {
            const allZeros = accountInfo.data.every(byte => byte === 0);
            assert.isTrue(allZeros, "Account data should be all zeros");
            assert.equal(accountInfo.lamports, 0, "Account should have 0 lamports");
        }
    });
}); 