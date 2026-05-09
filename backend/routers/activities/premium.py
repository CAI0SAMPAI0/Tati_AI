"""
routers/activities/premium.py
Router para o Hub de Conteúdos Premium (Visão do Aluno).
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from datetime import date, timedelta

from routers.deps import get_current_user
from services.premium_service import PremiumService
from services.asaas import (
    create_customer,
    get_customer_by_email,
    create_payment,
    get_pix_qr_code,
)
from services.database import get_client
from services.document_validator import validate_document_auto

router = APIRouter()

async def _get_or_create_asaas_customer(user_db: dict) -> str:
    """Busca ou cria customer no Asaas."""
    email = user_db['email']
    raw_doc = (str(user_db.get('cpf') or user_db.get('cpf_cnpj') or '')
               .replace('.', '').replace('-', '').replace('/', '').strip())
    
    if not raw_doc:
        raise HTTPException(status_code=400, detail="CPF/CNPJ é obrigatório para compras.")
    
    customer = await get_customer_by_email(email)
    if customer:
        return customer['id']
    
    phone = ''.join(filter(str.isdigit, str(user_db.get('phone') or '')))
    phone = phone if len(phone) >= 10 else None
    
    try:
        new_cust = await create_customer(
            name=user_db.get('name') or user_db['username'],
            email=email,
            cpf_cnpj=raw_doc,
            phone=phone
        )
        return new_cust['id']
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar cliente no gateway: {str(e)}")

@router.get('/')
async def list_premium_content(
    user: dict = Depends(get_current_user),
    service: PremiumService = Depends()
) -> List[Dict[str, Any]]:
    """Lista a vitrine de conteúdos premium para o aluno."""
    return await service.list_content_for_student(user['username'])

@router.get('/{content_id}/access')
async def get_premium_access(
    content_id: str,
    user: dict = Depends(get_current_user),
    service: PremiumService = Depends()
) -> Dict[str, str]:
    """Retorna a URL de acesso (Signed URL) para o conteúdo, se autorizado."""
    url = await service.get_content_access(content_id, user['username'])
    return {"url": url}

@router.post('/{content_id}/buy')
async def buy_premium_content(
    content_id: str,
    billingType: str = 'PIX',
    user: dict = Depends(get_current_user),
    service: PremiumService = Depends()
):
    """
    Inicia o processo de compra via Asaas.
    Gera uma cobrança avulsa e retorna os dados de pagamento.
    """
    db = get_client()
    username = user['username']

    # 1. Busca detalhes do conteúdo
    content = db.table('premium_content').select('*').eq('id', content_id).single().execute().data
    if not content:
        raise HTTPException(status_code=404, detail="Conteúdo não encontrado")
    
    if content['price'] <= 0:
        return {"message": "Este conteúdo é gratuito.", "free": True}

    # 2. Busca dados completos do usuário
    user_db = db.table('users').select('*').eq('username', username).single().execute().data
    if not user_db:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # 3. Garante Customer no Asaas
    customer_id = await _get_or_create_asaas_customer(user_db)

    # 4. Cria Cobrança no Asaas
    # externalReference: PREMIUM:content_id:username
    external_ref = f"PREMIUM:{content_id}:{username}"
    due_date = (date.today() + timedelta(days=3)).isoformat()
    
    try:
        payment = await create_payment(
            customer_id=customer_id,
            billing_type=billingType,
            value=float(content['price']),
            due_date=due_date,
            description=f"Tati AI - Premium: {content['title']}",
            external_reference=external_ref
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar cobrança: {str(e)}")

    payment_id = payment.get('id')
    invoice_url = payment.get('invoiceUrl')

    # 5. Registra tentativa de compra no banco
    db.table('premium_purchases').upsert({
        'username': username,
        'content_id': content_id,
        'asaas_payment_id': payment_id,
        'status': 'pending'
    }, on_conflict='username,content_id').execute()

    # 6. Busca QR Code PIX se for o caso
    pix_qr_code = None
    pix_copy_paste = None
    if billingType == 'PIX' and payment_id:
        try:
            pix_data = await get_pix_qr_code(payment_id)
            pix_qr_code = pix_data.get('encodedImage')
            pix_copy_paste = pix_data.get('payload')
        except Exception as e:
            print(f"[Premium] Aviso: não foi possível gerar QR Code PIX (verifique se há chave PIX no Asaas): {e}")
            # Não lança erro, o usuário poderá usar o invoice_url

    return {
        "paymentId": payment_id,
        "invoiceUrl": invoice_url,
        "pixQrCode": pix_qr_code,
        "pixCopyPaste": pix_copy_paste,
        "value": content['price'],
        "title": content['title']
    }
