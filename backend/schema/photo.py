"""
拍照相关请求/响应 Schema
"""
from pydantic import BaseModel, Field


class PhotoUploadRequest(BaseModel):
    """记录图片上传"""
    item_id: str = Field(..., description="货号 ID")
    step_id: str = Field(..., description="步骤编号 (1.1~5.4)")
    image_path: str = Field(..., description="Supabase Storage 中的文件路径")


class PhotoSkipRequest(BaseModel):
    """标记步骤为跳过"""
    item_id: str = Field(..., description="货号 ID")
    step_id: str = Field(..., description="步骤编号 (1.1~5.4)")


class PhotoResponse(BaseModel):
    """图片记录响应"""
    id: str
    item_id: str
    step_id: str
    image_path: str | None
    image_url: str | None = None
    status: str
    created_at: str
