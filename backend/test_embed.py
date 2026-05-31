import os
from google import genai

def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Missing GEMINI_API_KEY")
        return
        
    client = genai.Client(api_key=api_key)
    
    print("Listing all models...")
    try:
        models = client.models.list()
        for m in models:
            print(m.name)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
