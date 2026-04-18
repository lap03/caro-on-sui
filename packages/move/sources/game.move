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

    // ===== AI Scoring Constants =====
    const CENTER_IDX: u64 = 112;        // (7,7) on 15x15
    const CANDIDATE_RADIUS: u64 = 2;    // only score empty cells within this Chebyshev distance of a stone

    // Pattern scores (offensive, from the placing side's perspective).
    // Gaps between tiers are large so a fork (two open-3s) outscores a single closed-4,
    // and a single open-4 outscores any fork of open-3s.
    const SCORE_FIVE: u64     = 1_000_000;
    const SCORE_OPEN_4: u64   =   100_000;
    const SCORE_CLOSED_4: u64 =    10_000;
    const SCORE_OPEN_3: u64   =     5_000;
    const SCORE_CLOSED_3: u64 =       500;
    const SCORE_OPEN_2: u64   =       100;
    const SCORE_CLOSED_2: u64 =        10;

    // Defensive weight: 9/10 — blocking a pattern is worth 90% of creating the same pattern.
    // Keeps the AI offensive on equal terms, but still forces it to block when offense is weak.
    const DEFENSE_WEIGHT_NUM: u64 = 9;
    const DEFENSE_WEIGHT_DEN: u64 = 10;

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

    /// Emitted when a player uploads the replay of a finished game to Walrus and
    /// anchors the blob id on-chain. `blob_id` is the UTF-8 bytes of the Walrus
    /// blob id string (e.g. "kE7aH..."). All the metadata needed to render a
    /// replay list entry is inlined so the frontend can rely on events alone.
    public struct ReplaySaved has copy, drop {
        game_id: ID,
        player: address,
        blob_id: vector<u8>,
        move_count: u64,
        difficulty: u8,
        status: u8,
        timestamp_ms: u64,
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

    /// Anchor a Walrus replay blob id on-chain.
    ///
    /// The caller must pass `&GameResult` — because `GameResult` is an owned object
    /// (minted + transferred to the player), passing it to a move call is already
    /// proof of ownership. No mutation happens: we simply emit `ReplaySaved` with
    /// all metadata inlined so replay lists can be built from events alone.
    public fun attach_replay(
        result: &GameResult,
        blob_id: vector<u8>,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(result.player == ctx.sender(), ENotPlayer);
        event::emit(ReplaySaved {
            game_id: result.game_id,
            player: result.player,
            blob_id,
            move_count: result.move_count,
            difficulty: result.difficulty,
            status: result.status,
            timestamp_ms: clock.timestamp_ms(),
        });
    }

    // ===== AI Logic =====

    /// AI selects a move using pattern-based scoring.
    ///
    /// All tiers never miss a mate-in-1 or a forced block (the two `find_threat` calls
    /// at the top). Difficulty then varies how often the AI plays the scored "best" move
    /// vs. a random move near the action.
    fun ai_select_move(game: &Game, gen: &mut RandomGenerator): u64 {
        // Opening book: center gives the best tempo on an empty board.
        if (game.move_count == 0) return CENTER_IDX;

        // Hard safety net: complete a 5 if available, then block the opponent's 5.
        // These are cheap (2 × find_threat) and guarantee the AI never whiffs on a mate-in-1.
        let win = find_threat(&game.board, AI, 4);
        if (win < TOTAL_CELLS) return win;
        let must_block = find_threat(&game.board, PLAYER, 4);
        if (must_block < TOTAL_CELLS) return must_block;

        let roll = random::generate_u8_in_range(gen, 1, 100);

        if (game.difficulty == DIFFICULTY_EASY) {
            if (roll <= 30) {
                best_move(game, gen)
            } else {
                pick_random_near(game, gen)
            }
        } else if (game.difficulty == DIFFICULTY_MEDIUM) {
            if (roll <= 75) {
                best_move(game, gen)
            } else {
                pick_random_near(game, gen)
            }
        } else {
            best_move(game, gen)
        }
    }

    /// Build the list of candidate empty cells once, then iterate it. This is
    /// dramatically cheaper than calling `is_candidate` inside a 225-cell loop
    /// (which would cost 225 * R² reads ≈ 5,625 for R=2). Instead we walk each
    /// existing stone and OR-mark its R-neighborhood as candidate. With N stones
    /// on the board, cost is O(N * R² + 225) — ~261 reads for N=4 vs 5,625.
    ///
    /// This is the hot-path optimization that keeps AI gas within Enoki's
    /// sponsored-tx budget even on boards with many stones.
    fun gather_candidates(board: &vector<u8>): vector<u64> {
        let mut is_cand = vector[];
        let mut i = 0u64;
        while (i < TOTAL_CELLS) { is_cand.push_back(false); i = i + 1; };

        let mut idx = 0u64;
        while (idx < TOTAL_CELLS) {
            if (board[idx] != EMPTY) {
                let r = idx / BOARD_SIZE;
                let c = idx % BOARD_SIZE;
                let r_start = if (r >= CANDIDATE_RADIUS) r - CANDIDATE_RADIUS else 0;
                let r_end = {
                    let t = r + CANDIDATE_RADIUS;
                    if (t >= BOARD_SIZE) BOARD_SIZE - 1 else t
                };
                let c_start = if (c >= CANDIDATE_RADIUS) c - CANDIDATE_RADIUS else 0;
                let c_end = {
                    let t = c + CANDIDATE_RADIUS;
                    if (t >= BOARD_SIZE) BOARD_SIZE - 1 else t
                };
                let mut rr = r_start;
                while (rr <= r_end) {
                    let mut cc = c_start;
                    while (cc <= c_end) {
                        *&mut is_cand[rr * BOARD_SIZE + cc] = true;
                        cc = cc + 1;
                    };
                    rr = rr + 1;
                };
            };
            idx = idx + 1;
        };

        let mut result = vector[];
        i = 0;
        while (i < TOTAL_CELLS) {
            if (is_cand[i] && board[i] == EMPTY) { result.push_back(i); };
            i = i + 1;
        };
        result
    }

    /// Evaluate every candidate empty cell and return the highest-scoring one.
    /// Candidates are restricted to cells within CANDIDATE_RADIUS of an existing stone
    /// — empty corners of a 15x15 board are irrelevant and wildly expand the search.
    ///
    /// Ties are broken with on-chain randomness so repeat games aren't deterministic.
    /// Early-exits if it finds a placement that creates an open-4 or a direct
    /// five — those are strictly dominant so no reason to keep scanning.
    fun best_move(game: &Game, gen: &mut RandomGenerator): u64 {
        let board = &game.board;
        let candidates = gather_candidates(board);
        if (candidates.is_empty()) {
            return pick_random_empty(game, gen)
        };

        let mut best_score = 0u64;
        let mut ties = vector[];
        let mut i = 0u64;
        let n_cands = candidates.length();
        while (i < n_cands) {
            let idx = candidates[i];
            let offense = score_placement(board, idx, AI);

            // Hot-path early exit: any placement with offense >= open-four is a
            // mate-in-1-or-2 and we don't need to compute defense or keep going.
            if (offense >= SCORE_OPEN_4) {
                return idx
            };

            let defense_raw = score_placement(board, idx, PLAYER);
            let defense = defense_raw * DEFENSE_WEIGHT_NUM / DEFENSE_WEIGHT_DEN;
            let score = offense + defense;

            if (score > best_score) {
                best_score = score;
                ties = vector[idx];
            } else if (score == best_score && best_score > 0) {
                ties.push_back(idx);
            };

            i = i + 1;
        };

        if (ties.is_empty()) {
            return pick_random_near(game, gen)
        };

        let tn = ties.length();
        if (tn == 1) {
            ties[0]
        } else {
            let pick = random::generate_u64_in_range(gen, 0, tn - 1);
            ties[pick]
        }
    }

    /// Score the combined pattern strength of placing `mark` at `idx` in all 4 directions.
    /// Patterns in each of the 4 axes are classified independently and summed — this is
    /// what makes double-open-3 forks score > a single closed-4.
    fun score_placement(board: &vector<u8>, idx: u64, mark: u8): u64 {
        let row = idx / BOARD_SIZE;
        let col = idx % BOARD_SIZE;
        let mut total = 0u64;

        // horizontal (row, +col)
        let (c0, l0, r0) = count_line_with_ends(board, row, col, mark, 0, 1, false);
        total = total + classify_pattern(c0, l0, r0);

        // vertical (+row, col)
        let (c1, l1, r1) = count_line_with_ends(board, row, col, mark, 1, 0, false);
        total = total + classify_pattern(c1, l1, r1);

        // diagonal "\" (+row, +col)
        let (c2, l2, r2) = count_line_with_ends(board, row, col, mark, 1, 1, false);
        total = total + classify_pattern(c2, l2, r2);

        // diagonal "/" (+row, -col)
        let (c3, l3, r3) = count_line_with_ends(board, row, col, mark, 1, 1, true);
        total = total + classify_pattern(c3, l3, r3);

        total
    }

    /// Count the run of `mark`s along one axis through (row, col), treating (row, col) itself
    /// as if it contained `mark`, and report whether each end of the run is open (next cell EMPTY)
    /// or blocked (opponent stone or board edge).
    /// `col_negative = true` flips the column step direction (used for the "/" diagonal).
    fun count_line_with_ends(
        board: &vector<u8>,
        row: u64, col: u64,
        mark: u8,
        dr: u64, dc: u64,
        col_negative: bool,
    ): (u64, bool, bool) {
        let mut total = 1u64; // the placed cell itself
        let mut forward_open = false;
        let mut backward_open = false;

        // Forward walk
        let mut step = 1u64;
        loop {
            let r = row + step * dr;
            let out_of_bounds_c = col_negative && step * dc > col;
            if (out_of_bounds_c) break;
            let c = if (col_negative) { col - step * dc } else { col + step * dc };
            if (r >= BOARD_SIZE || c >= BOARD_SIZE) break;
            let cell = board[r * BOARD_SIZE + c];
            if (cell == mark) {
                total = total + 1;
                step = step + 1;
                continue
            };
            if (cell == EMPTY) forward_open = true;
            break
        };

        // Backward walk (mirror of forward)
        step = 1;
        loop {
            if (step * dr > row) break;
            let r = row - step * dr;
            // backward flips col direction relative to forward
            let c = if (col_negative) {
                col + step * dc
            } else {
                if (step * dc > col) break;
                col - step * dc
            };
            if (r >= BOARD_SIZE || c >= BOARD_SIZE) break;
            let cell = board[r * BOARD_SIZE + c];
            if (cell == mark) {
                total = total + 1;
                step = step + 1;
                continue
            };
            if (cell == EMPTY) backward_open = true;
            break
        };

        (total, backward_open, forward_open)
    }

    /// Convert a (run-length, open-ends) description to a score.
    /// "Open" means the cell immediately past that end is empty; "closed" means it's an
    /// opponent stone or the board edge. Open patterns are vastly more dangerous because
    /// they can grow in either direction.
    fun classify_pattern(consecutive: u64, left_open: bool, right_open: bool): u64 {
        if (consecutive >= WIN_LENGTH) return SCORE_FIVE;
        let open_ends = (if (left_open) 1u64 else 0) + (if (right_open) 1u64 else 0);
        if (open_ends == 0) return 0; // fully walled in — dead shape
        if (consecutive == 4) {
            if (open_ends == 2) SCORE_OPEN_4 else SCORE_CLOSED_4
        } else if (consecutive == 3) {
            if (open_ends == 2) SCORE_OPEN_3 else SCORE_CLOSED_3
        } else if (consecutive == 2) {
            if (open_ends == 2) SCORE_OPEN_2 else SCORE_CLOSED_2
        } else {
            0
        }
    }

    /// A cell is worth evaluating only if there's at least one stone within Chebyshev
    /// distance CANDIDATE_RADIUS of it — isolated moves never win anything.
    fun is_candidate(board: &vector<u8>, idx: u64): bool {
        let row = idx / BOARD_SIZE;
        let col = idx % BOARD_SIZE;

        // row window [row - R, row + R], clamped
        let r_start = if (row >= CANDIDATE_RADIUS) row - CANDIDATE_RADIUS else 0;
        let r_end = {
            let tentative = row + CANDIDATE_RADIUS;
            if (tentative >= BOARD_SIZE) BOARD_SIZE - 1 else tentative
        };
        let c_start = if (col >= CANDIDATE_RADIUS) col - CANDIDATE_RADIUS else 0;
        let c_end = {
            let tentative = col + CANDIDATE_RADIUS;
            if (tentative >= BOARD_SIZE) BOARD_SIZE - 1 else tentative
        };

        let mut r = r_start;
        while (r <= r_end) {
            let mut c = c_start;
            while (c <= c_end) {
                if (board[r * BOARD_SIZE + c] != EMPTY) return true;
                c = c + 1;
            };
            r = r + 1;
        };
        false
    }

    /// Pick a random empty cell restricted to candidates (within CANDIDATE_RADIUS
    /// of a stone). Shares the cheap `gather_candidates` walk with `best_move`.
    fun pick_random_near(game: &Game, gen: &mut RandomGenerator): u64 {
        let pool = gather_candidates(&game.board);
        if (pool.is_empty()) return pick_random_empty(game, gen);
        let n = pool.length();
        let pick = random::generate_u64_in_range(gen, 0, n - 1);
        pool[pick]
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

    // ===== Test-Only Helpers =====
    // Exposed so `ai_tests.move` can seed a board and invoke the pure scoring logic
    // without going through `entry fun play` (which needs &Random).

    #[test_only]
    public fun empty_board(): vector<u8> {
        let mut board = vector[];
        let mut i = 0u64;
        while (i < TOTAL_CELLS) { board.push_back(EMPTY); i = i + 1; };
        board
    }

    #[test_only]
    public fun set_cell(board: &mut vector<u8>, row: u64, col: u64, mark: u8) {
        *&mut board[row * BOARD_SIZE + col] = mark;
    }

    #[test_only]
    public fun score_placement_for_test(board: &vector<u8>, row: u64, col: u64, mark: u8): u64 {
        score_placement(board, row * BOARD_SIZE + col, mark)
    }

    #[test_only]
    public fun find_threat_for_test(board: &vector<u8>, mark: u8, count: u64): u64 {
        find_threat(board, mark, count)
    }

    #[test_only]
    public fun count_line_for_test(
        board: &vector<u8>,
        row: u64, col: u64,
        mark: u8,
        dr: u64, dc: u64,
        col_negative: bool,
    ): (u64, bool, bool) {
        count_line_with_ends(board, row, col, mark, dr, dc, col_negative)
    }

    #[test_only] public fun player_mark(): u8 { PLAYER }
    #[test_only] public fun ai_mark(): u8 { AI }
    #[test_only] public fun board_size(): u64 { BOARD_SIZE }
    #[test_only] public fun score_open_four(): u64 { SCORE_OPEN_4 }
    #[test_only] public fun score_open_three(): u64 { SCORE_OPEN_3 }
    #[test_only] public fun score_closed_four(): u64 { SCORE_CLOSED_4 }

    /// Test-only constructor for a GameResult — lets replay_tests.move exercise
    /// `attach_replay` without having to play a whole game end-to-end.
    #[test_only]
    public fun mint_result_for_test(
        game_id: ID,
        player: address,
        status: u8,
        move_count: u64,
        difficulty: u8,
        ctx: &mut TxContext,
    ): GameResult {
        GameResult {
            id: object::new(ctx),
            game_id,
            player,
            status,
            move_count,
            difficulty,
            board_snapshot: empty_board(),
        }
    }

    #[test_only]
    public fun destroy_result_for_test(result: GameResult) {
        let GameResult {
            id, game_id: _, player: _, status: _,
            move_count: _, difficulty: _, board_snapshot: _
        } = result;
        object::delete(id);
    }
}
