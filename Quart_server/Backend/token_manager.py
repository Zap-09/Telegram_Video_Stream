class UploadTokens:
    def __init__(self):
        self._active: set[str] = set()

    def add(self, token: str):
        self._active.add(token)

    def discard(self, token: str):
        self._active.discard(token)

    def __contains__(self, token: str) -> bool:
        return token in self._active

activeUploads = UploadTokens()

