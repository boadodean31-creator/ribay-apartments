from .access import is_site_admin
from .models import ViewingRequest


def site_admin(request):
    admin = is_site_admin(request)
    ctx = {"is_site_admin": admin}
    if admin:
        ctx["new_requests"] = ViewingRequest.objects.filter(status="new").count()
    return ctx
