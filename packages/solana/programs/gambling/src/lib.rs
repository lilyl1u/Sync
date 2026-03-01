use anchor_lang::prelude::*;

declare_id!("FAdRVYXxpjaacwU1MNcNf9yayhkCNJdyRyoJNcMKbrnB");

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

    /// Player pays buy-in and starts a live session (uses pool defaults).
    pub fn start_session(ctx: Context<StartSession>) -> Result<()> {
        let pool = &ctx.accounts.pool;
        let buy_in = pool.buy_in_base_units;
        let rate = pool.payout_rate_base_units_per_second;
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
        session.payout_rate = rate;
        session.bump = ctx.bumps.session;

        let pool = &mut ctx.accounts.pool;
        pool.total_sessions_started = pool.total_sessions_started.saturating_add(1);
        pool.total_buy_ins_collected = pool.total_buy_ins_collected.saturating_add(buy_in);
        Ok(())
    }

    /// Player pays a custom buy-in amount (lamports) with a custom payout rate
    /// and starts a live session. Used for variable bets (duels + solo).
    pub fn start_session_with_amount(
        ctx: Context<StartSession>,
        amount: u64,
        payout_rate: u64,
    ) -> Result<()> {
        require!(amount > 0, GamblingError::InvalidAmount);
        require!(payout_rate > 0, GamblingError::InvalidAmount);

        let transfer_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(transfer_ctx, amount)?;

        let now = Clock::get()?.unix_timestamp;
        let session = &mut ctx.accounts.session;
        session.player = ctx.accounts.player.key();
        session.pool = ctx.accounts.pool.key();
        session.started_at = now;
        session.last_claimed_at = now;
        session.buy_in_paid = amount;
        session.payout_rate = payout_rate;
        session.bump = ctx.bumps.session;

        let pool = &mut ctx.accounts.pool;
        pool.total_sessions_started = pool.total_sessions_started.saturating_add(1);
        pool.total_buy_ins_collected = pool.total_buy_ins_collected.saturating_add(amount);
        Ok(())
    }

    /// Player extracts while alive. Client sends the exact amount (lamports) to pull from the vault.
    /// Program validates: 0 < amount <= max_payout (buy_in + max_elapsed * session_rate).
    pub fn extract(ctx: Context<Extract>, amount: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let session = &mut ctx.accounts.session;

        require!(amount > 0, GamblingError::InvalidAmount);

        let rate = if session.payout_rate > 0 {
            session.payout_rate
        } else {
            ctx.accounts.pool.payout_rate_base_units_per_second
        };

        let max_elapsed = elapsed_seconds(session.last_claimed_at, now)?;
        let max_winnings = max_elapsed
            .checked_mul(rate)
            .ok_or(GamblingError::MathOverflow)?;
        let max_payout = session
            .buy_in_paid
            .checked_add(max_winnings)
            .ok_or(GamblingError::MathOverflow)?;

        require!(amount <= max_payout, GamblingError::PayoutExceedsAllowed);

        transfer_from_vault(
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.player.to_account_info(),
            amount,
        )?;

        let pool = &mut ctx.accounts.pool;
        pool.total_payouts = pool.total_payouts.saturating_add(amount);
        session.last_claimed_at = now;
        Ok(())
    }


    /// Player died; session is closed and buy-in is forfeited.
    pub fn record_death(_ctx: Context<RecordDeath>) -> Result<()> {
        Ok(())
    }

    /// Close a session PDA that can't be deserialized (layout migration).
    /// Drains lamports to vault and zeroes the account data.
    pub fn close_legacy_session(ctx: Context<CloseLegacySession>) -> Result<()> {
        let session_info = &ctx.accounts.session;
        let vault_info = &ctx.accounts.vault;

        let lamports = session_info.lamports();
        **session_info.to_account_info().try_borrow_mut_lamports()? = 0;
        **vault_info.to_account_info().try_borrow_mut_lamports()? = vault_info
            .to_account_info()
            .lamports()
            .checked_add(lamports)
            .ok_or(GamblingError::MathOverflow)?;

        session_info.to_account_info().realloc(0, false)?;
        session_info
            .to_account_info()
            .assign(&anchor_lang::solana_program::system_program::ID);

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

#[derive(Accounts)]
pub struct CloseLegacySession<'info> {
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

    /// CHECK: Legacy session PDA — verified by seeds constraint, not deserialized.
    #[account(
        mut,
        seeds = [b"session", pool.key().as_ref(), player.key().as_ref()],
        bump,
    )]
    pub session: UncheckedAccount<'info>,

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
    pub payout_rate: u64,
    pub bump: u8,
}

#[error_code]
pub enum GamblingError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Payout exceeds allowed (buy-in + max elapsed * rate)")]
    PayoutExceedsAllowed,
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
