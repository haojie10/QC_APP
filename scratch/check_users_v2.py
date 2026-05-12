import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='backend/.env')

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

response = supabase.table("users").select("factory_name, plain_password, expires_at").execute()
for row in response.data:
    print(f"Factory: {row['factory_name']}, Pwd: {row['plain_password']}, Exp: {row['expires_at']}")
