import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='backend/.env')

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

response = supabase.table("users").select("*").execute()
print(response.data)
