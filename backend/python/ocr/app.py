from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import re

from paddleocr import PaddleOCR

app = FastAPI()

# Singleton OCR model (English)
OCR_LANG = os.getenv("OCR_LANG", "en")
ocr_engine: Optional[PaddleOCR] = None


def get_ocr() -> PaddleOCR:
    global ocr_engine
    if ocr_engine is None:
        ocr_engine = PaddleOCR(use_angle_cls=True, lang=OCR_LANG, show_log=False)
    return ocr_engine


class OcrRequest(BaseModel):
    frontUrl: str
    backUrl: Optional[str] = None


NRIC_PATTERN = re.compile(r"\b(\d{6})[- ]?(\d{2})[- ]?(\d{4})\b")


def parse_fields(text: str) -> Dict[str, Any]:
    upper = text.upper()
    ic_number = None
    m = NRIC_PATTERN.search(upper)
    if m:
        ic_number = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

    name = None
    lines = [ln.strip() for ln in upper.splitlines() if ln.strip()]
    for ln in lines[:8]:
        if len(ln) > 2 and not any(ch.isdigit() for ch in ln) and "MALAYSIA" not in ln and "KAD" not in ln:
            name = ln
            break

    address = None
    keywords = ["JALAN", "NO.", "TAMAN", "KUALA", "SELANGOR", "JOHOR", "SABAH", "SARAWAK", "MELAKA", "NEGERI", "PERAK", "PENANG", "PULAU"]
    addr_lines = [ln for ln in lines if any(kw in ln for kw in keywords)]
    if addr_lines:
        address = ", ".join(addr_lines[:3])

    dob = None
    if ic_number:
        yymmdd = ic_number.split("-")[0]
        yy, mm, dd = int(yymmdd[:2]), yymmdd[2:4], yymmdd[4:6]
        century = 1900 if yy >= 40 else 2000
        dob = f"{century + yy}-{mm}-{dd}"

    return {"name": name, "ic_number": ic_number, "dob": dob, "address": address}


def read_image_bytes(url_path: str) -> bytes:
    if url_path.startswith("http"):
        import requests
        r = requests.get(url_path, timeout=10)
        r.raise_for_status()
        return r.content
    # Map storageUrl to container FS
    candidates = []
    if os.path.isabs(url_path):
        candidates.append(url_path)
        # If path begins with /uploads, try /srv/uploads too (sidecars mount /srv/uploads)
        if url_path.startswith("/uploads"):
            candidates.append(os.path.join("/srv", url_path.lstrip("/")))
            candidates.append(os.path.join("/app", url_path.lstrip("/")))
    else:
        candidates.append(os.path.join("/srv", url_path))
        candidates.append(os.path.join("/app", url_path))
    for p in candidates:
        try:
            with open(p, "rb") as f:
                return f.read()
        except Exception:
            continue
    raise FileNotFoundError(f"Image not found for {url_path} (tried: {candidates})")


def ocr_image_to_text(img_bytes: bytes) -> str:
    import numpy as np
    import cv2

    np_arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        return ""
    ocr = get_ocr()
    result = ocr.ocr(img, cls=True)
    texts = []
    for page in result:
        for line in page:
            txt = line[1][0]
            if txt:
                texts.append(txt)
    return "\n".join(texts)


@app.post("/ocr")
def ocr(req: OcrRequest):
    front_bytes = read_image_bytes(req.frontUrl)
    front_text = ocr_image_to_text(front_bytes)
    fields = parse_fields(front_text)

    if req.backUrl:
        try:
            back_bytes = read_image_bytes(req.backUrl)
            back_text = ocr_image_to_text(back_bytes)
            back_fields = parse_fields(back_text)
            if not fields.get("ic_number") and back_fields.get("ic_number"):
                fields["ic_number"] = back_fields["ic_number"]
            if not fields.get("address") and back_fields.get("address"):
                fields["address"] = back_fields["address"]
        except Exception:
            pass

    return fields


