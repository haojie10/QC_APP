"""
认证相关请求/响应 Schema
"""
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """验货员登录请求"""
    factory_name: str = Field(..., description="工厂简称（即登录账号）")
    password: str = Field(..., description="登录密码")


class LoginResponse(BaseModel):
    """登录成功响应"""
    token: str = Field(..., description="JWT Token")
    factory_name: str
    is_admin: bool = False
    expires_at: str = Field(..., description="账号过期时间")


class CreateAccountRequest(BaseModel):
    """管理员创建临时账号请求"""
    factory_name: str = Field(..., description="工厂简称（用作登录账号）")
    order_number: str = Field(..., description="订单号")
    model_names: list[str] = Field(..., description="货号列表（可多个）")
    inspection_date: str = Field(..., description="验货日期 YYYY-MM-DD")


class CreateAccountResponse(BaseModel):
    """创建账号成功响应"""
    factory_name: str
    password: str = Field(..., description="随机生成的临时密码")
    expires_at: str
    order_id: str
    item_count: int = Field(..., description="货号数量")
