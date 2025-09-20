from fastapi import FastAPI, Depends, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, get_db
from . import models
from sqlalchemy.orm import Session
from sqlalchemy import select, asc, desc
from pydantic import BaseModel, ConfigDict, Field, field_validator
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

class ProdutoBase(BaseModel):
    nome: str = Field(..., min_length=3, max_length=60)
    descricao: Optional[str] = None
    preco: Decimal = Field(..., gt=0)
    estoque: int = Field(ge=0, default=0)
    categoria: str = Field(..., min_length=1)
    sku: Optional[str] = Field(None, max_length=64)
    @field_validator("preco")
    def preco_duas_casas(cls, v: Decimal):
        q = Decimal("0.01")
        if v < Decimal("0.01"):
            raise ValueError("preco deve ser >= 0.01")
        return v.quantize(q)

class ProdutoCreate(ProdutoBase):
    pass

class ProdutoUpdate(ProdutoBase):
    nome: Optional[str] = Field(None, min_length=3, max_length=60)
    preco: Optional[Decimal] = Field(None, gt=0)
    estoque: Optional[int] = Field(None, ge=0)
    categoria: Optional[str] = Field(None, min_length=1)

@app.post("/produtos", response_model=ProdutoOut, status_code=status.HTTP_201_CREATED)
def criar_produto(payload: ProdutoCreate, db: Session = Depends(get_db)):
    if payload.sku:
        exists = db.execute(select(models.Produto).where(models.Produto.sku == payload.sku)).scalar_one_or_none()
        if exists is not None:
            raise HTTPException(status_code=400, detail={"erro": "sku já cadastrado"})
    produto = models.Produto(
        nome=payload.nome.strip(),
        descricao=payload.descricao,
        preco=payload.preco,
        estoque=payload.estoque or 0,
        categoria=payload.categoria.strip(),
        sku=payload.sku.strip() if payload.sku else None,
    )
    db.add(produto)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail={"erro": "erro interno ao salvar"})
    db.refresh(produto)
    return ProdutoOut.model_validate(produto)

@app.put("/produtos/{id}", response_model=ProdutoOut)
def atualizar_produto(id: int, payload: ProdutoUpdate, db: Session = Depends(get_db)):
    produto = db.get(models.Produto, id)
    if not produto:
        raise HTTPException(status_code=404, detail={"erro": "produto não encontrado"})
    if payload.nome is not None:
        produto.nome = payload.nome.strip()
    if payload.descricao is not None:
        produto.descricao = payload.descricao
    if payload.preco is not None:
        produto.preco = payload.preco
    if payload.estoque is not None:
        if payload.estoque < 0:
            raise HTTPException(status_code=400, detail={"erro": "estoque deve ser >= 0"})
        produto.estoque = payload.estoque
    if payload.categoria é not None:
        produto.categoria = payload.categoria.strip()
    if payload.sku is not None:
        if payload.sku:
            conflict = db.execute(
                select(models.Produto).where(models.Produto.sku == payload.sku, models.Produto.id != id)
            ).scalar_one_or_none()
            if conflict:
                raise HTTPException(status_code=400, detail={"erro": "sku já cadastrado"})
            produto.sku = payload.sku.strip()
        else:
            produto.sku = None
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail={"erro": "erro interno ao atualizar"})
    db.refresh(produto)
    return ProdutoOut.model_validate(produto)

from fastapi import Response
@app.delete("/produtos/{id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_produto(id: int, db: Session = Depends(get_db)):
    produto = db.get(models.Produto, id)
    if not produto:
        raise HTTPException(status_code=404, detail={"erro": "produto não encontrado"})
    try:
        db.delete(produto)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail={"erro": "erro interno ao excluir"})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
