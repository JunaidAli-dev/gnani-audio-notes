from sqlalchemy import Column, String, Text, DateTime
from database import Base
import uuid
import datetime

class AudioNote(Base):
    __tablename__ = "audio_notes"

    # We use UUIDs instead of auto-incrementing integers (1, 2, 3) for security, 
    # preventing users from guessing the IDs of other people's audio notes.
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # gnani_job_id maps our internal database row to the remote Gnani Batch job.
    gnani_job_id = Column(String, nullable=True) 
    
    filename = Column(String, nullable=False)
    file_url = Column(String, nullable=False)
    
    # The state machine that drives the frontend UI progress indicators
    status = Column(String, default="uploading") 
    
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)