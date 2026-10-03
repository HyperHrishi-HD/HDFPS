# HDFPS

A production-style multiplayer first-person shooter built on Unity 6, Netcode for Entities, and GhostBridge.

Open `Assets/Scenes/MainMenu.unity` in **Unity 6000.5.0f1** (or newer 6000.5) and press Play.

## Play

1. Set a player name and pick **Rifle** or **Shotgun**.
2. Choose a connection mode:
   - **Direct / Start Host** — LAN or same-machine listen server. Default port `7979`.
   - **Direct / Connect to Server** — join a host by IP and port.
   - **Relay / Create or Join Session** — Unity Gaming Services relay. Requires a project linked to UGS.
3. Fight. Deaths respawn after 5 seconds. Tab shows the scoreboard.

Dedicated Linux servers can still be launched in batchmode; the game falls back to a null audio system when headless.

## Controls

| Action | Keyboard / Mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD / arrows | Left stick | Left half of the screen |
| Look | Mouse | Right stick | Right half of the screen |
| Fire | Left mouse | Right trigger / bumper | FIRE button |
| Aim walk / sprint | Left Shift | Left stick click / left trigger | SPRINT button |
| Jump | Space | South button | JUMP button |
| Reload | R | West button | R button |
| Scoreboard | Tab | Select | — |
| Pause | Esc | Start | — |

Pause includes mouse sensitivity, gamepad look speed, and invert-Y. Settings persist in PlayerPrefs.

## Weapons

- **Assault Rifle** — hitscan, 30-round mag, 0.1s shot interval.
- **Shotgun** — projectile pellets, 10-round mag, slower fire, heavier recoil.

Empty magazines auto-reload. Impacts, muzzle flash, hit markers, and a damage vignette play on the local client.

## Project layout

- `Assets/Scripts/Gameplay` — movement, weapons, HUD, camera, VFX
- `Assets/Scripts/Networking` — session bootstrap, client/server game flow
- `Assets/Scripts/GhostBridge` — hybrid GameObject / ghost prediction
- `Assets/Scenes` — MainMenu, GameScene, subscenes, Persistents
- `Assets/Data/Weapons` — ScriptableObject weapon tuning

Built scenes: MainMenu, GameScene, GameResourcesSubScene, Persistents, SpawnPointsSubScene.
