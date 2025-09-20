from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, get_db
from . import models
from sqlalchemy.orm import Session
from fastapi import Depends, Query, HTTPException, status
from sqlalchemy import select, asc, desc
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional
from decimal import Decimal
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

app = FastAPI(title="Vendas Escolares — VENDAS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializa conexão com SQLite (sem criar tabelas ainda)
models.Base.metadata.create_all(bind=engine)

@app.get("/health")
def health():
    return {"status": "ok"}

# ==============================
# Padronização de erros
# ==============================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    # Pega a primeira mensagem de erro legível
    try:
        first = exc.errors()[0]
        msg = first.get("msg") or "payload inválido"
    except Exception:
        msg = "payload inválido"
    return JSONResponse(status_code=422, content={"erro": msg})


@app.exception_handler(IntegrityError)
async def integrity_exception_handler(request, exc: IntegrityError):
    # Heurística simples: provavelmente SKU duplicado
    return JSONResponse(status_code=400, content={"erro": "violação de integridade (possível SKU duplicado)"})


class ProdutoBase(BaseModel):
    nome: str = Field(..., min_length=3, max_length=60)
    descricao: Optional[str] = None
    preco: Decimal = Field(..., gt=0)
    estoque: int = Field(ge=0, default=0)
    categoria: str = Field(..., min_length=1)
    sku: Optional[str] = Field(None, max_length=64)

    @field_validator("preco")
    def preco_duas_casas(cls, v: Decimal):
        # Arredondar/validar para 2 casas decimais
        q = Decimal("0.01")
        if v < Decimal("0.01"):
            raise ValueError("preco deve ser >= 0.01")
        # Normaliza para duas casas se necessário
        return v.quantize(q)


class ProdutoCreate(ProdutoBase):
    pass


class ProdutoUpdate(ProdutoBase):
    nome: Optional[str] = Field(None, min_length=3, max_length=60)
    preco: Optional[Decimal] = Field(None, gt=0)
    estoque: Optional[int] = Field(None, ge=0)
    categoria: Optional[str] = Field(None, min_length=1)


class ProdutoOut(BaseModel):
    id: int
    nome: str
    descricao: Optional[str]
    preco: Decimal
    estoque: int
    categoria: str
    sku: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class CarrinhoItem(BaseModel):
    produto_id: int
    quantidade: int = Field(ge=1)


class CarrinhoConfirmarReq(BaseModel):
    itens: list[CarrinhoItem]
    cupom: Optional[str] = None


class PedidoOut(BaseModel):
    id: int
    subtotal: Decimal
    desconto: Decimal
    total: Decimal
    cupom: Optional[str]

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
        stmt = stmt.where(models.Produto.nome.ilike(like))

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
            # fallback para nome asc se sort inválido
            stmt = stmt.order_by(asc(models.Produto.nome))
    else:
        stmt = stmt.order_by(asc(models.Produto.nome))

    produtos = db.execute(stmt).scalars().all()
    return [ProdutoOut.model_validate(p) for p in produtos]


@app.post("/produtos", response_model=ProdutoOut, status_code=status.HTTP_201_CREATED)
def criar_produto(payload: ProdutoCreate, db: Session = Depends(get_db)):
    # SKU único
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

    # Atualizações condicionais
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
    if payload.categoria is not None:
        produto.categoria = payload.categoria.strip()
    if payload.sku is not None:
        # Validar unicidade de SKU ao atualizar
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
    return None


@app.post("/carrinho/confirmar", response_model=PedidoOut)
def confirmar_carrinho(payload: CarrinhoConfirmarReq, db: Session = Depends(get_db)):
    if not payload.itens:
        raise HTTPException(status_code=400, detail={"erro": "carrinho vazio"})

    # Carrega produtos e valida estoque
    ids = [i.produto_id for i in payload.itens]
    stmt = select(models.Produto).where(models.Produto.id.in_(ids))
    produtos = {p.id: p for p in db.execute(stmt).scalars().all()}
    if len(produtos) != len(ids):
        raise HTTPException(status_code=404, detail={"erro": "produto não encontrado"})

    subtotal = Decimal("0.00")
    for item in payload.itens:
        p = produtos[item.produto_id]
        if item.quantidade <= 0:
            raise HTTPException(status_code=400, detail={"erro": "quantidade deve ser >= 1"})
        if p.estoque < item.quantidade:
            raise HTTPException(status_code=400, detail={"erro": f"estoque insuficiente para {p.nome}"})
        subtotal += (p.preco * item.quantidade)

    # Cupom ALUNO10 -> 10% de desconto
    desconto = Decimal("0.00")
    cupom = (payload.cupom or "").strip().upper() or None
    if cupom == "ALUNO10":
        desconto = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))

    total = (subtotal - desconto).quantize(Decimal("0.01"))

    # Persistência simples de Pedido/Itens e baixa de estoque
    try:
        pedido = models.Pedido(subtotal=subtotal, desconto=desconto, total=total, cupom=cupom)
        db.add(pedido)
        db.flush()  # obter id
        for item in payload.itens:
            p = produtos[item.produto_id]
            p.estoque -= item.quantidade  # baixa
            db.add(models.PedidoItem(
                pedido_id=pedido.id,
                produto_id=p.id,
                quantidade=item.quantidade,
                preco_unitario=p.preco,
            ))
        db.commit()
        db.refresh(pedido)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail={"erro": "erro interno ao confirmar"})

    return PedidoOut.model_validate(pedido)
