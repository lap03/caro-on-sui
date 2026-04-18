#[test_only]
module caro::ai_tests {
    use caro::game;

    // Convenient grid helpers: (r, c) → board[r*15+c]

    #[test]
    fun empty_board_scores_zero() {
        let board = game::empty_board();
        // Any cell on an empty board has no run → score 0 regardless of mark.
        assert!(game::score_placement_for_test(&board, 7, 7, game::ai_mark()) == 0, 0);
    }

    #[test]
    fun open_three_scores_as_open_three() {
        // Horizontal: . X X . X .  — placing at (7,6) should create an open-three _XXX_
        let mut board = game::empty_board();
        game::set_cell(&mut board, 7, 5, game::ai_mark());
        game::set_cell(&mut board, 7, 7, game::ai_mark());
        // Place at (7, 6) — this joins (7,5), (7,6), (7,7) in a row with both ends empty.
        let score = game::score_placement_for_test(&board, 7, 6, game::ai_mark());
        // Score must include at least one open-three contribution.
        assert!(score >= game::score_open_three(), 1);
    }

    #[test]
    fun open_four_outscores_open_three() {
        // Build an open-four shape by placing the middle stone that completes 4-in-a-row
        // with empty ends on both sides.
        let mut board = game::empty_board();
        game::set_cell(&mut board, 7, 3, game::ai_mark());
        game::set_cell(&mut board, 7, 4, game::ai_mark());
        game::set_cell(&mut board, 7, 6, game::ai_mark());
        // Place at (7, 5) → . X X X X . (cols 3,4,5,6 with both ends empty)
        let open_four = game::score_placement_for_test(&board, 7, 5, game::ai_mark());

        // Comparison open-three: . X X X .
        let mut board2 = game::empty_board();
        game::set_cell(&mut board2, 7, 3, game::ai_mark());
        game::set_cell(&mut board2, 7, 5, game::ai_mark());
        let open_three = game::score_placement_for_test(&board2, 7, 4, game::ai_mark());

        assert!(open_four > open_three, 2);
    }

    #[test]
    fun blocked_four_is_closed_not_open() {
        // PLAYER stones blocking the left end, AI forms XXXX to the right.
        // Placing the last AI stone creates a closed-four (one end blocked).
        let mut board = game::empty_board();
        game::set_cell(&mut board, 7, 3, game::player_mark()); // blocker
        game::set_cell(&mut board, 7, 4, game::ai_mark());
        game::set_cell(&mut board, 7, 5, game::ai_mark());
        game::set_cell(&mut board, 7, 7, game::ai_mark());
        // Place at (7,6) → P X X X X . — closed four (left blocked, right open).
        let score = game::score_placement_for_test(&board, 7, 6, game::ai_mark());
        assert!(score >= game::score_closed_four(), 3);
        // And strictly less than an open-four because one side is blocked.
        assert!(score < game::score_open_four(), 4);
    }

    #[test]
    fun find_threat_completes_open_four_to_win() {
        // AI has 4 consecutive marks; find_threat should return the empty completing cell.
        let mut board = game::empty_board();
        game::set_cell(&mut board, 7, 4, game::ai_mark());
        game::set_cell(&mut board, 7, 5, game::ai_mark());
        game::set_cell(&mut board, 7, 6, game::ai_mark());
        game::set_cell(&mut board, 7, 7, game::ai_mark());
        let idx = game::find_threat_for_test(&board, game::ai_mark(), 4);
        // Either end (7,3) or (7,8) is a valid completing cell.
        let valid = idx == 7 * game::board_size() + 3 || idx == 7 * game::board_size() + 8;
        assert!(valid, 5);
    }

    #[test]
    fun find_threat_blocks_opponent_mate() {
        // Opponent has 4 in a row — find_threat(PLAYER, 4) should flag the block cell.
        let mut board = game::empty_board();
        game::set_cell(&mut board, 3, 3, game::player_mark());
        game::set_cell(&mut board, 3, 4, game::player_mark());
        game::set_cell(&mut board, 3, 5, game::player_mark());
        game::set_cell(&mut board, 3, 6, game::player_mark());
        let idx = game::find_threat_for_test(&board, game::player_mark(), 4);
        let valid = idx == 3 * game::board_size() + 2 || idx == 3 * game::board_size() + 7;
        assert!(valid, 6);
    }

    #[test]
    fun fork_scores_higher_than_single_open_three() {
        // Two lines of 2-in-a-row intersecting at a "T" cell: placing at the T creates
        // two simultaneous open-threes (horizontal + vertical), i.e. a fork.
        let mut board = game::empty_board();
        // horizontal neighbors
        game::set_cell(&mut board, 7, 5, game::ai_mark());
        game::set_cell(&mut board, 7, 6, game::ai_mark());
        // vertical neighbors
        game::set_cell(&mut board, 5, 7, game::ai_mark());
        game::set_cell(&mut board, 6, 7, game::ai_mark());
        // Place at (7,7) — joins horizontal (7,5)(7,6)(7,7) and vertical (5,7)(6,7)(7,7).
        let fork_score = game::score_placement_for_test(&board, 7, 7, game::ai_mark());

        // Comparison: a single open-three on an otherwise clean board.
        let mut single = game::empty_board();
        game::set_cell(&mut single, 7, 5, game::ai_mark());
        game::set_cell(&mut single, 7, 6, game::ai_mark());
        let single_score = game::score_placement_for_test(&single, 7, 7, game::ai_mark());

        assert!(fork_score > single_score, 7);
        // Fork should be at least ~2x a single open-three (two axes contribute).
        assert!(fork_score >= single_score * 2, 8);
    }

    #[test]
    fun diagonal_run_is_counted() {
        // Ensure diagonal patterns (\) are scored, not just horizontal/vertical.
        let mut board = game::empty_board();
        game::set_cell(&mut board, 5, 5, game::ai_mark());
        game::set_cell(&mut board, 6, 6, game::ai_mark());
        // Place at (7,7) → diagonal open-three.
        let score = game::score_placement_for_test(&board, 7, 7, game::ai_mark());
        assert!(score >= game::score_open_three(), 9);
    }

    #[test]
    fun count_line_detects_both_blocked_ends() {
        // P A A A P  — run of 3, both ends blocked by opponent.
        let mut board = game::empty_board();
        game::set_cell(&mut board, 7, 3, game::player_mark());
        game::set_cell(&mut board, 7, 4, game::ai_mark());
        game::set_cell(&mut board, 7, 6, game::ai_mark());
        game::set_cell(&mut board, 7, 7, game::player_mark());
        // Placing at (7,5) completes the AI run of 3.
        let (consecutive, left_open, right_open) =
            game::count_line_for_test(&board, 7, 5, game::ai_mark(), 0, 1, false);
        assert!(consecutive == 3, 10);
        assert!(!left_open && !right_open, 11);
    }
}
