from sqlalchemy.orm import declarative_base, Mapped, mapped_column
from sqlalchemy import String, Integer, Numeric, Text, Index, ForeignKey, DateTime, func
from decimal import Decimal
from datetime import datetime

Base = declarative_base()

class Produto(Base):
	__tablename__ = "produtos"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	nome: Mapped[str] = mapped_column(String(60), nullable=False)
	descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
	# Usar Numeric(10,2) para preço com 2 casas decimais
	preco: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
	estoque: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
	categoria: Mapped[str] = mapped_column(String(60), nullable=False)
	sku: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)

	__table_args__ = (
		Index("ix_produtos_nome", "nome"),
		Index("ix_produtos_categoria", "categoria"),
	)


class Pedido(Base):
	__tablename__ = "pedidos"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	cupom: Mapped[str | None] = mapped_column(String(32), nullable=True)
	subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
	desconto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
	total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
	criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PedidoItem(Base):
	__tablename__ = "pedidos_itens"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	pedido_id: Mapped[int] = mapped_column(ForeignKey("pedidos.id", ondelete="CASCADE"))
	produto_id: Mapped[int] = mapped_column(ForeignKey("produtos.id"))
	quantidade: Mapped[int] = mapped_column(Integer, nullable=False)
	preco_unitario: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

	__table_args__ = (
		Index("ix_pedidos_itens_pedido", "pedido_id"),
	)
