import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='backend/.env')

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

response = supabase.table("users").select("factory_name, plain_password, expires_at").execute()
for row in response.data:
    name = str(row['factory_name'])
    pwd = str(row['plain_password'])
    exp = str(row['expires_at'])
    line = f"Name: {name}, Pwd: {pwd}, Exp: {exp}\n"
    sys.stdout.buffer.write(line.encode('utf-8'))
