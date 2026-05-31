import os
import asyncio
from google import genai
from google.genai import types

async def main():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    
    for model_name in ["text-embedding-004", "models/text-embedding-004", "gemini-embedding-001", "models/gemini-embedding-001"]:
        print(f"Testing {model_name}...")
        try:
            res = await client.aio.models.embed_content(
                model=model_name,
                contents="Hello world"
            )
            print(f"Success for {model_name}! Vector length: {len(res.embeddings[0].values)}")
        except Exception as e:
            print(f"Failed for {model_name}: {e}")

if __name__ == "__main__":
    asyncio.run(main())
