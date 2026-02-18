"""
WebSocket Server for Brand Guardian AI.

This server provides real-time streaming updates from the compliance audit workflow
to the frontend visualization dashboard. It uses WebSockets to push events
granularly as each node in the LangGraph executes.
"""

import json
import logging
import uuid
import os
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# ========== STEP 1: ENVIRONMENT SETUP ==========
# Locate and load the .env file (same logic as server.py)
current_dir = os.path.dirname(os.path.abspath(__file__))
# Navigate up to find the .env file in ComplianceQAPipeline folder
# Path: .../ComplianceQAPipeline/backend/src/api -> .../ComplianceQAPipeline/.env
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(current_dir))), '.env')

if not os.path.exists(dotenv_path):
    # Fallback for different execution contexts
    dotenv_path = os.path.join(os.getcwd(), 'ComplianceQAPipeline', '.env')

load_dotenv(dotenv_path=dotenv_path, override=True)

# ========== STEP 2: APP INITIALIZATION ==========
app = FastAPI(title="Brand Guardian Streaming API")

# Enable CORS for frontend communication (React runs on port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("brand-guardian-ws")

# ========== STEP 3: IMPORT WORKFLOW ==========
# Import the LangGraph application
try:
    from ComplianceQAPipeline.backend.src.graph.workflow import app as compliance_graph
    logger.info("Successfully loaded compliance graph.")
except ImportError as e:
    logger.error(f"Failed to import compliance graph: {e}")
    raise e

# ========== STEP 4: WEBSOCKET ENDPOINT ==========
@app.websocket("/ws/audit")
async def websocket_endpoint(websocket: WebSocket):
    """
    Handles the WebSocket connection for real-time audit streaming.
    
    Protocol:
    1. Client connects.
    2. Client sends JSON: {"video_url": "..."}
    3. Server streams JSON events for graph execution.
    4. Connection closes when complete.
    """
    await websocket.accept()
    logger.info("Client connected to WebSocket.")
    
    try:
        # Wait for the initial message from client
        data = await websocket.receive_json()
        video_url = data.get("video_url")
        
        if not video_url:
            await websocket.send_json({"error": "No video_url provided"})
            await websocket.close()
            return
            
        logger.info(f"Starting audit for: {video_url}")
        
        # Prepare initial state
        session_id = str(uuid.uuid4())
        initial_inputs = {
            "video_url": video_url,
            "video_id": f"vid_{session_id[:8]}",
            "compliance_results": [],
            "errors": []
        }
        
        # Send a confirmation that we are starting
        await websocket.send_json({
            "type": "system", 
            "message": "Audit started", 
            "session_id": session_id
        })

        # Stream events from LangGraph
        # version="v2" is required for standard event schema
        async for event in compliance_graph.astream_events(initial_inputs, version="v2"):
            
            # We are interested in high-level graph events and specific node events
            event_type = event.get("event")
            event_name = event.get("name")
            
            # Filter for relevant events to send to frontend
            # relevant_nodes = ["indexer", "auditor"]
            
            # Construct a simplified payload for the frontend
            payload = {
                "type": event_type,     # e.g., on_chain_start, on_chain_end
                "name": event_name,     # e.g., indexer, auditor
                "data": event.get("data", {}),
                "timestamp": str(uuid.uuid4()) # simple unique ID for list keys
            }
            
            # Send to client
            await websocket.send_json(payload)
            
            # Log specific milestones
            if event_type == "on_chain_start" and event_name in ["indexer", "auditor"]:
                logger.info(f"Node started: {event_name}")
            elif event_type == "on_chain_end" and event_name in ["indexer", "auditor"]:
                logger.info(f"Node finished: {event_name}")

        # Send completion message
        await websocket.send_json({"type": "system", "message": "Audit complete", "status": "done"})
        
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass # Connection might be already closed
    finally:
        try:
            await websocket.close()
        except:
            pass
