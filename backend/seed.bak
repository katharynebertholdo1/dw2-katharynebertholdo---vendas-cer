from decimal import Decimal
from sqlalchemy import select
from .database import SessionLocal, engine
from .models import Base, Produto

# Garante que a tabela exista
Base.metadata.create_all(bind=engine)

sample = [
    {"nome":"Caderno Universitário","descricao":"Capa dura, 200 folhas","preco":Decimal("19.90"),"estoque":25,"categoria":"Cadernos","sku":"CAD-001"},
    {"nome":"Lápis HB","descricao":"Madeira reflorestada","preco":Decimal("1.50"),"estoque":200,"categoria":"Lápis","sku":"LPS-001"},
    {"nome":"Caneta Azul","descricao":"Esferográfica 1.0mm","preco":Decimal("2.90"),"estoque":150,"categoria":"Canetas","sku":"CNT-AZL-001"},
    {"nome":"Caneta Preta","descricao":"Esferográfica 1.0mm","preco":Decimal("2.90"),"estoque":140,"categoria":"Canetas","sku":"CNT-PRT-001"},
    {"nome":"Caneta Vermelha","descricao":"Esferográfica 1.0mm","preco":Decimal("2.90"),"estoque":0,"categoria":"Canetas","sku":"CNT-VMH-001"},
    {"nome":"Borracha","descricao":"Borracha escolar branca","preco":Decimal("2.50"),"estoque":100,"categoria":"Acessórios","sku":"ACC-BOR-001"},
    {"nome":"Apontador","descricao":"Apontador com depósito","preco":Decimal("3.00"),"estoque":120,"categoria":"Acessórios","sku":"ACC-APO-001"},
    {"nome":"Régua 30cm","descricao":"Régua em plástico transparente","preco":Decimal("4.50"),"estoque":85,"categoria":"Acessórios","sku":"ACC-REG-30-001"},
    {"nome":"Tesoura Escolar","descricao":"Tesoura ponta arredondada","preco":Decimal("7.90"),"estoque":60,"categoria":"Acessórios","sku":"ACC-TES-001"},
    {"nome":"Estojo Simples","descricao":"Estojo com 1 zíper","preco":Decimal("12.90"),"estoque":30,"categoria":"Acessórios","sku":"ACC-EST-001"},
    {"nome":"Mochila Escolar","descricao":"Mochila média com 2 compartimentos","preco":Decimal("129.90"),"estoque":0,"categoria":"Mochilas","sku":"MOC-ESC-001"},
    {"nome":"Grafite 0.5mm","descricao":"Cargas de grafite HB","preco":Decimal("6.90"),"estoque":80,"categoria":"Refis","sku":"REF-GRA-05-001"},
    {"nome":"Lapiseira 0.5mm","descricao":"Corpo emborrachado","preco":Decimal("9.90"),"estoque":70,"categoria":"Lapiseiras","sku":"LAP-05-001"},
    {"nome":"Papel Sulfite A4","descricao":"Resma 500 folhas 75g/m²","preco":Decimal("21.90"),"estoque":40,"categoria":"Papel","sku":"PAP-SUL-A4-500"},
    {"nome":"Post-it 76x76","descricao":"Bloco autoadesivo 100 folhas","preco":Decimal("8.90"),"estoque":55,"categoria":"Papel","sku":"PAP-PST-076-001"},
    {"nome":"Clips 100un","descricao":"Clips metálicos nº2","preco":Decimal("5.90"),"estoque":150,"categoria":"Acessórios","sku":"ACC-CLP-100-001"},
    {"nome":"Grampeador","descricao":"Grampeador médio 20 folhas","preco":Decimal("24.90"),"estoque":20,"categoria":"Acessórios","sku":"ACC-GRP-001"},
    {"nome":"Grampos 26/6","descricao":"Caixa com 5000 grampos","preco":Decimal("14.90"),"estoque":35,"categoria":"Refis","sku":"REF-GRM-266-001"},
    {"nome":"Marca Texto","descricao":"Amarelo fluorescente","preco":Decimal("4.90"),"estoque":90,"categoria":"Canetas","sku":"MAR-TXT-AMA-001"},
    {"nome":"Tinta Guache 6 cores","descricao":"Kit escolar 15ml","preco":Decimal("18.90"),"estoque":0,"categoria":"Arte","sku":"ART-GCH-6C-001"},
    {"nome":"Pincel nº12","descricao":"Cerdas sintéticas","preco":Decimal("6.50"),"estoque":45,"categoria":"Arte","sku":"ART-PCL-12-001"},
    {"nome":"Lápis de Cor 12","descricao":"Estojo com 12 cores","preco":Decimal("22.90"),"estoque":50,"categoria":"Arte","sku":"ART-LCR-12-001"},
    {"nome":"Agenda 2025","descricao":"Capa rosa, visão semanal","preco":Decimal("29.90"),"estoque":0,"categoria":"Agenda","sku":"AGD-2025-001"},
]

with SessionLocal() as db:
    for item in sample:
        exists = db.execute(select(Produto).where(Produto.sku == item["sku"]))\
            .scalar_one_or_none()
        if exists:
            continue
        p = Produto(**item)
        db.add(p)
    db.commit()

print("Seed aplicado.")
