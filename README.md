# HDFPS

Sci-fi arena FPS. Play it on the web at [hdfps.vercel.app](https://hdfps.vercel.app).

## Play in the browser

Open [hdfps.vercel.app](https://hdfps.vercel.app), enter a name, pick **Rifle** or **Shotgun**, then **Start Match**. Click the game once to lock the mouse.

| Action | Keyboard / Mouse | Touch |
| --- | --- | --- |
| Move | WASD / arrows | Left stick |
| Look | Mouse | Drag on the right |
| Fire | Left click | FIRE |
| Sprint | Shift | SPRINT |
| Jump | Space | JUMP |
| Reload | R | R |
| Pause | Esc | — |

Empty magazines auto-reload. Bots fight back and respawn. Pause includes sensitivity and invert-Y.

The playable build lives in `web/` (Three.js, no Unity runtime required).

## Deploy on Vercel

This repo also contains the Unity project. For [hdfps.vercel.app](https://hdfps.vercel.app) only the web game should ship.

1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `web` (Project Settings → General).
3. Framework Preset: **Other**.
4. Deploy.

If Root Directory stays at the repo root, `vercel.json` already rewrites `/` to `/web`. `.vercelignore` keeps Unity assets out of the deployment.

## Unity editor project

Open `Assets/Scenes/MainMenu.unity` in **Unity 6000.5.0f1** for the Netcode / GhostBridge multiplayer template.

- Direct / Start Host — LAN listen server, default port `7979`
- Direct / Connect — join by IP
- Relay — Unity Gaming Services

Unity controls match the table above, plus Tab for the scoreboard and gamepad (right stick look, triggers fire, Start pause).
