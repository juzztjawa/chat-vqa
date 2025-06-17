from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi import Request
from pydantic_ai import Agent, BinaryContent
from dotenv import load_dotenv
from typing import List
import nest_asyncio
import os
import uuid
import shutil
import json

# --- Initialization --- #
load_dotenv()
nest_asyncio.apply()

app = FastAPI()

# Enable CORS (configure in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories and files
CHAT_HISTORY = "chat_history.json"
IMAGE_DIR = "images"
os.makedirs(IMAGE_DIR, exist_ok=True)

# Gemini Agent
agent = Agent(model="google-gla:gemini-2.0-flash")

# --- Endpoints --- #

@app.get("/messages")
def get_messages():
    if os.path.exists(CHAT_HISTORY):
        with open(CHAT_HISTORY) as f:
            return json.load(f)
    return []


@app.post("/vqa")
async def vqa_endpoint(question: str = Form(...), image: UploadFile = File(None)):
    try:
        history = []
        if os.path.exists(CHAT_HISTORY):
            with open(CHAT_HISTORY) as f:
                history = json.load(f)

        if image:
            # Read image bytes
            image_bytes = await image.read()

            # Save image
            ext = os.path.splitext(image.filename)[-1]
            filename = f"{uuid.uuid4().hex}{ext}"
            filepath = os.path.join(IMAGE_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(image_bytes)

            image_url = f"/images/{filename}"

            # Send to Gemini with image
            result = agent.run_sync([
                question,
                BinaryContent(data=image_bytes, media_type=image.content_type)
            ])

            user_msg = {"type": "user", "question": question, "image": image_url}
            bot_msg = {"type": "bot", "answer": result.output}

            history.extend([user_msg, bot_msg])

            with open(CHAT_HISTORY, "w") as f:
                json.dump(history, f)

            return {
                "answer": result.output,
                "image_url": image_url
            }

        else:
            # Text-only message
            result = agent.run_sync(question)

            user_msg = {"type": "user", "question": question}
            bot_msg = {"type": "bot", "answer": result.output}

            history.extend([user_msg, bot_msg])

            with open(CHAT_HISTORY, "w") as f:
                json.dump(history, f)

            return {
                "answer": result.output,
                "image_url": None
            }

    except Exception as e:
        return {"answer": f"Error: {str(e)}", "image_url": None}



@app.get("/images/{filename}")
def get_image(filename: str):
    return FileResponse(os.path.join(IMAGE_DIR, filename))


@app.delete("/messages")
def clear_chat():
    if os.path.exists(CHAT_HISTORY):
        os.remove(CHAT_HISTORY)
    for f in os.listdir(IMAGE_DIR):
        os.remove(os.path.join(IMAGE_DIR, f))
    return {"status": "Chat history cleared"}
