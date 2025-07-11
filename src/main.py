from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from agno.agent import Agent
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.media import Image
from agno.models.google import Gemini
from dotenv import load_dotenv
from pathlib import Path
import os
import uuid
import json
from typing import Optional
from prompt import extraction_prompt
from pydantic import BaseModel

# --- Initialization --- #
load_dotenv()

app = FastAPI()

# 2. Define a Pydantic model for the request body
class ChatRequest(BaseModel):
    question: str
    enable_search: bool = False

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
IMAGE_DIR = "images"
CHAT_HISTORY = "chat_history.json"
os.makedirs(IMAGE_DIR, exist_ok=True)

# Mount static files for image serving
app.mount("/images", StaticFiles(directory=IMAGE_DIR), name="images")

# --- Agent Initialization --- #
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
model = Gemini(id="gemini-2.0-flash", api_key=GOOGLE_API_KEY)

def create_image_agent(model) -> Agent:
    return Agent(
        name="image_analysis_agent",
        model=model,
        markdown=True,
    )

def create_chat_agent(model, enable_search: bool = False) -> Agent:
    tools = [DuckDuckGoTools()] if enable_search else []
    return Agent(
        name="image_chat_followup_agent",
        model=model,
        tools=tools,
        read_chat_history=True,
        add_history_to_messages=True,
        num_history_responses=5,
        markdown=True,
        add_datetime_to_instructions=True,
    )

# Default extraction prompt
EXTRACTION_PROMPT = extraction_prompt

# --- Helper Functions --- #
def load_chat_history():
    if os.path.exists(CHAT_HISTORY):
        with open(CHAT_HISTORY) as f:
            return json.load(f)
    return {"messages": [], "last_extracted_data": None, "last_image_id": None}

def save_chat_history(history):
    with open(CHAT_HISTORY, "w") as f:
        json.dump(history, f)

def save_image(file: UploadFile) -> str:
    ext = Path(file.filename).suffix
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(IMAGE_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(file.file.read())
    return filename

# --- Endpoints --- #
@app.get("/messages")
def get_messages():
    history = load_chat_history()
    print(history)
    return history["messages"]


@app.post("/process-image")
async def process_image(
    image: UploadFile = File(...),
    mode: str = Form("auto"),
    instruction: Optional[str] = Form(None),
    enable_search: bool = Form(False)
):
    history = load_chat_history()
    
    filename = save_image(image)
    image_path = os.path.join(IMAGE_DIR, filename)
    
    image_agent = create_image_agent(model)
    
    extraction_instruction = EXTRACTION_PROMPT
    if mode.lower() in ["manual", "hybrid"] and instruction:
        extraction_instruction = instruction
    
    extracted_data = image_agent.run(extraction_instruction, images=[Image(filepath=image_path)])
    
    # Store the important data on the backend
    history["last_extracted_data"] = extracted_data.content
    history["last_image_id"] = filename
    
    
    # We now save the user action and the AI confirmation to the permanent chat history.
    # The frontend will now fetch this on reload.
    confirmation_message = "Image analyzed successfully. You can now ask questions about it."
    history["messages"].extend([
        {"role": "user", "content": f"Analyzed: {image.filename}", "image": f"/images/{filename}"},
        {"role": "assistant", "content": confirmation_message}
    ])
    
    
    save_chat_history(history)
    
    # The frontend doesn't need the message content back, it will just re-fetch the whole history
    # But we can return the updated history directly to save a network call.
    return {"messages": history["messages"]}

# This endpoint already correctly saves to history, so it's good.
@app.post("/chat")
async def chat(request: ChatRequest):
    history = load_chat_history()
    
    if not history["last_extracted_data"]:
        raise HTTPException(status_code=400, detail="No extracted data available. Process an image first.")
    
    chat_agent = create_chat_agent(model, request.enable_search)
    
    prompt = f"""You are a chat agent who answers followup questions based on extracted image data.
Understand the requirement properly and then answer the question correctly.

Extracted Image Data: {history['last_extracted_data']}

Use the above image insights to answer the following question.
Answer the following question from the above given extracted image data: {request.question}"""
    
    chat_response = chat_agent.run(prompt)
    
    history["messages"].extend([
        {"role": "user", "content": request.question},
        {"role": "assistant", "content": chat_response.content}
    ])
    save_chat_history(history)
    
    # Return the full updated message list
    return {"messages": history["messages"]}


@app.get("/images/{filename}")
def get_image(filename: str):
    return FileResponse(os.path.join(IMAGE_DIR, filename))



@app.delete("/clear")
def clear_chat():
    try:
        save_chat_history({"messages": [], "last_extracted_data": None, "last_image_id": None})
        for file in os.listdir(IMAGE_DIR):
            file_path = os.path.join(IMAGE_DIR, file)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                print(f"Error deleting {file_path}: {e}")
        # Return the new empty state
        return {"messages": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))