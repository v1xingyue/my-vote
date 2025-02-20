use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("your_program_id");

#[program]
pub mod vote_program {
    use super::*;

    // 添加程序初始化指令
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let program_admin = &mut ctx.accounts.program_admin;
        program_admin.admin = ctx.accounts.admin.key();
        program_admin.is_initialized = true;
        program_admin.create_vote_fee = 10_000_000; // 0.01 SOL
        program_admin.cast_vote_fee = 1_000_000; // 0.001 SOL
        program_admin.fee_receiver = ctx.accounts.admin.key(); // 默认费用接收者为管理员
        program_admin.admin_fee_percent = 10; // 默认10%分成给管理员

        msg!(
            "Program initialized with admin: {}, fee receiver: {}",
            ctx.accounts.admin.key(),
            ctx.accounts.admin.key()
        );
        Ok(())
    }

    // 创建新的投票卡片
    pub fn create_vote_card(
        ctx: Context<CreateVoteCard>,
        title: String,
        description: String,
    ) -> Result<()> {
        // 检查程序是否已初始化
        require!(
            ctx.accounts.program_admin.is_initialized(),
            VoteError::ProgramNotInitialized
        );

        let vote_card = &mut ctx.accounts.vote_card;
        let author = &ctx.accounts.author;
        let system_program = &ctx.accounts.system_program;
        let program_admin = &ctx.accounts.program_admin;

        // 检查标题长度
        require!(title.len() <= 50, VoteError::TitleTooLong);
        // 检查描述长度
        require!(description.len() <= 280, VoteError::DescriptionTooLong);

        let fee_amount = program_admin.create_vote_fee;
        let admin_fee = (fee_amount as u128 * program_admin.admin_fee_percent as u128 / 100) as u64;
        let vote_card_fee = fee_amount - admin_fee;

        // 转账给费用接收者
        let admin_fee_ix =
            system_instruction::transfer(&author.key(), &program_admin.fee_receiver, admin_fee);

        // 转账给投票卡片账户
        let vote_card_fee_ix =
            system_instruction::transfer(&author.key(), &vote_card.key(), vote_card_fee);

        invoke(
            &admin_fee_ix,
            &[
                author.to_account_info(),
                ctx.accounts.fee_receiver.to_account_info(),
                system_program.to_account_info(),
            ],
        )?;

        invoke(
            &vote_card_fee_ix,
            &[
                author.to_account_info(),
                vote_card.to_account_info(),
                system_program.to_account_info(),
            ],
        )?;

        vote_card.title = title;
        vote_card.description = description;
        vote_card.author = author.key();
        vote_card.create_time = Clock::get()?.unix_timestamp;
        vote_card.vote_count = 0;
        vote_card.voters = Vec::new();

        Ok(())
    }

    // 投票功能
    pub fn cast_vote(ctx: Context<CastVote>) -> Result<()> {
        // 检查程序是否已初始化
        require!(
            ctx.accounts.program_admin.is_initialized(),
            VoteError::ProgramNotInitialized
        );

        let vote_card = &mut ctx.accounts.vote_card;
        let voter = &ctx.accounts.voter;
        let system_program = &ctx.accounts.system_program;
        let program_admin = &ctx.accounts.program_admin;

        // 检查是否已经投票
        require!(!vote_card.has_voted(voter.key()), VoteError::AlreadyVoted);

        // 使用配置的费用
        let fee_amount = program_admin.cast_vote_fee;
        let fee_instruction =
            system_instruction::transfer(&voter.key(), &vote_card.key(), fee_amount);

        invoke(
            &fee_instruction,
            &[
                voter.to_account_info(),
                vote_card.to_account_info(),
                system_program.to_account_info(),
            ],
        )?;

        vote_card.vote_count += 1;
        vote_card.voters.push(voter.key());
        Ok(())
    }

    // 取消投票功能
    pub fn unvote(ctx: Context<Unvote>) -> Result<()> {
        // 检查程序是否已初始化
        require!(
            ctx.accounts.program_admin.is_initialized(),
            VoteError::ProgramNotInitialized
        );

        let vote_card = &mut ctx.accounts.vote_card;
        let voter = &ctx.accounts.voter;
        let program_admin = &ctx.accounts.program_admin;

        // 检查是否已经投票
        require!(vote_card.has_voted(voter.key()), VoteError::HasNotVoted);

        // 返还投票费用
        let refund_amount = program_admin.cast_vote_fee;

        // 从投票账户转回到投票者账户
        **vote_card.to_account_info().try_borrow_mut_lamports()? = vote_card
            .to_account_info()
            .lamports()
            .checked_sub(refund_amount)
            .ok_or(ProgramError::InsufficientFunds)?;

        **voter.to_account_info().try_borrow_mut_lamports()? = voter
            .to_account_info()
            .lamports()
            .checked_add(refund_amount)
            .ok_or(ProgramError::InsufficientFunds)?;

        vote_card.vote_count = vote_card.vote_count.checked_sub(1).unwrap();
        vote_card.remove_voter(voter.key());
        Ok(())
    }

    // 添加管理员删除卡片功能
    pub fn admin_remove_card(ctx: Context<AdminRemoveCard>) -> Result<()> {
        // 检查程序是否已初始化
        require!(
            ctx.accounts.program_admin.is_initialized(),
            VoteError::ProgramNotInitialized
        );

        let admin = &ctx.accounts.admin;

        // 验证管理员身份
        require!(
            admin.key() == ctx.accounts.program_admin.key(),
            VoteError::UnauthorizedAdmin
        );

        // Anchor的close constraint会自动处理账户关闭和lamports转移到作者账户
        Ok(())
    }

    // 转移管理员权限
    pub fn transfer_admin(ctx: Context<TransferAdmin>) -> Result<()> {
        // 检查程序是否已初始化
        require!(
            ctx.accounts.program_admin.is_initialized(),
            VoteError::ProgramNotInitialized
        );

        let program_admin = &mut ctx.accounts.program_admin;
        let current_admin = &ctx.accounts.current_admin;
        let new_admin = &ctx.accounts.new_admin;

        // 验证当前管理员
        require!(
            current_admin.key() == program_admin.admin,
            VoteError::UnauthorizedAdmin
        );

        // 更新管理员
        program_admin.admin = new_admin.key();

        msg!(
            "Admin transferred from {} to {}",
            current_admin.key(),
            new_admin.key()
        );

        Ok(())
    }

    // 添加配置参数结构体
    #[derive(AnchorSerialize, AnchorDeserialize)]
    pub struct FeeConfig {
        pub create_vote_fee: Option<u64>,  // 创建投票费用
        pub cast_vote_fee: Option<u64>,    // 投票费用
        pub fee_receiver: Option<Pubkey>,  // 费用接收账户
        pub admin_fee_percent: Option<u8>, // 管理员分成比例
    }

    // 统一的配置更新方法
    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        config: FeeConfig,
    ) -> Result<()> {
        // 检查程序是否已初始化
        require!(
            ctx.accounts.program_admin.is_initialized(),
            VoteError::ProgramNotInitialized
        );

        let program_admin = &mut ctx.accounts.program_admin;
        let admin = &ctx.accounts.admin;

        // 验证管理员身份
        require!(
            admin.key() == program_admin.admin,
            VoteError::UnauthorizedAdmin
        );

        // 更新创建投票费用
        if let Some(new_create_fee) = config.create_vote_fee {
            program_admin.create_vote_fee = new_create_fee;
            msg!("Create vote fee updated to: {} lamports", new_create_fee);
        }

        // 更新投票费用
        if let Some(new_cast_fee) = config.cast_vote_fee {
            program_admin.cast_vote_fee = new_cast_fee;
            msg!("Cast vote fee updated to: {} lamports", new_cast_fee);
        }

        // 更新费用接收账户
        if let Some(new_receiver) = config.fee_receiver {
            program_admin.fee_receiver = new_receiver;
            msg!("Fee receiver updated to: {}", new_receiver);
        }

        // 更新管理员分成比例
        if let Some(new_percent) = config.admin_fee_percent {
            require!(new_percent <= 100, VoteError::InvalidFeePercent);
            program_admin.admin_fee_percent = new_percent;
            msg!("Admin fee percent updated to: {}%", new_percent);
        }

        Ok(())
    }

    // 更新Context结构
    #[derive(Accounts)]
    pub struct UpdateProgramConfig<'info> {
        #[account(mut)]
        pub program_admin: Account<'info, ProgramAdmin>,

        #[account(mut)]
        pub admin: Signer<'info>,
    }
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct CreateVoteCard<'info> {
    #[account(
        init,
        payer = author,
        space = VoteCard::LEN,
        seeds = [b"vote-card", author.key().as_ref(), title.as_bytes()],
        bump
    )]
    pub vote_card: Account<'info, VoteCard>,

    #[account(mut)]
    pub author: Signer<'info>,
    pub system_program: Program<'info, System>,

    /// 程序管理员账户，用于验证程序初始化状态
    #[account(
        seeds = [b"program-admin"],
        bump
    )]
    pub program_admin: Account<'info, ProgramAdmin>,

    /// 费用接收账户
    #[account(mut)]
    pub fee_receiver: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub vote_card: Account<'info, VoteCard>,
    #[account(mut)]
    pub voter: Signer<'info>,
    pub system_program: Program<'info, System>,

    #[account(
        seeds = [b"program-admin"],
        bump
    )]
    pub program_admin: Account<'info, ProgramAdmin>,
}

#[derive(Accounts)]
pub struct Unvote<'info> {
    #[account(mut)]
    pub vote_card: Account<'info, VoteCard>,
    #[account(mut)]
    pub voter: Signer<'info>,
    pub system_program: Program<'info, System>,

    #[account(
        seeds = [b"program-admin"],
        bump
    )]
    pub program_admin: Account<'info, ProgramAdmin>,
}

#[derive(Accounts)]
pub struct AdminRemoveCard<'info> {
    #[account(
        mut,
        close = author // 关闭账户时资金返回给原作者
    )]
    pub vote_card: Account<'info, VoteCard>,

    /// 原作者账户，用于接收返还的资金
    #[account(mut)]
    pub author: AccountInfo<'info>,

    /// 管理员账户，必须签名
    #[account(mut)]
    pub admin: Signer<'info>,

    /// 程序管理员账户，用于验证管理员身份
    #[account(
        seeds = [b"program-admin"],
        bump
    )]
    pub program_admin: Account<'info, ProgramAdmin>,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = ProgramAdmin::LEN,
        seeds = [b"program-admin"],
        bump
    )]
    pub program_admin: Account<'info, ProgramAdmin>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferAdmin<'info> {
    #[account(mut)]
    pub program_admin: Account<'info, ProgramAdmin>,

    /// 当前管理员，必须签名
    #[account(mut)]
    pub current_admin: Signer<'info>,

    /// 新管理员账户
    pub new_admin: AccountInfo<'info>,
}

#[account]
pub struct VoteCard {
    pub title: String,       // 标题
    pub description: String, // 描述
    pub author: Pubkey,      // 作者
    pub create_time: i64,    // 创建时间
    pub vote_count: u64,     // 投票数
    pub voters: Vec<Pubkey>, // 投票者列表
}

impl VoteCard {
    const LEN: usize = 8 +    // discriminator
        4 + 50 +              // title (String)
        4 + 280 +             // description (String)
        32 +                  // author (Pubkey)
        8 +                   // create_time (i64)
        8 +                   // vote_count (u64)
        4 + 32 * 50 +        // voters (Vec<Pubkey>) 最多支持50个投票者
        8; // 添加额外空间用于存储 lamports

    // 检查用户是否已经投票
    pub fn has_voted(&self, voter: Pubkey) -> bool {
        self.voters.contains(&voter)
    }

    // 移除投票者
    pub fn remove_voter(&mut self, voter: Pubkey) {
        if let Some(index) = self.voters.iter().position(|x| *x == voter) {
            self.voters.remove(index);
        }
    }
}

// 添加管理员账户结构
#[account]
pub struct ProgramAdmin {
    pub admin: Pubkey,
    pub is_initialized: bool,
    pub create_vote_fee: u64,  // lamports
    pub cast_vote_fee: u64,    // lamports
    pub fee_receiver: Pubkey,  // 费用接收账户
    pub admin_fee_percent: u8, // 管理员分成比例 (0-100)
}

impl ProgramAdmin {
    const LEN: usize = 8 +    // discriminator
        32 +                  // admin pubkey
        1 +                   // is_initialized bool
        8 +                   // create_vote_fee
        8 +                   // cast_vote_fee
        32 +                  // fee_receiver
        1; // admin_fee_percent

    pub fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

#[error_code]
pub enum VoteError {
    #[msg("标题长度不能超过50个字符")]
    TitleTooLong,
    #[msg("描述长度不能超过280个字符")]
    DescriptionTooLong,
    #[msg("您已经投过票了")]
    AlreadyVoted,
    #[msg("您还没有投票")]
    HasNotVoted,
    #[msg("只有作者可以执行此操作")]
    UnauthorizedOperation,
    #[msg("余额不足以支付创建费用")]
    InsufficientBalance,
    #[msg("退款失败")]
    RefundFailed,
    #[msg("未授权的管理员操作")]
    UnauthorizedAdmin,
    #[msg("管理员转移失败")]
    AdminTransferFailed,
    #[msg("程序尚未初始化")]
    ProgramNotInitialized,
    #[msg("无效的费率百分比")]
    InvalidFeePercent,
}
