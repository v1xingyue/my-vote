use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("your_program_id");

#[program]
pub mod vote_program {
    use super::*;

    // 创建新的投票卡片
    pub fn create_vote_card(
        ctx: Context<CreateVoteCard>,
        title: String,
        description: String,
    ) -> Result<()> {
        let vote_card = &mut ctx.accounts.vote_card;
        let author = &ctx.accounts.author;
        let system_program = &ctx.accounts.system_program;

        // 检查标题长度
        require!(title.len() <= 50, VoteError::TitleTooLong);
        // 检查描述长度
        require!(description.len() <= 280, VoteError::DescriptionTooLong);

        // 收取 0.01 SOL 费用
        let fee_amount = 10_000_000; // 0.01 SOL = 10,000,000 Lamports
        let fee_instruction = system_instruction::transfer(
            &author.key(),
            &vote_card.key(), // 费用转入投票账户
            fee_amount,
        );

        invoke(
            &fee_instruction,
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
        let vote_card = &mut ctx.accounts.vote_card;
        let voter = &ctx.accounts.voter;
        let system_program = &ctx.accounts.system_program;

        // 检查是否已经投票
        require!(!vote_card.has_voted(voter.key()), VoteError::AlreadyVoted);

        // 收取 0.001 SOL 费用
        let fee_amount = 1_000_000; // 0.001 SOL = 1,000,000 Lamports
        let fee_instruction = system_instruction::transfer(
            &voter.key(),
            &vote_card.key(), // 费用转入投票账户
            fee_amount,
        );

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
        let vote_card = &mut ctx.accounts.vote_card;
        let voter = &ctx.accounts.voter;

        // 检查是否已经投票
        require!(vote_card.has_voted(voter.key()), VoteError::HasNotVoted);

        // 返还 0.001 SOL
        let refund_amount = 1_000_000; // 0.001 SOL = 1,000,000 Lamports

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

    // 删除投票卡片功能
    pub fn remove_card(_ctx: Context<RemoveCard>) -> Result<()> {
        // Anchor 的 close constraint 会自动处理账户关闭和 lamports 转移
        Ok(())
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
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub vote_card: Account<'info, VoteCard>,
    #[account(mut)]
    pub voter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unvote<'info> {
    #[account(mut)]
    pub vote_card: Account<'info, VoteCard>,
    #[account(mut)]
    pub voter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveCard<'info> {
    #[account(
        mut,
        has_one = author,
        close = author  // Anchor 的 close constraint
    )]
    pub vote_card: Account<'info, VoteCard>,
    #[account(mut)]
    pub author: Signer<'info>,
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
}
