from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class FaceReq(BaseModel):
    icFrontUrl: str
    selfieUrl: str

@app.post("/face-match")
def match(req: FaceReq):
    # Stub: return a mid-high score; integrate InsightFace or CompreFace client
    return {"score": 0.82}


