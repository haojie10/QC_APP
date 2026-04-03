"""
任务相关请求/响应 Schema
"""
from pydantic import BaseModel, Field


class OrderResponse(BaseModel):
    """订单信息响应"""
    id: str
    order_number: str
    factory_name: str
    inspection_date: str
    status: str
    item_count: int = Field(0, description="货号总数")
    completed_items: int = Field(0, description="已完成货号数")
    created_at: str


class OrderItemResponse(BaseModel):
    """货号信息响应"""
    id: str
    order_id: str
    model_name: str
    status: str
    sort_order: int
    completed_steps: int = Field(0, description="已完成步骤数")
    total_steps: int = Field(18, description="总步骤数")


class StepProgressResponse(BaseModel):
    """步骤进度响应"""
    step_id: str
    status: str = Field(..., description="uploaded / skipped / pending")
    image_url: str | None = None
