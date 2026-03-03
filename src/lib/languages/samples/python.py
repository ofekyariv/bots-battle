# @language: python
# ============================================================
# 🏴☠️ Bots Battle — Python Sample Bots
# ============================================================
# Copy any of these into the editor and press "Use in Battle".
# All helper functions (snake_case) are available globally.
# ============================================================

# ─────────────────────────────────────────────
# 🟢 Rusher — simple greedy spreader
# Each ship claims a unique uncaptured island;
# enemy islands get priority. Simple and fast.
# ─────────────────────────────────────────────
def create_bot():
    def tick(state, ship):
        if not ship.alive:
            return {'type': 'idle'}

        enemies_isl  = islands_owned_by(state.islands, 'enemy')
        neutrals_isl = islands_owned_by(state.islands, 'neutral')
        uncaptured = enemies_isl + neutrals_isl

        # All mine — defend contested, then hold nearest
        if not uncaptured:
            contested = [i for i in state.islands
                         if i.owner == 'me' and i.team_capturing == 'enemy']
            if contested:
                t = nearest_island(ship, contested)
                return {'type': 'move', 'target': {'x': t.x, 'y': t.y}}
            mine = islands_owned_by(state.islands, 'me')
            if mine:
                t = nearest_island(ship, mine)
                return {'type': 'move', 'target': {'x': t.x, 'y': t.y}}
            return {'type': 'idle'}

        def score(island, from_ship):
            return distance_to(from_ship, island) - (5000 if island.owner == 'enemy' else 0)

        alive = sorted([s for s in state.my_ships if s.alive], key=lambda s: s.id)
        my_rank = next((i for i, s in enumerate(alive) if s.id == ship.id), -1)
        if my_rank == -1:
            return {'type': 'idle'}

        claimed = set()
        for r in range(my_rank):
            other = alive[r]
            pool = [i for i in uncaptured if i.id not in claimed]
            if not pool:
                break
            best = min(pool, key=lambda i: score(i, other))
            claimed.add(best.id)

        remaining = [i for i in uncaptured if i.id not in claimed]
        pool = remaining if remaining else uncaptured
        target = min(pool, key=lambda i: score(i, ship))
        return {'type': 'move', 'target': {'x': target.x, 'y': target.y}}

    return {'tick': tick}


# ─────────────────────────────────────────────
# 🟡 Balanced — adaptive: retreat / assault / capture / defend
# ─────────────────────────────────────────────
def create_bot():
    ship_mode  = {}   # ship.id → 'capture'|'retreat'|'assault'|'defend'
    mode_timer = {}   # ship.id → tick when mode was set
    MODE_HOLD  = 8

    def eval_mode(state, ship):
        r = state.config.attack_radius
        near_friends = sum(
            1 for s in state.my_ships
            if s.id != ship.id and s.alive and distance_to(ship, s) <= r
        )
        near_enemies = sum(
            1 for e in state.enemy_ships
            if e.alive and distance_to(ship, e) <= r
        )
        score_delta = state.my_score - state.enemy_score
        is_behind = score_delta < -100
        fight_threshold = 0 if is_behind else 1

        if near_enemies > near_friends + 1:
            return 'retreat'
        if near_enemies > 0 and near_friends >= fight_threshold:
            return 'assault'

        threatened = [i for i in state.islands
                      if i.owner == 'me' and i.team_capturing == 'enemy']
        if threatened:
            nearest = min(threatened, key=lambda i: distance_to(ship, i))
            free_team = [s for s in state.my_ships if s.id != ship.id and s.alive]
            closer = any(distance_to(s, nearest) < distance_to(ship, nearest) for s in free_team)
            if not closer:
                return 'defend'

        return 'capture'

    def tick(state, ship):
        if not ship.alive:
            ship_mode.pop(ship.id, None)
            mode_timer.pop(ship.id, None)
            return {'type': 'idle'}

        tick_n = state.tick
        r = state.config.attack_radius
        held_for = tick_n - mode_timer.get(ship.id, -999)
        new_mode = eval_mode(state, ship)

        if ship.id not in ship_mode or held_for >= MODE_HOLD or new_mode == 'retreat':
            ship_mode[ship.id]  = new_mode
            mode_timer[ship.id] = tick_n

        mode = ship_mode[ship.id]

        if mode == 'retreat':
            friends = [s for s in state.my_ships if s.id != ship.id and s.alive]
            if friends:
                near = min(friends, key=lambda f: distance_to(ship, f))
                return {'type': 'move', 'target': {'x': near.x, 'y': near.y}}
            return {'type': 'idle'}

        if mode == 'assault':
            fightable = [e for e in state.enemy_ships if e.alive]
            if fightable:
                target = min(fightable, key=lambda e: (
                    sum(1 for x in state.enemy_ships if x.id != e.id and x.alive and distance_to(e, x) <= r),
                    distance_to(ship, e)
                ))
                return {'type': 'move', 'target': {'x': target.x, 'y': target.y}}

        if mode == 'defend':
            threatened = [i for i in state.islands
                          if i.owner == 'me' and i.team_capturing == 'enemy']
            if threatened:
                t = min(threatened, key=lambda i: distance_to(ship, i))
                return {'type': 'move', 'target': {'x': t.x, 'y': t.y}}

        # Capture
        uncaptured = islands_not_mine(state.islands)
        if not uncaptured:
            mine = islands_owned_by(state.islands, 'me')
            if mine:
                best = max(mine, key=lambda i: i.value)
                return {'type': 'move', 'target': {'x': best.x, 'y': best.y}}
            return {'type': 'idle'}

        def capture_score(i):
            dist    = distance_to(ship, i)
            urgency = 3000 if i.owner == 'enemy' else 0
            value_b = (i.value - 1) * 500
            return urgency + value_b - dist

        best = max(uncaptured, key=capture_score)
        return {'type': 'move', 'target': {'x': best.x, 'y': best.y}}

    return {'tick': tick}


# ─────────────────────────────────────────────
# 🔴 Admiral — 3-phase state machine with per-ship roles
# expand → consolidate → endgame
# ─────────────────────────────────────────────
def create_bot():
    roles = {}          # ship.id → {'role': str, 'target_id': int|None}
    last_role_update = [-50]
    ROLE_UPDATE_INTERVAL = 20

    def get_phase(tick, max_ticks):
        pct = tick / max_ticks
        if pct < 0.28: return 'expand'
        if pct < 0.67: return 'consolidate'
        return 'endgame'

    def assign_roles(state):
        phase = get_phase(state.tick, state.max_ticks)
        alive = sorted([s for s in state.my_ships if s.alive], key=lambda s: s.id)
        my_islands  = islands_owned_by(state.islands, 'me')
        uncaptured  = islands_not_mine(state.islands)
        score_delta = state.my_score - state.enemy_score
        is_ahead    = score_delta > 150
        new_roles   = {}

        if phase == 'expand':
            claimed = set()
            for sh in alive:
                pool = [i for i in uncaptured if i.id not in claimed]
                if not pool:
                    new_roles[sh.id] = {'role': 'idle', 'target_id': None}
                    continue
                best = min(pool, key=lambda i: distance_to(sh, i) - (2000 if i.owner == 'enemy' else 0))
                claimed.add(best.id)
                new_roles[sh.id] = {'role': 'capturer', 'target_id': best.id}

        elif phase == 'consolidate':
            def_count = 0
            for sh in alive:
                if def_count < len(my_islands) * 1.5 and my_islands:
                    not_doubled = [i for i in my_islands
                                   if sum(1 for v in new_roles.values() if v['target_id'] == i.id) < 2]
                    if not_doubled:
                        t = min(not_doubled, key=lambda i: distance_to(sh, i))
                        new_roles[sh.id] = {'role': 'defender', 'target_id': t.id}
                        def_count += 1
                        continue
                if uncaptured:
                    best = min(uncaptured, key=lambda i: distance_to(sh, i) - (3000 if i.owner == 'enemy' else 0))
                    new_roles[sh.id] = {'role': 'attacker', 'target_id': best.id}
                else:
                    new_roles[sh.id] = {'role': 'idle', 'target_id': None}

        else:  # endgame
            if is_ahead:
                for sh in alive:
                    t = min(my_islands, key=lambda i: distance_to(sh, i)) if my_islands else None
                    new_roles[sh.id] = {'role': 'defender', 'target_id': t.id if t else None}
            else:
                enemy_isl = islands_owned_by(state.islands, 'enemy')
                target = max(enemy_isl, key=lambda i: i.value) if enemy_isl else None
                for sh in alive:
                    new_roles[sh.id] = {'role': 'attacker', 'target_id': target.id if target else None}

        return new_roles

    def tick(state, ship):
        if not ship.alive:
            roles.pop(ship.id, None)
            return {'type': 'idle'}

        if state.tick - last_role_update[0] >= ROLE_UPDATE_INTERVAL:
            new_roles = assign_roles(state)
            roles.update(new_roles)
            last_role_update[0] = state.tick

        my_role = roles.get(ship.id, {'role': 'idle', 'target_id': None})
        r = state.config.attack_radius

        if my_role['role'] == 'defender' and my_role['target_id'] is not None:
            island = next((i for i in state.islands if i.id == my_role['target_id']), None)
            if island:
                if island.team_capturing == 'enemy':
                    return {'type': 'move', 'target': {'x': island.x, 'y': island.y}}
                import math
                angle = state.tick * 0.03 + ship.id
                ox = island.x + math.cos(angle) * island.radius * 0.8
                oy = island.y + math.sin(angle) * island.radius * 0.8
                return {'type': 'move', 'target': {'x': ox, 'y': oy}}

        if my_role['role'] == 'attacker' and my_role['target_id'] is not None:
            island = next((i for i in state.islands if i.id == my_role['target_id']), None)
            if island:
                near_friends = sum(1 for s in state.my_ships if s.id != ship.id and s.alive and distance_to(ship, s) <= r)
                near_enemies = sum(1 for e in state.enemy_ships if e.alive and distance_to(ship, e) <= r)
                if near_enemies > near_friends + 2:
                    friends = [s for s in state.my_ships if s.id != ship.id and s.alive]
                    if friends:
                        t = min(friends, key=lambda f: distance_to(ship, f))
                        return {'type': 'move', 'target': {'x': t.x, 'y': t.y}}
                return {'type': 'move', 'target': {'x': island.x, 'y': island.y}}

        if my_role['role'] == 'capturer' and my_role['target_id'] is not None:
            island = next((i for i in state.islands if i.id == my_role['target_id']), None)
            if island and island.owner != 'me':
                return {'type': 'move', 'target': {'x': island.x, 'y': island.y}}
            unc = islands_not_mine(state.islands)
            if unc:
                t = nearest_island(ship, unc)
                return {'type': 'move', 'target': {'x': t.x, 'y': t.y}}

        # Idle fallback
        unc = islands_not_mine(state.islands)
        if unc:
            t = nearest_island(ship, unc)
            return {'type': 'move', 'target': {'x': t.x, 'y': t.y}}
        mine = islands_owned_by(state.islands, 'me')
        if mine:
            t = nearest_island(ship, mine)
            return {'type': 'move', 'target': {'x': t.x, 'y': t.y}}
        return {'type': 'idle'}

    return {'tick': tick}
