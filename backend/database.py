import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

# Force dotenv to look in the current file's directory
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# You can add this temporary print statement just to verify it works
print("DEBUG URL:", os.getenv("DATABASE_URL")) 

engine = create_engine(os.getenv("DATABASE_URL"))

# SessionLocal is a factory that creates new database sessions for every request
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is the parent class for all your database models
Base = declarative_base()

# Dependency injection for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()