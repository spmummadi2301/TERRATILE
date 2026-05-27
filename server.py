import os
import sys
import json
import time
import uuid
import random
import asyncio
import threading
import http.server
import socketserver
import socket
import websockets

# Configuration
IS_PROD = "PORT" in os.environ
PORT_HTTP = 5173
PORT_WS = int(os.environ.get("PORT", 5174))
GRID_SIZE = 40  # 40x40 grid = 1600 tiles
COOLDOWN_TIME = 0.8  # 800ms cooldown per claim

# Global State
grid_state = {}
connected_sockets = set()  # set of active WebSocket connections
player_identities = {}     # player_id -> { id, name, color, score, last_action, online_status }
telemetry_logs = []        # Ring-buffer of recent events

# Initialize Grid State
def init_grid():
    global grid_state
    for i in range(GRID_SIZE * GRID_SIZE):
        grid_state[i] = {
            "id": i,
            "x": i % GRID_SIZE,
            "y": i // GRID_SIZE,
            "owner_id": None,
            "owner_name": None,
            "owner_color": None,
            "timestamp": 0
        }

init_grid()

# Helper: Append to telemetry log (max 20 entries)
def add_telemetry_log(log_type, msg):
    global telemetry_logs
    telemetry_logs.append({
        "id": str(uuid.uuid4())[:8],
        "type": log_type,
        "msg": msg,
        "timestamp": time.time()
    })
    if len(telemetry_logs) > 20:
        telemetry_logs.pop(0)

# Add initial system log
add_telemetry_log("sys", "GRID TELEMETRY SYSTEM INITIALIZED")
add_telemetry_log("sys", f"GRID SPACE: {GRID_SIZE}x{GRID_SIZE} TILES")

# Re-calculate scores for all players based on grid ownership
def recalculate_scores():
    # Reset scores
    for p_id in player_identities:
        player_identities[p_id]["score"] = 0
    
    # Tally up
    for tile in grid_state.values():
        o_id = tile["owner_id"]
        if o_id and o_id in player_identities:
            player_identities[o_id]["score"] += 1

# Generate a cool geometric futuristic name
def generate_cyber_name():
    prefixes = ["SPECTER", "VORTEX", "PHANTOM", "MATRIX", "VECTOR", "NEXUS", "KINETIC", "APEX", "CYPHER", "QUARK", "OSIRIS", "AETHER"]
    suffixes = ["01", "0X", "42", "77", "99", "ALPHA", "BETA", "PRIME", "CORE", "GRID", "NODE", "VOID"]
    return f"{random.choice(prefixes)}-{random.choice(suffixes)}"

# Generate HSL color
def generate_cyber_color():
    # Curated playful pastels, avoiding blue, indigo, violet (hues ~190 to 280) and neon pop
    # Rose: 350, Peach: 12, Apricot: 30, Butter: 46, Pistachio: 78, Sage: 115, Mint: 148, Turquoise: 168
    # We use high lightness (79-83%) and moderate saturation (30-80%) for soft pastel aesthetic
    pastels = [
        "hsl(350, 75%, 83%)",  # Soft Rose
        "hsl(12, 80%, 83%)",   # Soft Peach
        "hsl(30, 80%, 81%)",   # Soft Apricot
        "hsl(46, 75%, 81%)",   # Softer Butter
        "hsl(78, 35%, 79%)",   # Softer Pistachio
        "hsl(115, 30%, 79%)",  # Softer Sage
        "hsl(148, 30%, 79%)",  # Pale Mint
        "hsl(168, 35%, 79%)"   # Pale Turquoise (Non-neon green-leaning)
    ]
    return random.choice(pastels)

# --- HTTP Static Server ---
class SafeHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serve from the public directory
        public_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')
        super().__init__(*args, directory=public_dir, **kwargs)

    def log_message(self, format, *args):
        # Suppress noisy standard HTTP logs to keep terminal clean
        pass

def run_http_server():
    # Configure socket reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT_HTTP), SafeHTTPRequestHandler) as httpd:
        print(f"[HTTP] Serving static files from ./public on http://localhost:{PORT_HTTP}")
        httpd.serve_forever()

# --- WebSocket Server Logic ---
async def broadcast(message_dict):
    if not connected_sockets:
        return
    message_str = json.dumps(message_dict)
    # Broadcast to all active connections
    await asyncio.gather(*[ws.send(message_str) for ws in connected_sockets])

async def handle_connection(websocket, path=None):
    # Register connection
    connected_sockets.add(websocket)
    player_id = None
    
    try:
        async for message in websocket:
            data = json.loads(message)
            msg_type = data.get("type")
            
            if msg_type == "join":
                # Handle user registration / rejoin
                req_id = data.get("player_id")
                req_name = data.get("name", "").strip()
                req_color = data.get("color", "").strip()
                
                # Check if player exists and is rejoining
                if req_id and req_id in player_identities:
                    player_id = req_id
                    player_identities[player_id]["online_status"] = "online"
                    # Allow user to update their name/color on the fly
                    if req_name:
                        player_identities[player_id]["name"] = req_name
                    if req_color:
                        player_identities[player_id]["color"] = req_color
                else:
                    # New player initialization
                    player_id = req_id if req_id else str(uuid.uuid4())
                    name = req_name if req_name else generate_cyber_name()
                    color = req_color if req_color else generate_cyber_color()
                    
                    player_identities[player_id] = {
                        "id": player_id,
                        "name": name,
                        "color": color,
                        "score": 0,
                        "last_action": 0.0,
                        "online_status": "online"
                    }
                
                # Recalculate scores to sync
                recalculate_scores()
                
                # Send confirmation and initial state back to client
                init_response = {
                    "type": "init",
                    "player_id": player_id,
                    "name": player_identities[player_id]["name"],
                    "color": player_identities[player_id]["color"],
                    "grid_size": GRID_SIZE,
                    "grid": list(grid_state.values()),
                    "players": list(player_identities.values()),
                    "logs": telemetry_logs
                }
                await websocket.send(json.dumps(init_response))
                
                # Broadcast connection event
                add_telemetry_log("connect", f"CLIENT {player_identities[player_id]['name']} CONNECTED")
                await broadcast({
                    "type": "player_join",
                    "players": list(player_identities.values()),
                    "logs": telemetry_logs
                })
                
            elif msg_type == "claim":
                # Ensure the client is fully registered
                if not player_id or player_id not in player_identities:
                    continue
                
                tile_id = data.get("tile_id")
                if tile_id is None or tile_id < 0 or tile_id >= GRID_SIZE * GRID_SIZE:
                    continue
                
                current_time = time.time()
                player = player_identities[player_id]
                
                # Conflict & Rate Limit Check (Cooldown)
                time_elapsed = current_time - player["last_action"]
                if time_elapsed < COOLDOWN_TIME:
                    # Cooldown active, reject request
                    await websocket.send(json.dumps({
                        "type": "cooldown_reject",
                        "remaining": COOLDOWN_TIME - time_elapsed
                    }))
                    continue
                
                # Update cooldown stamp
                player["last_action"] = current_time
                
                # Check if cell is already owned by this exact user
                target_tile = grid_state[tile_id]
                if target_tile["owner_id"] == player_id:
                    # Already owned, send confirmation without broadcasting full update to save bandwidth
                    await websocket.send(json.dumps({
                        "type": "claim_ack",
                        "tile_id": tile_id,
                        "success": True,
                        "cooldown": COOLDOWN_TIME
                    }))
                    continue
                
                # Claim the cell atomically
                old_owner_name = target_tile["owner_name"]
                target_tile["owner_id"] = player_id
                target_tile["owner_name"] = player["name"]
                target_tile["owner_color"] = player["color"]
                target_tile["timestamp"] = current_time
                
                # Recalculate scores and update leaderboard
                recalculate_scores()
                
                # Log the claim event
                x, y = target_tile["x"], target_tile["y"]
                if old_owner_name:
                    log_msg = f"{player['name']} CAPTURED ({x},{y}) FROM {old_owner_name}"
                else:
                    log_msg = f"{player['name']} CLAIMED UNCLAIMED ({x},{y})"
                add_telemetry_log("claim", log_msg)
                
                # Broadcast the update to all clients
                update_event = {
                    "type": "tile_update",
                    "tile": target_tile,
                    "players": list(player_identities.values()),
                    "logs": telemetry_logs
                }
                
                # Send confirmation first (so client knows it succeeded immediately)
                await websocket.send(json.dumps({
                    "type": "claim_ack",
                    "tile_id": tile_id,
                    "success": True,
                    "cooldown": COOLDOWN_TIME
                }))
                
                # Broadcast state to everyone else
                await broadcast(update_event)
                
            elif msg_type == "profile_update":
                if not player_id or player_id not in player_identities:
                    continue
                
                new_name = data.get("name", "").strip()
                new_color = data.get("color", "").strip()
                
                player = player_identities[player_id]
                old_name = player["name"]
                
                if new_name:
                    player["name"] = new_name
                if new_color:
                    player["color"] = new_color
                
                # Update tile records owned by this player to match the new name/color
                for tile in grid_state.values():
                    if tile["owner_id"] == player_id:
                        tile["owner_name"] = player["name"]
                        tile["owner_color"] = player["color"]
                
                log_msg = f"PLAYER {old_name} RE-PROFILED TO {player['name']}"
                add_telemetry_log("sys", log_msg)
                
                # Broadcast profile update
                await broadcast({
                    "type": "profile_changed",
                    "player_id": player_id,
                    "name": player["name"],
                    "color": player["color"],
                    "grid": list(grid_state.values()),
                    "players": list(player_identities.values()),
                    "logs": telemetry_logs
                })
                
            elif msg_type == "ping":
                # Handle latency measurement
                await websocket.send(json.dumps({
                    "type": "pong",
                    "timestamp": data.get("timestamp")
                }))
                
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        # Unregister and mark as offline
        connected_sockets.remove(websocket)
        if player_id and player_id in player_identities:
            player_identities[player_id]["online_status"] = "offline"
            add_telemetry_log("disconnect", f"CLIENT {player_identities[player_id]['name']} DISCONNECTED")
            await broadcast({
                "type": "player_leave",
                "player_id": player_id,
                "players": list(player_identities.values()),
                "logs": telemetry_logs
            })

async def run_ws_server():
    print(f"[WS] Real-time engine starting on ws://localhost:{PORT_WS}")
    async with websockets.serve(handle_connection, "0.0.0.0", PORT_WS):
        await asyncio.Future()  # run forever

def main():
    if IS_PROD:
        print(f"[SYS] Cloud environment detected. Starting WebSocket gateway on port {PORT_WS}...")
        try:
            asyncio.run(run_ws_server())
        except KeyboardInterrupt:
            print("\n[SYS] Server shutting down.")
            sys.exit(0)
    else:
        # Start HTTP Static Server in a separate thread
        http_thread = threading.Thread(target=run_http_server, daemon=True)
        http_thread.start()
        
        # Start WebSocket Server in the main thread async loop
        try:
            asyncio.run(run_ws_server())
        except KeyboardInterrupt:
            print("\n[SYS] Server shutting down.")
            sys.exit(0)

if __name__ == "__main__":
    main()
