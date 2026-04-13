"""
QC APP 后端入口
FastAPI 应用配置：CORS、路由注册、启动事件
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.auth import router as auth_router
from api.tasks import router as tasks_router
from api.photos import router as photos_router
from api.reports import router as reports_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="HOWSTODAY QC APP",
    description="验货质检管理系统 API",
    version="1.0.0",
)

# CORS 中间件 - 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # NOTE: 生产环境需限制为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth_router, prefix="/api", tags=["认证"])
app.include_router(tasks_router, prefix="/api", tags=["任务"])
app.include_router(photos_router, prefix="/api/photos", tags=["拍照"])
app.include_router(reports_router, prefix="/api/reports", tags=["报告"])


@app.get("/api/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "service": "HOWSTODAY QC APP"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
