module caro::game {
    use sui::random::{Self, Random, RandomGenerator};
    use sui::event;
    use sui::clock::Clock;

    // ===== Constants =====
    const BOARD_SIZE: u64 = 15;
    const TOTAL_CELLS: u64 = 225;
    const WIN_LENGTH: u64 = 5;

    const EMPTY: u8 = 0;
    const PLAYER: u8 = 1;
    const AI: u8 = 2;

    const STATUS_ACTIVE: u8 = 0;
    const STATUS_PLAYER_WIN: u8 = 1;
    const STATUS_AI_WIN: u8 = 2;
    const STATUS_DRAW: u8 = 3;

    const DIFFICULTY_EASY: u8 = 0;
    const DIFFICULTY_MEDIUM: u8 = 1;
    const DIFFICULTY_HARD: u8 = 2;

    // Direction encoding: we use (dr_pos, dc_pos, dr_neg, dc_neg) as booleans
    // to avoid signed integers. Each direction has a "positive" and "negative" component.
    // Directions: 0=horizontal(+col), 1=vertical(+row), 2=diag-down-right, 3=diag-down-left

    // ===== Errors =====
    const ENotPlayer: u64 = 0;
    const EGameOver: u64 = 1;
    const EInvalidPosition: u64 = 2;
    const ECellOccupied: u64 = 3;
    const EInvalidDifficulty: u64 = 4;

    // ===== Structs =====

    /// The main game object. Shared so the player can mutate it directly.
    public struct Game has key, store {
        id: UID,
        board: vector<u8>,          // 225 cells, flat array [row * 15 + col]
        player: address,
        move_count: u64,
        status: u8,
        difficulty: u8,
        move_history: vector<u64>,  // flat index of each move in order
        created_at: u64,
    }

    /// Minted when a game ends. Serves as proof-of-play NFT.
    public struct GameResult has key, store {
        id: UID,
        game_id: ID,
        player: address,
        status: u8,
        move_count: u64,
        difficulty: u8,
        board_snapshot: vector<u8>,
    }

    // ===== Events =====
    public struct GameCreated has copy, drop {
        game_id: ID,
        player: address,
        difficulty: u8,
    }

    public struct MovePlayed has copy, drop {
        game_id: ID,
        player_move: u64,
        ai_move: u64,
        status: u8,
    }

    public struct GameEnded has copy, drop {
        game_id: ID,
        player: address,
        status: u8,
        move_count: u64,
    }

    // ===== Public Functions =====

    /// Create a new game. Shared so both player and AI logic can access it.
    public fun new_game(
        difficulty: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(difficulty <= 2, EInvalidDifficulty);

        let mut board = vector[];
        let mut i = 0u64;
        while (i < TOTAL_CELLS) {
            board.push_back(EMPTY);
            i = i + 1;
        };

        let game = Game {
            id: object::new(ctx),
            board,
            player: ctx.sender(),
            move_count: 0,
            status: STATUS_ACTIVE,
            difficulty,
            move_history: vector[],
            created_at: clock.timestamp_ms(),
        };

        event::emit(GameCreated {
            game_id: object::id(&game),
            player: ctx.sender(),
            difficulty,
        });

        transfer::share_object(game);
    }

    /// Player places a mark at (row, col), then AI responds using on-chain randomness.
    /// MUST be `entry` (not `public`) because it takes &Random - compiler enforced.
    entry fun play(
        game: &mut Game,
        row: u8,
        col: u8,
        r: &Random,
        ctx: &mut TxContext,
    ) {
        // Validate
        assert!(game.player == ctx.sender(), ENotPlayer);
        assert!(game.status == STATUS_ACTIVE, EGameOver);
        assert!((row as u64) < BOARD_SIZE && (col as u64) < BOARD_SIZE, EInvalidPosition);

        let player_idx = (row as u64) * BOARD_SIZE + (col as u64);
        assert!(game.board[player_idx] == EMPTY, ECellOccupied);

        // --- Player move ---
        *&mut game.board[player_idx] = PLAYER;
        game.move_history.push_back(player_idx);
        game.move_count = game.move_count + 1;

        // Check player win
        if (check_win(&game.board, player_idx, PLAYER)) {
            game.status = STATUS_PLAYER_WIN;
            emit_game_ended(game);
            mint_result(game, ctx);
            return
        };

        // Check draw
        if (game.move_count == TOTAL_CELLS) {
            game.status = STATUS_DRAW;
            emit_game_ended(game);
            mint_result(game, ctx);
            return
        };

        // --- AI move ---
        let mut generator = random::new_generator(r, ctx);
        let ai_idx = ai_select_move(game, &mut generator);

        *&mut game.board[ai_idx] = AI;
        game.move_history.push_back(ai_idx);
        game.move_count = game.move_count + 1;

        // Check AI win
        if (check_win(&game.board, ai_idx, AI)) {
            game.status = STATUS_AI_WIN;
            emit_game_ended(game);
            mint_result(game, ctx);
            return
        };

        // Check draw after AI move
        if (game.move_count == TOTAL_CELLS) {
            game.status = STATUS_DRAW;
            emit_game_ended(game);
            mint_result(game, ctx);
            return
        };

        // Emit move event
        event::emit(MovePlayed {
            game_id: object::id(game),
            player_move: player_idx,
            ai_move: ai_idx,
            status: game.status,
        });
    }

    /// Resign the current game.
    public fun resign(game: &mut Game, ctx: &mut TxContext) {
        assert!(game.player == ctx.sender(), ENotPlayer);
        assert!(game.status == STATUS_ACTIVE, EGameOver);
        game.status = STATUS_AI_WIN;
        emit_game_ended(game);
        mint_result(game, ctx);
    }

    /// Delete a finished game to reclaim storage rebate.
    public fun burn(game: Game) {
        assert!(game.status != STATUS_ACTIVE, EGameOver);
        let Game { id, board: _, player: _, move_count: _, status: _,
                   difficulty: _, move_history: _, created_at: _ } = game;
        object::delete(id);
    }

    // ===== AI Logic =====

    /// AI selects a move based on difficulty level.
    fun ai_select_move(game: &Game, gen: &mut RandomGenerator): u64 {
        let strategic_threshold = if (game.difficulty == DIFFICULTY_EASY) {
            0u8
        } else if (game.difficulty == DIFFICULTY_MEDIUM) {
            60u8
        } else {
            80u8
        };

        let roll = random::generate_u8_in_range(gen, 1, 100);

        if (roll <= strategic_threshold) {
            let strategic = find_strategic_move(game);
            if (strategic < TOTAL_CELLS) {
                return strategic
            };
        };

        pick_random_empty(game, gen)
    }

    /// Find a strategic move by priority:
    /// 1. Win (AI has 4 in a row) -> 2. Block (Player has 4)
    /// 3. Extend (AI has 3) -> 4. Block-3 (Player has 3)
    fun find_strategic_move(game: &Game): u64 {
        let win_move = find_threat(&game.board, AI, 4);
        if (win_move < TOTAL_CELLS) return win_move;

        let block_move = find_threat(&game.board, PLAYER, 4);
        if (block_move < TOTAL_CELLS) return block_move;

        let extend_move = find_threat(&game.board, AI, 3);
        if (extend_move < TOTAL_CELLS) return extend_move;

        let block3 = find_threat(&game.board, PLAYER, 3);
        if (block3 < TOTAL_CELLS) return block3;

        TOTAL_CELLS
    }

    /// Scan board for a threat pattern. Checks all 4 directions.
    /// Uses unsigned arithmetic with bounds checks to avoid signed integers.
    fun find_threat(board: &vector<u8>, mark: u8, count: u64): u64 {
        // For each direction, we define (row_delta, col_delta) using positive values
        // Direction 0: horizontal (0, +1)
        // Direction 1: vertical (+1, 0)
        // Direction 2: diagonal \ (+1, +1)
        // Direction 3: diagonal / (+1, -1) -- col decreases

        let mut r = 0u64;
        while (r < BOARD_SIZE) {
            let mut c = 0u64;
            while (c < BOARD_SIZE) {
                // Direction 0: horizontal (row stays, col increases)
                let result0 = check_line_threat_unsigned(board, r, c, 0, 1, false, mark, count);
                if (result0 < TOTAL_CELLS) return result0;

                // Direction 1: vertical (row increases, col stays)
                let result1 = check_line_threat_unsigned(board, r, c, 1, 0, false, mark, count);
                if (result1 < TOTAL_CELLS) return result1;

                // Direction 2: diagonal \ (row increases, col increases)
                let result2 = check_line_threat_unsigned(board, r, c, 1, 1, false, mark, count);
                if (result2 < TOTAL_CELLS) return result2;

                // Direction 3: diagonal / (row increases, col decreases)
                let result3 = check_line_threat_unsigned(board, r, c, 1, 1, true, mark, count);
                if (result3 < TOTAL_CELLS) return result3;

                c = c + 1;
            };
            r = r + 1;
        };

        TOTAL_CELLS
    }

    /// Check a line starting at (start_r, start_c) with direction (dr, dc).
    /// If `col_negative` is true, col decreases instead of increases.
    /// All arithmetic is unsigned with bounds checking.
    fun check_line_threat_unsigned(
        board: &vector<u8>,
        start_r: u64, start_c: u64,
        dr: u64, dc: u64,
        col_negative: bool,
        mark: u8, count: u64,
    ): u64 {
        let mut consecutive = 0u64;
        let mut empty_at = TOTAL_CELLS;
        let mut i = 0u64;

        while (i <= count) {
            let r = start_r + i * dr;

            // Calculate col with direction
            let c = if (col_negative) {
                // col decreases: start_c - i * dc
                if (i * dc > start_c) {
                    return TOTAL_CELLS // would underflow
                };
                start_c - i * dc
            } else {
                start_c + i * dc
            };

            // Bounds check
            if (r >= BOARD_SIZE || c >= BOARD_SIZE) {
                return TOTAL_CELLS
            };

            let idx = r * BOARD_SIZE + c;
            let cell = board[idx];

            if (cell == mark) {
                consecutive = consecutive + 1;
            } else if (cell == EMPTY && empty_at == TOTAL_CELLS) {
                empty_at = idx;
            } else {
                return TOTAL_CELLS
            };

            i = i + 1;
        };

        if (consecutive == count && empty_at < TOTAL_CELLS) {
            empty_at
        } else {
            TOTAL_CELLS
        }
    }

    /// Pick a random empty cell from the board.
    fun pick_random_empty(game: &Game, gen: &mut RandomGenerator): u64 {
        let mut empty_cells = vector[];
        let mut i = 0u64;
        while (i < TOTAL_CELLS) {
            if (game.board[i] == EMPTY) {
                empty_cells.push_back(i);
            };
            i = i + 1;
        };
        let count = empty_cells.length();
        let random_idx = random::generate_u64_in_range(gen, 0, count - 1);
        empty_cells[random_idx]
    }

    /// Check if placing `mark` at `idx` creates 5+ in a row.
    fun check_win(board: &vector<u8>, idx: u64, mark: u8): bool {
        let row = idx / BOARD_SIZE;
        let col = idx % BOARD_SIZE;

        // Check 4 directions using unsigned arithmetic
        // horizontal: (0, +1)
        count_dir(board, row, col, mark, 0, 1, false) >= WIN_LENGTH ||
        // vertical: (+1, 0)
        count_dir(board, row, col, mark, 1, 0, false) >= WIN_LENGTH ||
        // diagonal \: (+1, +1)
        count_dir(board, row, col, mark, 1, 1, false) >= WIN_LENGTH ||
        // diagonal /: (+1, -1) => forward=(+1,-1), backward=(-1,+1)
        count_dir(board, row, col, mark, 1, 1, true) >= WIN_LENGTH
    }

    /// Count consecutive `mark` in both directions along a line through (row, col).
    /// Uses unsigned arithmetic only.
    /// dr/dc are the positive step amounts. col_negative means dc subtracts in forward direction.
    fun count_dir(
        board: &vector<u8>,
        row: u64, col: u64,
        mark: u8,
        dr: u64, dc: u64,
        col_negative: bool,
    ): u64 {
        let mut total = 1u64; // count the placed cell itself

        // Count forward: row increases by dr, col changes by dc
        let mut step = 1u64;
        loop {
            let r = row + step * dr;
            let c = if (col_negative) {
                if (step * dc > col) break;
                col - step * dc
            } else {
                col + step * dc
            };
            if (r >= BOARD_SIZE || c >= BOARD_SIZE) break;
            let idx = r * BOARD_SIZE + c;
            if (board[idx] != mark) break;
            total = total + 1;
            step = step + 1;
        };

        // Count backward: row decreases by dr, col changes opposite
        step = 1;
        loop {
            // row decreases
            if (step * dr > row) break;
            let r = row - step * dr;

            // col goes opposite direction from forward
            let c = if (col_negative) {
                // forward was col--, so backward is col++
                col + step * dc
            } else {
                // forward was col++, so backward is col--
                if (step * dc > col) break;
                col - step * dc
            };
            if (r >= BOARD_SIZE || c >= BOARD_SIZE) break;
            let idx = r * BOARD_SIZE + c;
            if (board[idx] != mark) break;
            total = total + 1;
            step = step + 1;
        };

        total
    }

    // ===== Internal Helpers =====

    fun emit_game_ended(game: &Game) {
        event::emit(GameEnded {
            game_id: object::id(game),
            player: game.player,
            status: game.status,
            move_count: game.move_count,
        });
    }

    fun mint_result(game: &Game, ctx: &mut TxContext) {
        let result = GameResult {
            id: object::new(ctx),
            game_id: object::id(game),
            player: game.player,
            status: game.status,
            move_count: game.move_count,
            difficulty: game.difficulty,
            board_snapshot: game.board,
        };
        transfer::transfer(result, game.player);
    }

    // ===== View Functions =====
    public fun player(game: &Game): address { game.player }
    public fun board(game: &Game): &vector<u8> { &game.board }
    public fun status(game: &Game): u8 { game.status }
    public fun move_count(game: &Game): u64 { game.move_count }
    public fun move_history(game: &Game): &vector<u64> { &game.move_history }
    public fun difficulty(game: &Game): u8 { game.difficulty }
}
