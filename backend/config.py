"""
应用全局配置
通过环境变量读取所有敏感信息，禁止硬编码
"""
import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """应用配置，所有密钥从环境变量中读取"""

    # Supabase
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_key: str = os.getenv("SUPABASE_KEY", "")
    supabase_service_key: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # JWT
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "2880"))

    # 临时账号有效期（小时）
    account_expire_hours: int = int(os.getenv("ACCOUNT_EXPIRE_HOURS", "48"))

    # 管理员默认密码
    admin_default_password: str = os.getenv("ADMIN_DEFAULT_PASSWORD", "admin123456")

    # Supabase Storage Bucket 名称
    storage_bucket: str = "qc-photos"

    # PDF 报告 Bucket
    report_bucket: str = "qc-reports"

    class Config:
        env_file = ".env"


settings = Settings()
