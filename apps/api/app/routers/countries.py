from fastapi import APIRouter
router = APIRouter()
@router.get("/list")
async def list_all():
    return {"message": "Voir /api/macro/countries"}
