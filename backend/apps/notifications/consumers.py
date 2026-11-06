"""
Receber a conexão.
Validar o JWT do usuário.
Identificar se é aluno ou professor.
Adicionar o usuário ao grupo correspondente.
Enviar eventos recebidos pelo Channel Layer ao frontend.
Remover o usuário dos grupos ao desconectar.
Usar AsyncJsonWebsocketConsumer
"""