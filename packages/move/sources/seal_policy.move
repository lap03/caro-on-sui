/// Seal access policy for commit-reveal Challenge Mode.
/// Only the game's player can decrypt their own committed moves.
/// This module will be fully activated in Sprint 3 when Seal integration is added.
module caro::seal_policy {
    // NOTE: Seal dependency will be added in Sprint 3
    // For now, this is a placeholder module to establish the package structure.
    // The actual seal_approve function requires the `seal` package dependency.

    use caro::game::Game;

    /// Placeholder for Seal approval logic.
    /// In Sprint 3, this will verify that only the game player can decrypt moves.
    public fun validate_player(game: &Game, ctx: &TxContext): bool {
        caro::game::player(game) == ctx.sender()
    }
}
