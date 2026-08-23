
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("WATSONX_APIKEY") or os.getenv("WATSONX_API_KEY")
PROJECT_ID = os.getenv("WATSONX_PROJECT_ID")
URL = os.getenv("WATSONX_URL", "https://eu-de.ml.cloud.ibm.com")
MODEL = os.getenv("GRANITE_MODEL", "ibm/granite-3-8b-instruct")

print(f"--- TESTING WATSONX CONNECTION ---")
print(f"URL: {URL}")
print(f"Project ID: {PROJECT_ID}")
print(f"Model: {MODEL}")

try:
    creds = Credentials(url=URL, api_key=API_KEY)
    model = ModelInference(
        model_id=MODEL,
        credentials=creds,
        project_id=PROJECT_ID
    )
    res = model.generate_text(prompt="Hello, respond with Connected.")
    print("\n>>> SUCCESS! Response from IBM Granite:", res)
except Exception as e:
    print("\n>>> EXACT IBM ERROR:", e)

