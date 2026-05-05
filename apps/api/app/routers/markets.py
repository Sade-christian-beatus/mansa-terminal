from fastapi import APIRouter
router = APIRouter()
@router.get("")
async def markets_stub():
    return {"message": "Markets — Phase 2", "coming_soon": ["BRVM","JSE","NSE","GSE"]}
