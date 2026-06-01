import os
import asyncio
from dotenv import load_dotenv
load_dotenv()
from app.config import get_settings
from app.utils.dependencies import init_dependencies, get_pipeline

async def run_test():
    await init_dependencies()
    pipeline = await get_pipeline()
    print("Pipeline initialized")
    try:
        # We can pass an empty string for session_id since it's just updating supabase.
        # But wait, it needs a real session_id to not fail the supabase queries if there are foreign keys.
        # We can just call the Gemini parts to see if they fail.
        print("Testing expand_query...")
        expanded = await pipeline.gemini.expand_query("How to make a cheap battery")
        print("Expanded:", expanded)

        print("Testing generate_solutions...")
        # dummy chunk
        chunks = [{"title": "Test", "arxiv_id": "123", "chunk_text": "Batteries are cheap if you use sand.", "similarity": 0.9}]
        solutions = await pipeline.gemini.generate_solutions("How to make a cheap battery", chunks)
        print("Solutions:", len(solutions))
    except Exception as e:
        print("Error:", e)

asyncio.run(run_test())
