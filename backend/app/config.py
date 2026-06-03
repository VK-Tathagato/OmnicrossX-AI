from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str

    # Google Gemini
    gemini_api_key: str
    embedding_model: str = "models/gemini-embedding-2"
    generation_model: str = "gemini-3.5-flash"
    embedding_dimension: int = 768

    # App
    environment: str = "development"
    debug: bool = True
    allowed_origins: str = "http://localhost:3000"

    # Research Pipeline
    max_papers_per_query: int = 8
    max_total_papers: int = 30
    chunk_size: int = 500
    chunk_overlap: int = 50
    top_k_chunks: int = 25
    max_solutions: int = 3

    # Rate Limiting
    rate_limit_per_minute: int = 20

    # Storage
    storage_bucket: str = "omnix-papers"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

