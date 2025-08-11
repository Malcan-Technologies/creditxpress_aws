from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class LiveReq(BaseModel):
    selfieUrl: str

@app.post("/liveness")
def liveness(req: LiveReq):
    # Stub: return acceptable liveness
    return {"score": 0.92}


