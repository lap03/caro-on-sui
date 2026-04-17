module caro::leaderboard {
    use sui::table::{Self, Table};
    use sui::event;

    // ===== Errors =====
    const EPlayerNotFound: u64 = 0;

    /// Global leaderboard object (shared).
    public struct Leaderboard has key {
        id: UID,
        stats: Table<address, PlayerStats>,
        top_players: vector<PlayerEntry>, // top 10 sorted by wins
    }

    public struct PlayerStats has store, copy, drop {
        wins: u64,
        losses: u64,
        draws: u64,
        total_games: u64,
        win_streak: u64,
        best_streak: u64,
    }

    public struct PlayerEntry has store, copy, drop {
        player: address,
        wins: u64,
    }

    // ===== Events =====
    public struct StatsUpdated has copy, drop {
        player: address,
        wins: u64,
        losses: u64,
        total_games: u64,
    }

    // ===== Public Functions =====

    /// Initialize the leaderboard (called once at deploy via init or manually).
    public fun create(ctx: &mut TxContext) {
        let leaderboard = Leaderboard {
            id: object::new(ctx),
            stats: table::new(ctx),
            top_players: vector[],
        };
        transfer::share_object(leaderboard);
    }

    /// Record a game result. Called after a game ends.
    public fun record_result(
        board: &mut Leaderboard,
        player: address,
        won: bool,
        draw: bool,
    ) {
        if (!table::contains(&board.stats, player)) {
            table::add(&mut board.stats, player, PlayerStats {
                wins: 0, losses: 0, draws: 0,
                total_games: 0, win_streak: 0, best_streak: 0,
            });
        };

        let stats = table::borrow_mut(&mut board.stats, player);
        stats.total_games = stats.total_games + 1;

        if (won) {
            stats.wins = stats.wins + 1;
            stats.win_streak = stats.win_streak + 1;
            if (stats.win_streak > stats.best_streak) {
                stats.best_streak = stats.win_streak;
            };
        } else if (draw) {
            stats.draws = stats.draws + 1;
            stats.win_streak = 0;
        } else {
            stats.losses = stats.losses + 1;
            stats.win_streak = 0;
        };

        // Update top players list
        update_top_players(&mut board.top_players, player, stats.wins);

        // Emit stats updated event
        event::emit(StatsUpdated {
            player,
            wins: stats.wins,
            losses: stats.losses,
            total_games: stats.total_games,
        });
    }

    /// Update the top 10 players list. Inserts or updates the player's position.
    fun update_top_players(top: &mut vector<PlayerEntry>, player: address, wins: u64) {
        let len = top.length();

        // Remove existing entry for this player if present
        let mut i = 0u64;
        while (i < len) {
            if (top[i].player == player) {
                top.remove(i);
                break
            };
            i = i + 1;
        };

        // Insert in sorted position (descending by wins)
        let new_entry = PlayerEntry { player, wins };
        let new_len = top.length();
        let mut insert_at = new_len;

        i = 0;
        while (i < new_len) {
            if (wins > top[i].wins) {
                insert_at = i;
                break
            };
            i = i + 1;
        };

        if (insert_at <= 9) {
            top.insert(new_entry, insert_at);
            // Keep only top 10
            while (top.length() > 10) {
                top.pop_back();
            };
        };
    }

    // ===== View Functions =====
    public fun get_stats(board: &Leaderboard, player: address): &PlayerStats {
        table::borrow(&board.stats, player)
    }

    public fun has_stats(board: &Leaderboard, player: address): bool {
        table::contains(&board.stats, player)
    }

    public fun top_players(board: &Leaderboard): &vector<PlayerEntry> {
        &board.top_players
    }

    public fun stats_wins(stats: &PlayerStats): u64 { stats.wins }
    public fun stats_losses(stats: &PlayerStats): u64 { stats.losses }
    public fun stats_draws(stats: &PlayerStats): u64 { stats.draws }
    public fun stats_total_games(stats: &PlayerStats): u64 { stats.total_games }
    public fun stats_win_streak(stats: &PlayerStats): u64 { stats.win_streak }
    public fun stats_best_streak(stats: &PlayerStats): u64 { stats.best_streak }

    public fun entry_player(entry: &PlayerEntry): address { entry.player }
    public fun entry_wins(entry: &PlayerEntry): u64 { entry.wins }
}
