from database import engine, Base
import models

# This command inspects your models.py and executes the SQL CREATE TABLE commands
Base.metadata.create_all(bind=engine)
print("Database tables created successfully.")