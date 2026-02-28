use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod gambling {
    use super::*;

    /// Initialize a new gambling pool
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        min_bet: u64,
        max_bet: u64,
        house_edge: u16, // in basis points (100 = 1%)
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.min_bet = min_bet;
        pool.max_bet = max_bet;
        pool.house_edge = house_edge;
        pool.total_wagered = 0;
        pool.total_paid_out = 0;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    /// Place a bet based on predicted survival time
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        bet_amount: u64,
        predicted_time_alive: u64, // in milliseconds
    ) -> Result<()> {
        let pool = &ctx.accounts.pool;

        require!(
            bet_amount >= pool.min_bet && bet_amount <= pool.max_bet,
            GamblingError::InvalidBetAmount
        );

        let bet = &mut ctx.accounts.bet;
        bet.player = ctx.accounts.player.key();
        bet.pool = pool.key();
        bet.amount = bet_amount;
        bet.predicted_time_alive = predicted_time_alive;
        bet.actual_time_alive = 0;
        bet.settled = false;
        bet.won = false;
        bet.payout = 0;
        bet.timestamp = Clock::get()?.unix_timestamp;
        bet.bump = ctx.bumps.bet;

        // Transfer bet amount from player to pool
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.pool_vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, bet_amount)?;

        Ok(())
    }

    /// Settle a bet after game completion
    pub fn settle_bet(
        ctx: Context<SettleBet>,
        actual_time_alive: u64,
    ) -> Result<()> {
        let bet = &mut ctx.accounts.bet;

        require!(!bet.settled, GamblingError::BetAlreadySettled);
        require!(bet.player == ctx.accounts.player.key(), GamblingError::UnauthorizedPlayer);

        bet.actual_time_alive = actual_time_alive;
        bet.settled = true;

        // Calculate payout based on accuracy
        let prediction = bet.predicted_time_alive as i64;
        let actual = actual_time_alive as i64;
        let diff = (prediction - actual).abs() as u64;

        // Accuracy-based payout: closer predictions get higher multipliers
        // Perfect prediction (within 100ms): 10x
        // Within 500ms: 5x
        // Within 1000ms: 2x
        // Beyond 2000ms: lose bet

        let pool = &ctx.accounts.pool;
        let multiplier = if diff <= 100 {
            10000 // 10x
        } else if diff <= 500 {
            5000 // 5x
        } else if diff <= 1000 {
            2000 // 2x
        } else if diff <= 2000 {
            1000 // 1x (return bet)
        } else {
            0 // lose
        };

        if multiplier > 0 {
            bet.won = true;
            let gross_payout = (bet.amount as u128 * multiplier as u128 / 1000) as u64;
            let house_fee = (gross_payout as u128 * pool.house_edge as u128 / 10000) as u64;
            bet.payout = gross_payout.saturating_sub(house_fee);

            // Transfer payout from pool to player
            let pool_key = pool.key();
            let seeds = &[
                b"pool".as_ref(),
                pool_key.as_ref(),
                &[pool.bump],
            ];
            let signer = &[&seeds[..]];

            let cpi_context = CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.pool_vault.to_account_info(),
                    to: ctx.accounts.player.to_account_info(),
                },
                signer,
            );
            anchor_lang::system_program::transfer(cpi_context, bet.payout)?;
        }

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

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: PDA vault for holding pool funds
    #[account(
        seeds = [b"pool", pool.key().as_ref()],
        bump
    )]
    pub pool_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(
        init,
        payer = player,
        space = 8 + Bet::INIT_SPACE,
        seeds = [b"bet", pool.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, Bet>,

    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub player: Signer<'info>,

    /// CHECK: PDA vault for holding pool funds
    #[account(
        mut,
        seeds = [b"pool", pool.key().as_ref()],
        bump
    )]
    pub pool_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleBet<'info> {
    #[account(mut)]
    pub bet: Account<'info, Bet>,

    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub player: Signer<'info>,

    /// CHECK: PDA vault for holding pool funds
    #[account(
        mut,
        seeds = [b"pool", pool.key().as_ref()],
        bump
    )]
    pub pool_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub authority: Pubkey,
    pub min_bet: u64,
    pub max_bet: u64,
    pub house_edge: u16,
    pub total_wagered: u64,
    pub total_paid_out: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Bet {
    pub player: Pubkey,
    pub pool: Pubkey,
    pub amount: u64,
    pub predicted_time_alive: u64,
    pub actual_time_alive: u64,
    pub settled: bool,
    pub won: bool,
    pub payout: u64,
    pub timestamp: i64,
    pub bump: u8,
}

#[error_code]
pub enum GamblingError {
    #[msg("Invalid bet amount")]
    InvalidBetAmount,
    #[msg("Bet already settled")]
    BetAlreadySettled,
    #[msg("Unauthorized player")]
    UnauthorizedPlayer,
}
