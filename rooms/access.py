"""Who is a website administrator?

An admin is either a Django superuser, or someone who signed in with a Google/Facebook
account whose (verified) email is listed in ADMIN_EMAILS in settings.py.
Visitors and tenants never see anything admin-related.
"""
from functools import wraps

from django.conf import settings
from django.contrib.auth.views import redirect_to_login
from django.http import Http404


def is_site_admin(request):
    cached = getattr(request, "_is_site_admin", None)
    if cached is not None:
        return cached
    request._is_site_admin = _check(request.user)
    return request._is_site_admin


def _check(user):
    if not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    admin_emails = {e.strip().lower() for e in getattr(settings, "ADMIN_EMAILS", []) if e}
    if not admin_emails:
        return False
    from allauth.account.models import EmailAddress
    from allauth.socialaccount.models import SocialAccount

    verified = {e.lower() for e in EmailAddress.objects.filter(user=user, verified=True).values_list("email", flat=True)}
    if verified & admin_emails:
        return True
    # Signed in through Google or Facebook (they confirm the email for us)
    if user.email and user.email.lower() in admin_emails:
        return SocialAccount.objects.filter(user=user, provider__in=["google", "facebook"]).exists()
    return False


def site_admin_required(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect_to_login(request.get_full_path())
        if not is_site_admin(request):
            raise Http404  # pretend the page does not exist
        return view(request, *args, **kwargs)
    return wrapper
