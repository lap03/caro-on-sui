/// Seal access policy for Challenge Mode commit-reveal moves.
///
/// The Seal key server dry-runs `seal_approve` via `dry_run_transaction_block`.
/// If the function executes without aborting, the server releases a key share
/// that the caller combines (threshold 1 on testnet) to decrypt the ciphertext.
/// So the protocol is: put the access predicate as `assert!(...)` here; any
/// failure means the key server will refuse to return a share.
///
/// No framework import is needed — the `seal_approve*` naming convention is
/// what the key server looks for (mirrors the canonical patterns in
/// https://github.com/MystenLabs/seal/tree/main/move/patterns).
module caro::seal_policy {
    use caro::game::Game;

    const ENotPlayer: u64 = 0;

    /// Gate: the transaction sender must be the game's player.
    /// `id` is the Seal IBE identity the ciphertext was sealed against
    /// (we use the game's object id bytes so ciphertexts are scoped per game).
    /// The argument is kept to match the Seal key server's expected signature.
    entry fun seal_approve(
        _id: vector<u8>,
        game: &Game,
        ctx: &TxContext,
    ) {
        assert!(caro::game::player(game) == ctx.sender(), ENotPlayer);
    }

    /// Helper retained for off-chain predicate checks that don't want to
    /// construct a dry-run transaction.
    public fun validate_player(game: &Game, ctx: &TxContext): bool {
        caro::game::player(game) == ctx.sender()
    }
}
