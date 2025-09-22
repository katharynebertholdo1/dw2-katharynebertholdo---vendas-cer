from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, asc, desc, or_
from decimal import Decimal
import os

from . import models, database

app = FastAPI()

# Garantir tabelas no startup simples
models.Base.metadata.create_all(bind=database.engine)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------
# API: /api/produtos
# ----------------------
def _to_dict(p: models.Produto):
    return {
        "id": p.id,
        "nome": p.nome,
        "descricao": p.descricao,
        "preco": float(p.preco) if isinstance(p.preco, Decimal) else p.preco,
        "estoque": p.estoque,
        "categoria": p.categoria,
        "sku": p.sku,
    }

@app.get("/api/produtos")
def listar_produtos(
    search: str | None = None,
    categoria: str | None = None,
    sort: str | None = Query(default="nome:asc"),
    db: Session = Depends(database.get_db)
):
    stmt = select(models.Produto)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(or_(models.Produto.nome.ilike(like), models.Produto.descricao.ilike(like)))
    if categoria:
        stmt = stmt.where(models.Produto.categoria == categoria)
    # ordenar
    col, _, direction = (sort or "nome:asc").partition(":")
    colmap = {
        "nome": models.Produto.nome,
        "preco": models.Produto.preco,
        "estoque": models.Produto.estoque,
        "categoria": models.Produto.categoria,
        "id": models.Produto.id,
    }
    order_col = colmap.get(col, models.Produto.nome)
    stmt = stmt.order_by(asc(order_col) if (direction or "asc").lower() != "desc" else desc(order_col))

    rows = db.execute(stmt).scalars().all()
    return [_to_dict(p) for p in rows]

from pydantic import BaseModel, Field
class ProdutoIn(BaseModel):
    nome: str
    descricao: str | None = None
    preco: float = Field(..., ge=0)
    estoque: int = Field(0, ge=0)
    categoria: str
    sku: str | None = None

@app.post("/api/produtos", status_code=201)
def criar_produto(body: ProdutoIn, db: Session = Depends(database.get_db)):
    p = models.Produto(
        nome=body.nome,
        descricao=body.descricao,
        preco=Decimal(str(body.preco)),
        estoque=body.estoque,
        categoria=body.categoria,
        sku=body.sku,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_dict(p)

@app.put("/api/produtos/{pid}")
def atualizar_produto(pid: int, body: ProdutoIn, db: Session = Depends(database.get_db)):
    p = db.get(models.Produto, pid)
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    p.nome = body.nome
    p.descricao = body.descricao
    p.preco = Decimal(str(body.preco))
    p.estoque = body.estoque
    p.categoria = body.categoria
    p.sku = body.sku
    db.commit()
    db.refresh(p)
    return _to_dict(p)

@app.delete("/api/produtos/{pid}", status_code=204)
def deletar_produto(pid: int, db: Session = Depends(database.get_db)):
    p = db.get(models.Produto, pid)
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    db.delete(p)
    db.commit()
    return



# ----------------------
# API: carrinho / confirmar
# ----------------------
from pydantic import BaseModel, Field
from typing import List, Optional

class ItemIn(BaseModel):
    produto_id: int
    quantidade: int = Field(ge=1)

class CheckoutIn(BaseModel):
    itens: List[ItemIn]
    cupom: Optional[str] = None

class PedidoOut(BaseModel):
    id: int
    subtotal: float
    desconto: float
    total: float

@app.post("/api/carrinho/confirmar", response_model=PedidoOut)
def confirmar_carrinho(body: CheckoutIn, db: Session = Depends(database.get_db)):
    if not body.itens:
        raise HTTPException(status_code=400, detail="Carrinho vazio")

    # calcular subtotal e criar pedido
    subtotal = Decimal("0.00")
    itens_rows = []
    for it in body.itens:
        prod = db.get(models.Produto, it.produto_id)
        if not prod:
            raise HTTPException(status_code=404, detail=f"Produto {it.produto_id} não encontrado")
        if prod.estoque < it.quantidade:
            raise HTTPException(status_code=400, detail=f"Estoque insuficiente para {prod.nome}")
        linha_total = Decimal(prod.preco) * it.quantidade
        subtotal += linha_total
        itens_rows.append((prod, it.quantidade, Decimal(prod.preco)))

    # cupom simples: ALUNO10 = 10% off
    desconto = Decimal("0.00")
    if body.cupom and body.cupom.upper() == "ALUNO10":
        desconto = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))

    total = (subtotal - desconto).quantize(Decimal("0.01"))

    # Persistir pedido + itens
    pedido = models.Pedido(subtotal=subtotal, desconto=desconto, total=total, cupom=(body.cupom or None))
    db.add(pedido)
    db.flush()  # pega id

    for prod, qtd, preco in itens_rows:
        db.add(models.PedidoItem(pedido_id=pedido.id, produto_id=prod.id, quantidade=qtd, preco_unitario=preco))
        # opcional: baixar estoque
        prod.estoque -= qtd

    db.commit()
    db.refresh(pedido)

    return PedidoOut(id=pedido.id, subtotal=float(subtotal), desconto=float(desconto), total=float(total))

# ----------------------
# Servir o frontend
# ----------------------
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

assets_dir = os.path.join(frontend_dir, "assets")
app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/")
def read_index():
    return FileResponse(os.path.join(frontend_dir, "index.html"))

# ----------------------
# Main
# ----------------------
if __name__ == "__main__":
    import uvicorn
    try:
        import colorama; colorama.just_fix_windows_console()
    except Exception:
        pass
    YELLOW = "\033[93m"
    RESET = "\033[0m"
    print(f"{YELLOW}INFO: Open Live Server: http://127.0.0.1:8000{RESET}")
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=True)

@app.get("/health")
def health():
    return {"status": "ok"}

