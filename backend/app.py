from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, get_db
from . import models
from sqlalchemy.orm import Session
from sqlalchemy import select, asc, desc
from pydantic import BaseModel, ConfigDict
from typing import Optional
from decimal import Decimal

app = FastAPI(title="Vendas Escolares — VENDAS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine)

@app.get("/health")
def health():
    return {"status": "ok"}

class ProdutoOut(BaseModel):
    id: int
    nome: str
    descricao: Optional[str]
    preco: Decimal
    estoque: int
    categoria: str
    sku: Optional[str]
    model_config = ConfigDict(from_attributes=True)

@app.get("/produtos")
def listar_produtos(
    search: str | None = Query(default=None),
    categoria: str | None = Query(default=None),
    sort: str | None = Query(default=None, description="formato: (nome|preco):(asc|desc)"),
    db: Session = Depends(get_db),
):
    stmt = select(models.Produto)

    if search:
        like = f"%{search}%"
        try:
            stmt = stmt.where(models.Produto.nome.ilike(like))
        except Exception:
            stmt = stmt.where(models.Produto.nome.like(like))

    if categoria:
        stmt = stmt.where(models.Produto.categoria == categoria)

    if sort:
        try:
            campo, ordem = sort.split(":")
            campo = campo.strip().lower()
            ordem = ordem.strip().lower()
            if campo not in {"nome", "preco"}:
                raise ValueError
            coluna = models.Produto.nome if campo == "nome" else models.Produto.preco
            direcao = asc if ordem == "asc" else desc
            stmt = stmt.order_by(direcao(coluna))
        except Exception:
            stmt = stmt.order_by(asc(models.Produto.nome))
    else:
        stmt = stmt.order_by(asc(models.Produto.nome))

    produtos = db.execute(stmt).scalars().all()
    return [ProdutoOut.model_validate(p) for p in produtos]
