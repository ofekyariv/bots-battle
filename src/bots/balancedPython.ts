// ============================================================
// 🐍 Balanced Bot — Python version
// ============================================================
// Same adaptive strategy as the TypeScript Balanced bot, but
// written in Python 3 to demonstrate Python bot capabilities.
//
// This file exports the Python source code as a string for use
// in the editor and as a pre-built bot opponent.
// ============================================================

/**
 * Python source for the Balanced bot strategy.
 *
 * The `# @language: python` marker tells the sandbox to route
 * this code through the Brython Python executor instead of the
 * Function() JavaScript sandbox.
 */
export const BALANCED_PYTHON_CODE = `# @language: python
#
# ⚖️ Balanced Bot (Python) — adaptive strategy
#
# Each ship evaluates its situation every 8 ticks and picks a mode:
#   CAPTURE  — safe to grab islands
#   ASSAULT  — we outnumber nearby enemies, press the attack
#   RETREAT  — outnumbered, regroup with friends
#   DEFEND   — one of our islands is being neutralised
#
# Score-aware: tolerates riskier fights when behind, plays safe when ahead.

def create_bot():
    ship_mode  = {}   # ship_id -> mode string
    mode_timer = {}   # ship_id -> tick when mode was last set
    MODE_HOLD  = 8    # ticks before re-evaluating mode

    def eval_mode(state, ship):
        r = state.config.attack_radius
        score_delta = state.my_score - state.enemy_score
        is_behind = score_delta < -100
        fight_threshold = 0 if is_behind else 1

        near_friends = sum(
            1 for s in state.my_ships
            if s.id != ship.id and s.alive and distance_to(ship, s) <= r
        )
        near_enemies = sum(
            1 for s in state.enemy_ships
            if s.alive and distance_to(ship, s) <= r
        )

        if near_enemies > near_friends + 1:
            return 'retreat'
        if near_enemies > 0 and near_friends >= fight_threshold:
            return 'assault'

        # Check if any of our islands is being neutralised
        threatened = [i for i in state.islands
                      if i.owner == 'me' and i.team_capturing == 'enemy']
        if threatened:
            nearest_threat = min(threatened, key=lambda i: distance_to(ship, i))
            free_team = [s for s in state.my_ships if s.id != ship.id and s.alive]
            closer = any(distance_to(s, nearest_threat) < distance_to(ship, nearest_threat)
                         for s in free_team)
            if not closer:
                return 'defend'

        return 'capture'

    def tick(state, ship):
        if not ship.alive:
            ship_mode.pop(ship.id, None)
            mode_timer.pop(ship.id, None)
            return {'type': 'idle'}

        tick_num = state.tick
        r = state.config.attack_radius

        held_for  = tick_num - mode_timer.get(ship.id, -9999)
        force_reeval = held_for >= MODE_HOLD
        new_mode  = eval_mode(state, ship)

        if ship.id not in ship_mode or force_reeval or new_mode == 'retreat':
            ship_mode[ship.id]  = new_mode
            mode_timer[ship.id] = tick_num

        mode = ship_mode[ship.id]

        # ── RETREAT ───────────────────────────────────────────────────
        if mode == 'retreat':
            friends = [s for s in state.my_ships if s.id != ship.id and s.alive]
            if friends:
                nearest = min(friends, key=lambda s: distance_to(ship, s))
                return {'type': 'move', 'target': {'x': nearest.x, 'y': nearest.y}}
            return {'type': 'idle'}

        # ── ASSAULT ───────────────────────────────────────────────────
        if mode == 'assault':
            fightable = [s for s in state.enemy_ships if s.alive]
            if fightable:
                def isolation(e):
                    return sum(1 for x in state.enemy_ships
                               if x.id != e.id and x.alive and distance_to(e, x) <= r)
                target = min(fightable, key=lambda e: (isolation(e), distance_to(ship, e)))
                return {'type': 'move', 'target': {'x': target.x, 'y': target.y}}
            # No enemies to fight — fall through to capture

        # ── DEFEND ────────────────────────────────────────────────────
        if mode == 'defend':
            threatened = [i for i in state.islands
                          if i.owner == 'me' and i.team_capturing == 'enemy']
            if threatened:
                t = min(threatened, key=lambda i: distance_to(ship, i))
                return {'type': 'move', 'target': {'x': t.x, 'y': t.y}}

        # ── CAPTURE ───────────────────────────────────────────────────
        uncaptured = islands_not_mine(state.islands)
        if not uncaptured:
            mine = islands_owned_by(state.islands, 'me')
            if mine:
                best = max(mine, key=lambda i: i.value)
                return {'type': 'move', 'target': {'x': best.x, 'y': best.y}}
            return {'type': 'idle'}

        def island_score(i):
            dist    = distance_to(ship, i)
            urgency = 3000 if i.owner == 'enemy' else 0
            value_b = (i.value - 1) * 500
            return urgency + value_b - dist

        best = max(uncaptured, key=island_score)
        return {'type': 'move', 'target': {'x': best.x, 'y': best.y}}

    return {'tick': tick}
`;
