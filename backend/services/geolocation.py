"""
Serviço de geolocalização e cálculo de dias úteis baseado na localização do usuário.
Usa timezone e feriados locais para determinar dias úteis.
"""
from datetime import date, timedelta
from typing import Optional
import httpx


# ── Feriados fixos por país ───────────────────────────────────────────────────

HOLIDAYS_FIXED = {
    # Brasil (mês, dia)
    'BR': {
        (1, 1): "Ano Novo",
        (4, 21): "Tiradentes",
        (5, 1): "Dia do Trabalho",
        (9, 7): "Independência",
        (10, 12): "Nossa Senhora",
        (11, 2): "Finados",
        (11, 15): "Proclamação da República",
        (12, 25): "Natal",
    },
    # EUA (mês, dia) - feriados federais fixos
    'US': {
        (1, 1): "New Year's Day",
        (6, 19): "Juneteenth",
        (7, 4): "Independence Day",
        (11, 11): "Veterans Day",
        (12, 25): "Christmas",
    },
    # Reino Unido
    'GB': {
        (1, 1): "New Year's Day",
        (12, 25): "Christmas",
        (12, 26): "Boxing Day",
    },
    # Canadá
    'CA': {
        (1, 1): "New Year's Day",
        (7, 1): "Canada Day",
        (12, 25): "Christmas",
    },
}

# ── Feriados móveis (calculados por ano) ──────────────────────────────────────

def _easter_sunday(year: int) -> date:
    """Calcula a Páscoa (algoritmo de Meeus/Jones/Butcher)."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def get_moving_holidays(year: int, country: str) -> list[date]:
    """Retorna feriados móveis para um determinado ano e país."""
    holidays = []
    
    if country == 'BR':
        # Carnaval: 48 dias antes da Páscoa (terça-feira)
        easter = _easter_sunday(year)
        carnaval = easter - timedelta(days=48)
        holidays.append(carnaval)
        
        # Segunda de Carnaval (47 dias antes)
        holidays.append(carnaval + timedelta(days=1))
        
        # Sexta-feira Santa: 2 dias antes da Páscoa
        good_friday = easter - timedelta(days=2)
        holidays.append(good_friday)
        
        # Corpus Christi: 60 dias após a Páscoa
        corpus_christi = easter + timedelta(days=60)
        holidays.append(corpus_christi)
    
    elif country == 'US':
        # Memorial Day: última segunda-feira de maio
        memorial = date(year, 5, 31)
        while memorial.weekday() != 0:  # Segunda
            memorial -= timedelta(days=1)
        holidays.append(memorial)
        
        # Labor Day: primeira segunda-feira de setembro
        labor = date(year, 9, 1)
        while labor.weekday() != 0:
            labor += timedelta(days=1)
        holidays.append(labor)
        
        # Thanksgiving: quarta quinta-feira de novembro
        thanksgiving = date(year, 11, 1)
        thursdays = 0
        while thursdays < 4:
            if thanksgiving.weekday() == 3:  # Quinta
                thursdays += 1
            if thursdays < 4:
                thanksgiving += timedelta(days=1)
        holidays.append(thanksgiving)
    
    elif country == 'GB':
        # Good Friday
        easter = _easter_sunday(year)
        holidays.append(easter - timedelta(days=2))
        
        # Easter Monday
        holidays.append(easter + timedelta(days=1))
    
    elif country == 'CA':
        easter = _easter_sunday(year)
        holidays.append(easter - timedelta(days=2))  # Good Friday
    
    return holidays


# ── Detecção de país via IP ───────────────────────────────────────────────────

async def detect_country_from_ip(ip_address: str) -> Optional[str]:
    """
    Detecta o país baseado no IP do usuário.
    Usa API gratuita ip-api.com (sem autenticação necessária).
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"http://ip-api.com/json/{ip_address}")
            resp.raise_for_status()
            data = resp.json()
            
            if data.get('status') == 'success':
                return data.get('countryCode')  # 'BR', 'US', 'GB', etc.
    except Exception as e:
        print(f"[GeoIP] Erro ao detectar país: {e}")
    
    return None


# ── Verificação de dia útil ───────────────────────────────────────────────────

def is_business_day_local(d: date, country: str = 'BR') -> bool:
    """
    Verifica se uma data é dia útil considerando:
    - Fim de semana (sábado/domingo)
    - Feriados fixos locais
    - Feriados móveis locais
    """
    # Fim de semana
    if d.weekday() >= 5:  # Sábado=5, Domingo=6
        return False
    
    # Feriados fixos
    fixed_holidays = HOLIDAYS_FIXED.get(country, {})
    if (d.month, d.day) in fixed_holidays:
        return False
    
    # Feriados móveis
    moving_holidays = get_moving_holidays(d.year, country)
    if d in moving_holidays:
        return False
    
    return True


def next_business_day_local(d: date, country: str = 'BR') -> date:
    """Retorna o próximo dia útil a partir de d (exclusive)."""
    d += timedelta(days=1)
    while not is_business_day_local(d, country):
        d += timedelta(days=1)
    return d


def get_business_days_in_month(year: int, month: int, country: str = 'BR') -> list[date]:
    """Retorna todos os dias úteis de um mês."""
    days = []
    d = date(year, month, 1)
    while d.month == month:
        if is_business_day_local(d, country):
            days.append(d)
        d += timedelta(days=1)
    return days


def calc_due_date_local(reference: date, preferred_day: int = 5, country: str = 'BR') -> date:
    """
    Calcula data de vencimento considerando dias úteis locais.
    - preferred_day: dia preferido do mês (1-28)
    - Se cair em dia não útil, avança para o próximo dia útil
    """
    if reference.month == 12:
        year, month = reference.year + 1, 1
    else:
        year, month = reference.year, reference.month + 1
    
    # Tenta o dia preferido
    try:
        due = date(year, month, preferred_day)
    except ValueError:
        # Mês com menos dias (ex: fevereiro)
        due = date(year, month, 28)
    
    # Garante que é dia útil local
    if not is_business_day_local(due, country):
        due = next_business_day_local(due, country)
    
    return due


# ── Informações de fuso horário ──────────────────────────────────────────────

async def get_timezone_from_ip(ip_address: str) -> Optional[str]:
    """Retorna o timezone baseado no IP."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"http://ip-api.com/json/{ip_address}")
            resp.raise_for_status()
            data = resp.json()
            
            if data.get('status') == 'success':
                return data.get('timezone')  # 'America/Sao_Paulo', etc.
    except Exception as e:
        print(f"[Timezone] Erro: {e}")
    
    return None


# ── Endpoint helper ───────────────────────────────────────────────────────────

async def get_user_location_info(client_ip: str) -> dict:
    """
    Retorna informações completas de localização do usuário.
    """
    country = await detect_country_from_ip(client_ip)
    timezone = await get_timezone_from_ip(client_ip)
    
    today = date.today()
    is_bday = is_business_day_local(today, country or 'BR')
    
    return {
        'country': country,
        'timezone': timezone,
        'today': today.isoformat(),
        'is_business_day': is_bday,
        'next_business_day': next_business_day_local(today, country or 'BR').isoformat(),
        'business_days_remaining_this_month': len([
            d for d in get_business_days_in_month(today.year, today.month, country or 'BR')
            if d > today
        ]),
    }
