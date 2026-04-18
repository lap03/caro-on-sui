#[test_only]
module caro::replay_tests {
    use sui::test_scenario as ts;
    use sui::clock;
    use sui::event;
    use caro::game::{Self, ReplaySaved};

    const PLAYER_ADDR: address = @0xCAFE;
    const ATTACKER_ADDR: address = @0xBAD;

    fun dummy_game_id(scenario: &mut ts::Scenario): sui::object::ID {
        // Any fresh UID → ID will do; we never share or store the game itself.
        let ctx = ts::ctx(scenario);
        let uid = sui::object::new(ctx);
        let id = sui::object::uid_to_inner(&uid);
        sui::object::delete(uid);
        id
    }

    #[test]
    fun attach_replay_emits_expected_event() {
        let mut scenario = ts::begin(PLAYER_ADDR);
        let game_id = dummy_game_id(&mut scenario);

        ts::next_tx(&mut scenario, PLAYER_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let clk = clock::create_for_testing(ctx);
            let result = game::mint_result_for_test(
                game_id, PLAYER_ADDR, 1 /* STATUS_PLAYER_WIN */, 17, 2 /* HARD */, ctx
            );

            let blob = b"kE7aHexampleBlobIdBytes";
            game::attach_replay(&result, blob, &clk, ctx);

            // One ReplaySaved event should now be in the tx buffer.
            assert!(event::num_events() == 1, 100);
            let events = event::events_by_type<ReplaySaved>();
            assert!(events.length() == 1, 101);

            game::destroy_result_for_test(result);
            clock::destroy_for_testing(clk);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 0, location = caro::game)]
    fun attach_replay_rejects_non_owner() {
        // GameResult.player = PLAYER_ADDR, but tx sender = ATTACKER_ADDR → must abort ENotPlayer (=0).
        let mut scenario = ts::begin(PLAYER_ADDR);
        let game_id = dummy_game_id(&mut scenario);

        ts::next_tx(&mut scenario, ATTACKER_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let clk = clock::create_for_testing(ctx);
            let result = game::mint_result_for_test(
                game_id, PLAYER_ADDR, 2 /* AI_WIN */, 4, 0 /* EASY */, ctx
            );
            let blob = b"anything";
            game::attach_replay(&result, blob, &clk, ctx); // aborts

            // unreachable — compiler still wants these for linear types:
            game::destroy_result_for_test(result);
            clock::destroy_for_testing(clk);
        };

        ts::end(scenario);
    }
}
