import os
import asyncio
from dotenv import load_dotenv
load_dotenv()
from google import genai
client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

async def run():
    try:
        res = await client.aio.models.embed_content(model='models/gemini-embedding-001', contents=['hello']*100)
        print(len(res.embeddings))
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(run())
