"""
Tati AI - Testes de Carga, Latência, Bottlenecks e Break Point com Locust.
(Arquivo localizado dentro da pasta backend para facilidade de execução direta)
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from locustfile import StudentUser, on_test_stop
