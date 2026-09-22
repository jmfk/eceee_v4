from django.conf import settings


class ApplicationVersionMiddleware:
    """Expose the deployed build identifier so open editors can reload safely."""

    HEADER_NAME = "X-App-Version"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        app_version = getattr(settings, "APP_VERSION", "")
        if app_version:
            response[self.HEADER_NAME] = app_version
        return response
