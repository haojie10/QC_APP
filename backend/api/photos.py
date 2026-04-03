"""
拍照 API 路由
记录图片上传、标记跳过
"""
import logging
from fastapi import APIRouter, Depends
from supabase import Client

from dependencies import get_supabase, get_current_user
from schema.photo import PhotoUploadRequest, PhotoSkipRequest
from service import photo_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/upload")
async def upload_photo(
    request: PhotoUploadRequest,
    _user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    记录图片上传
    前端先直传图片到 Supabase Storage，然后调用此接口记录元数据
    """
    result = photo_service.record_photo(
        supabase=supabase,
        item_id=request.item_id,
        step_id=request.step_id,
        image_path=request.image_path,
    )
    return {"photo": result}


@router.post("/skip")
async def skip_step(
    request: PhotoSkipRequest,
    _user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """标记步骤为跳过（N/A）"""
    result = photo_service.skip_step(
        supabase=supabase,
        item_id=request.item_id,
        step_id=request.step_id,
    )
    return {"photo": result}
