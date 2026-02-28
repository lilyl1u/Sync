use anchor_lang::prelude::*;

declare_id!("8FgvLWN1vADqi4YnkwvzLp3sESgUtpSWL1EKoHqSQGsg");

#[program]
pub mod gambling {
    use super::*;

    /// Initialize a pool for the game economy.
    /// `buy_in_base_units` and `payout_rate_base_units_per_second` are lamports.
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        buy_in_base_units: u64,
        payout_rate_base_units_per_second: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.buy_in_base_units = buy_in_base_units;
        pool.payout_rate_base_units_per_second = payout_rate_base_units_per_second;
        pool.pool_bump = ctx.bumps.pool;
        pool.vault_bump = ctx.bumps.vault;
        pool.total_sessions_started = 0;
        pool.total_buy_ins_collected = 0;
        pool.total_payouts = 0;

        let vault = &mut ctx.accounts.vault;
        vault.reserved = 0;
        Ok(())
    }

    /// Add liquidity to the vault so extract payouts can be paid.
    pub fn fund_pool(ctx: Context<FundPool>, amount: u64) -> Result<()> {
        require!(amount > 0, GamblingError::InvalidAmount);

        let transfer_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(transfer_ctx, amount)?;
        Ok(())
    }

    /// Player pays buy-in and starts a live session.
    pub fn start_session(ctx: Context<StartSession>) -> Result<()> {
        let buy_in = ctx.accounts.pool.buy_in_base_units;
        require!(buy_in > 0, GamblingError::InvalidAmount);

        let transfer_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(transfer_ctx, buy_in)?;

        let now = Clock::get()?.unix_timestamp;
        let session = &mut ctx.accounts.session;
        session.player = ctx.accounts.player.key();
        session.pool = ctx.accounts.pool.key();
        session.started_at = now;
        session.last_claimed_at = now;
        session.buy_in_paid = buy_in;
        session.bump = ctx.bumps.session;

        let pool = &mut ctx.accounts.pool;
        pool.total_sessions_started = pool.total_sessions_started.saturating_add(1);
        pool.total_buy_ins_collected = pool.total_buy_ins_collected.saturating_add(buy_in);
        Ok(())
    }

    /// Player extracts while alive; payout scales with survival time.
    /// Session is closed after extracting.
    pub fn extract(ctx: Context<Extract>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let session = &mut ctx.accounts.session;
        let elapsed_seconds = elapsed_seconds(session.last_claimed_at, now)?;

        let winnings = elapsed_seconds
            .checked_mul(ctx.accounts.pool.payout_rate_base_units_per_second)
            .ok_or(GamblingError::MathOverflow)?;
        let total_payout = session
            .buy_in_paid
            .checked_add(winnings)
            .ok_or(GamblingError::MathOverflow)?;

        transfer_from_vault(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.player.to_account_info(),
            total_payout,
        )?;

        let pool = &mut ctx.accounts.pool;
        pool.total_payouts = pool.total_payouts.saturating_add(total_payout);
        session.last_claimed_at = now;
        Ok(())
    }

    /// Player died; session is closed and buy-in is forfeited.
    pub fn record_death(_ctx: Context<RecordDeath>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Pool::INIT_SPACE,
        seeds = [b"pool", authority.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        init,
        payer = authority,
        space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault", pool.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundPool<'info> {
    #[account(
        seeds = [b"pool", authority.key().as_ref()],
        bump = pool.pool_bump,
        has_one = authority
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump = pool.vault_bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartSession<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool.authority.as_ref()],
        bump = pool.pool_bump
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump = pool.vault_bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = player,
        space = 8 + Session::INIT_SPACE,
        seeds = [b"session", pool.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub session: Account<'info, Session>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Extract<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool.authority.as_ref()],
        bump = pool.pool_bump
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump = pool.vault_bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        close = vault,
        seeds = [b"session", pool.key().as_ref(), player.key().as_ref()],
        bump = session.bump,
        constraint = session.pool == pool.key() @ GamblingError::InvalidSessionPool,
        constraint = session.player == player.key() @ GamblingError::UnauthorizedPlayer
    )]
    pub session: Account<'info, Session>,

    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct RecordDeath<'info> {
    #[account(
        seeds = [b"pool", pool.authority.as_ref()],
        bump = pool.pool_bump
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [b"vault", pool.key().as_ref()],
        bump = pool.vault_bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        close = vault,
        seeds = [b"session", pool.key().as_ref(), player.key().as_ref()],
        bump = session.bump,
        constraint = session.pool == pool.key() @ GamblingError::InvalidSessionPool,
        constraint = session.player == player.key() @ GamblingError::UnauthorizedPlayer
    )]
    pub session: Account<'info, Session>,

    #[account(mut)]
    pub player: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub authority: Pubkey,
    pub buy_in_base_units: u64,
    pub payout_rate_base_units_per_second: u64,
    pub pool_bump: u8,
    pub vault_bump: u8,
    pub total_sessions_started: u64,
    pub total_buy_ins_collected: u64,
    pub total_payouts: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub reserved: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Session {
    pub player: Pubkey,
    pub pool: Pubkey,
    pub started_at: i64,
    pub last_claimed_at: i64,
    pub buy_in_paid: u64,
    pub bump: u8,
}

#[error_code]
pub enum GamblingError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Unauthorized player")]
    UnauthorizedPlayer,
    #[msg("Invalid session pool")]
    InvalidSessionPool,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Clock moved backwards")]
    ClockMovedBackwards,
    #[msg("Vault has insufficient balance")]
    VaultInsufficientBalance,
}

fn elapsed_seconds(from_ts: i64, to_ts: i64) -> Result<u64> {
    require!(to_ts >= from_ts, GamblingError::ClockMovedBackwards);
    Ok((to_ts - from_ts) as u64)
}

fn transfer_from_vault(vault: &AccountInfo, destination: &AccountInfo, amount: u64) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    let rent = Rent::get()?;
    let minimum_vault_balance = rent.minimum_balance(vault.data_len());
    let current_vault_balance = vault.lamports();

    require!(
        current_vault_balance >= minimum_vault_balance.saturating_add(amount),
        GamblingError::VaultInsufficientBalance
    );

    **vault.try_borrow_mut_lamports()? = current_vault_balance.saturating_sub(amount);
    **destination.try_borrow_mut_lamports()? = destination.lamports().saturating_add(amount);
    Ok(())
}
