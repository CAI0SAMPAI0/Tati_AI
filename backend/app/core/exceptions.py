from fastapi import HTTPException, status


class UserNotFoundError(HTTPException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado"
        )


class ResourceNotFoundError(HTTPException):
    def __init__(self, resource: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} não encontrado(a)",
        )


class InvalidDocumentError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class BusinessLogicError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class AuthenticationRequiredError(HTTPException):
    def __init__(self, detail: str = "Não autenticado."):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class PremiumAccessDeniedError(HTTPException):
    def __init__(
        self,
        detail: str = "Você não possui acesso a este conteúdo. Realize a compra para liberar.",
    ):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class ContentNotFoundError(HTTPException):
    def __init__(self, detail: str = "Conteúdo não encontrado."):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
