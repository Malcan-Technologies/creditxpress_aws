from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class OcrRequest(BaseModel):
    frontUrl: str
    backUrl: str | None = None

@app.post("/ocr")
def ocr(req: OcrRequest):
    # Stubbed response; integrate PaddleOCR here
    # Extract fields and validate Malaysian NRIC pattern
    sample = {
        "name": "JOHN DOE",
        "ic_number": "900101-14-1234",
        "dob": "1990-01-01",
        "address": "123, JALAN ABC, KUALA LUMPUR"
    }
    return sample


