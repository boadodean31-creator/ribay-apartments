"""Website administrator pages (/manage/). Every view needs @site_admin_required."""
from urllib.parse import quote

from django.conf import settings
from django.contrib import messages
from django.db import transaction
from django.db.models import Count, Min
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST

from .access import site_admin_required
from .forms import ContactForm, FloorForm, FloorNameForm, RoomForm, check_images, prepare_banner, prepare_site_image
from .models import Floor, Room, RoomPhoto, RoomSpace, SiteSetting, ViewingRequest
from .views import contact_details, floor_groups


def _drop_file(fieldfile):
    if fieldfile:
        fieldfile.delete(save=False)


def _form_errors(request, form):
    for field, errs in form.errors.items():
        for e in errs:
            label = form.fields[field].label if field in form.fields else ""
            messages.error(request, f"{label}: {e}" if label else e)


@site_admin_required
def dashboard(request):
    rooms = list(Room.objects.prefetch_related("photos").order_by("number"))
    return render(request, "rooms/manage/dashboard.html", {
        "groups": floor_groups(rooms, include_empty=True),
        "total": len(rooms),
        "available": sum(1 for r in rooms if r.status == "available"),
        "occupied": sum(1 for r in rooms if r.status != "available"),
        "tab": "rooms",
    })


@site_admin_required
def room_edit(request, pk=None):
    room = get_object_or_404(Room, pk=pk) if pk else None
    initial_floor = request.GET.get("floor")
    initial_floor = int(initial_floor) if (initial_floor or "").lstrip("-").isdigit() else None

    if request.method == "POST":
        form = RoomForm(request.POST, instance=room)
        good, errors = check_images(request.FILES.getlist("photos"))
        valid = form.is_valid()
        for e in errors:
            form.add_error(None, e)
        if valid and not errors:
            with transaction.atomic():
                created = room is None
                room = form.save()
                last = max(room.photos.values_list("position", flat=True), default=0)
                for i, f in enumerate(good, start=1):
                    RoomPhoto.objects.create(room=room, image=f, position=last + i)
            if created:
                messages.success(request, f"Room {room.number} was added and is now live on the website.")
            else:
                messages.success(request, f"All changes saved. Room {room.number} is updated on the website.")
            return redirect("manage_room_edit", pk=room.pk)
        messages.error(request, "Nothing was saved. Please fix the problems below.")
    else:
        form = RoomForm(instance=room, initial_floor=initial_floor)

    return render(request, "rooms/manage/room_form.html", {
        "form": form, "room": room, "photos": list(room.photos.all()) if room else [], "tab": "rooms",
        "space_groups": _space_groups(room),
    })


@site_admin_required
@require_POST
def room_status(request, pk):
    room = get_object_or_404(Room, pk=pk)
    room.status = "occupied" if room.status == "available" else "available"
    room.save(update_fields=["status"])
    messages.success(request, f"Room {room.number} is now {room.get_status_display().lower()}.")
    return redirect("manage_home")


@site_admin_required
@require_POST
def room_delete(request, pk):
    room = get_object_or_404(Room, pk=pk)
    if room.tenancies.exists():
        messages.error(request, f"Room {room.number} has tenant and payment records, so it can't be deleted. "
                                "Mark it as occupied instead.")
        return redirect("manage_room_edit", pk=room.pk)
    number = room.number
    for p in room.photos.all():
        _drop_file(p.image)
    for sp in room.spaces.all():
        _drop_file(sp.image)
    room.delete()
    messages.success(request, f"Room {number} was deleted.")
    return redirect("manage_home")


@site_admin_required
@require_POST
def photo_cover(request, pk):
    photo = get_object_or_404(RoomPhoto, pk=pk)
    lowest = photo.room.photos.aggregate(m=Min("position"))["m"] or 0
    photo.position = lowest - 1
    photo.save(update_fields=["position"])
    messages.success(request, "That photo is now the cover photo.")
    return redirect("manage_room_edit", pk=photo.room_id)


@site_admin_required
@require_POST
def photo_replace(request, pk):
    photo = get_object_or_404(RoomPhoto, pk=pk)
    good, errors = check_images(request.FILES.getlist("image")[:1])
    if errors or not good:
        messages.error(request, errors[0] if errors else "Choose an image first.")
    else:
        old = photo.image
        old_name = old.name
        photo.image = good[0]
        photo.save()
        if old_name and old_name != photo.image.name:
            old.storage.delete(old_name)
        messages.success(request, "Photo replaced.")
    return redirect("manage_room_edit", pk=photo.room_id)


@site_admin_required
@require_POST
def photo_delete(request, pk):
    photo = get_object_or_404(RoomPhoto, pk=pk)
    room_id = photo.room_id
    _drop_file(photo.image)
    photo.delete()
    messages.success(request, "Photo deleted.")
    return redirect("manage_room_edit", pk=room_id)


@site_admin_required
def floors(request):
    counts = dict(Room.objects.values_list("floor").annotate(c=Count("id")))
    rows = [{"floor": f, "rooms": counts.get(f.number, 0)} for f in Floor.objects.order_by("-number")]
    return render(request, "rooms/manage/floors.html", {
        "rows": rows, "form": FloorForm(), "tab": "floors",
    })


@site_admin_required
@require_POST
def floor_add(request):
    form = FloorForm(request.POST)
    if form.is_valid():
        floor = form.save()
        messages.success(request, f"{floor.name} was added.")
    else:
        _form_errors(request, form)
    return redirect("manage_floors")


@site_admin_required
@require_POST
def floor_rename(request, pk):
    floor = get_object_or_404(Floor, pk=pk)
    form = FloorNameForm(request.POST, instance=floor)
    if form.is_valid():
        form.save()
        messages.success(request, "Floor name saved.")
    else:
        _form_errors(request, form)
    return redirect("manage_floors")


@site_admin_required
@require_POST
def floor_delete(request, pk):
    floor = get_object_or_404(Floor, pk=pk)
    if Room.objects.filter(floor=floor.number).exists():
        messages.error(request, f"{floor.name} still has rooms. Move or delete them first.")
    else:
        floor.delete()
        messages.success(request, f"{floor.name} was deleted.")
    return redirect("manage_floors")


# ---------- Viewing requests ("Book a viewing" inbox) ----------
REQUEST_TABS = [("new", "New"), ("contacted", "Contacted"), ("confirmed", "Confirmed"),
                ("done", "Done"), ("cancelled", "Cancelled"), ("all", "All")]
PROVIDERS = {"google": "Google", "facebook": "Facebook"}


def _reply_links(r):
    """Ready-made Gmail / mail links with a friendly message already typed in."""
    subject = f"Your viewing request for Room {r.room_number} - Ribay Apartments"
    body = (
        f"Hi {r.name},\n\n"
        f"This is {settings.CONTACT_STAFF} from Ribay Apartments. Thank you for asking to view "
        f"Room {r.room_number} on {r.preferred_date:%A, %B %d} ({r.get_preferred_slot_display()}).\n\n"
        f"Please reply to confirm if that time still works for you. "
        f"You can also call or text me at {settings.CONTACT_PHONE}.\n\n"
        f"{settings.CONTACT_STAFF}\nRibay Apartments"
    )
    q = f"su={quote(subject, safe='')}&body={quote(body, safe='')}"
    to = quote(r.email, safe="@")
    r.gmail_url = f"https://mail.google.com/mail/?view=cm&fs=1&to={to}&{q}"
    r.mailto_url = f"mailto:{to}?{q}"


@site_admin_required
def requests_list(request):
    from allauth.socialaccount.models import SocialAccount

    counts = dict(ViewingRequest.objects.values_list("status").annotate(c=Count("id")))
    total = sum(counts.values())
    status = request.GET.get("status")
    if status not in dict(REQUEST_TABS):
        status = "new" if counts.get("new") else "all"

    qs = ViewingRequest.objects.select_related("room")
    if status != "all":
        qs = qs.filter(status=status)
    items = list(qs[:200])

    provider_by_user = dict(SocialAccount.objects.filter(user_id__in={r.user_id for r in items})
                            .values_list("user_id", "provider"))
    for r in items:
        r.provider_label = PROVIDERS.get(provider_by_user.get(r.user_id), "Website account")
        r.floor_name = r.room.get_floor_display() if r.room else ""
        r.tel = "".join(ch for ch in r.phone if ch.isdigit() or ch == "+")
        if r.email:
            _reply_links(r)

    tabs = [{"key": k, "label": label, "count": total if k == "all" else counts.get(k, 0)} for k, label in REQUEST_TABS]
    return render(request, "rooms/manage/requests.html", {
        "items": items, "tabs": tabs, "status": status, "tab": "requests",
        "status_choices": ViewingRequest.STATUS, "newest_id": items[0].pk if items else 0,
    })


@never_cache
@site_admin_required
def requests_poll(request):
    """Small JSON answer the browser checks every few seconds so admins get a pop-up for new requests."""
    latest = ViewingRequest.objects.order_by("-id").first()
    data = {"new": ViewingRequest.objects.filter(status="new").count(), "latest_id": latest.pk if latest else 0}
    if latest:
        data["latest"] = {"name": latest.name, "room": latest.room_number}
    return JsonResponse(data)


@site_admin_required
@require_POST
def request_status(request, pk):
    vr = get_object_or_404(ViewingRequest, pk=pk)
    new_status = request.POST.get("status")
    if new_status in dict(ViewingRequest.STATUS):
        vr.status = new_status
        vr.save(update_fields=["status"])
        messages.success(request, f"{vr.name}'s request is now marked {vr.get_status_display().lower()}.")
    nxt = request.POST.get("next", "")
    if not url_has_allowed_host_and_scheme(nxt, allowed_hosts={request.get_host()}):
        nxt = ""
    return redirect(nxt or "manage_requests")


@site_admin_required
@require_POST
def request_delete(request, pk):
    vr = get_object_or_404(ViewingRequest, pk=pk)
    name = vr.name
    vr.delete()
    messages.success(request, f"{name}'s request was deleted.")
    nxt = request.POST.get("next", "")
    if not url_has_allowed_host_and_scheme(nxt, allowed_hosts={request.get_host()}):
        nxt = ""
    return redirect(nxt or "manage_requests")


# ---------- Bedroom / restroom pictures at the bottom of a room page ----------
SPACE_KINDS = [("sleep", "Where you\u2019ll sleep", "e.g. Bedroom, Sleeping area"), ("bath", "Restroom", "e.g. Bathroom")]
SPACE_KIND_KEYS = {k for k, _, _ in SPACE_KINDS}
MAX_SPACES = 6


def _space_groups(room):
    if not room:
        return []
    spaces = list(room.spaces.all())
    return [(k, label, hint, [x for x in spaces if x.kind == k]) for k, label, hint in SPACE_KINDS]


def _space_image(request, room):
    """Return (prepared picture or None, error text). An uploaded file wins; otherwise one of this room's own photos can be picked."""
    files = request.FILES.getlist("image")[:1]
    if files:
        good, errors = check_images(files)
        if errors or not good:
            return None, errors[0] if errors else "Choose a valid picture."
        return prepare_site_image(good[0], 1200), ""
    pid = request.POST.get("photo", "")
    if pid.isdigit():
        photo = room.photos.filter(pk=int(pid)).first()
        if photo:
            try:
                with photo.image.open("rb") as fh:
                    return prepare_site_image(fh, 1200), ""
            except Exception:
                return None, "Could not read that photo. Try uploading a picture instead."
    return None, ""


def _spaces_back(room_id):
    return redirect(reverse("manage_room_edit", args=[room_id]) + "#spaces")


@site_admin_required
@require_POST
def space_add(request, pk):
    room = get_object_or_404(Room, pk=pk)
    kind = request.POST.get("kind", "")
    title = request.POST.get("title", "").strip()[:60]
    detail = request.POST.get("detail", "").strip()[:120]
    img, err = _space_image(request, room)
    if kind not in SPACE_KIND_KEYS:
        messages.error(request, "Unknown section.")
    elif not title:
        messages.error(request, "Please type a title, for example Bedroom or Bathroom.")
    elif err:
        messages.error(request, err)
    elif room.spaces.filter(kind=kind).count() >= MAX_SPACES:
        messages.error(request, f"You can add up to {MAX_SPACES} in each section.")
    else:
        last = max(room.spaces.filter(kind=kind).values_list("position", flat=True), default=0)
        RoomSpace.objects.create(room=room, kind=kind, title=title, detail=detail, position=last + 1, **({"image": img} if img else {}))
        messages.success(request, "Added. It is now live on the room page.")
    return _spaces_back(room.pk)


@site_admin_required
@require_POST
def space_save(request, pk):
    sp = get_object_or_404(RoomSpace, pk=pk)
    title = request.POST.get("title", "").strip()[:60]
    img, err = _space_image(request, sp.room)
    if not title:
        messages.error(request, "The title can't be empty.")
    elif err:
        messages.error(request, err)
    else:
        sp.title = title
        sp.detail = request.POST.get("detail", "").strip()[:120]
        if img:
            old = sp.image
            old_name = old.name if old else ""
            sp.image = img
            sp.save()
            if old_name and old_name != sp.image.name:
                old.storage.delete(old_name)
        else:
            sp.save()
        messages.success(request, "Saved. The room page is updated.")
    return _spaces_back(sp.room_id)


@site_admin_required
@require_POST
def space_delete(request, pk):
    sp = get_object_or_404(RoomSpace, pk=pk)
    room_id = sp.room_id
    _drop_file(sp.image)
    sp.delete()
    messages.success(request, "Removed from the room page.")
    return _spaces_back(room_id)


# ---------- Home page banner ----------
@site_admin_required
def banner(request):
    site = SiteSetting.load()
    if request.method == "POST":
        good, errors = check_images(request.FILES.getlist("banner")[:1])
        if errors or not good:
            messages.error(request, errors[0] if errors else "Choose a photo first.")
        else:
            old = site.banner
            old_name = old.name if old else ""
            site.banner = prepare_banner(good[0])
            site.save()
            if old_name and old_name != site.banner.name:
                old.storage.delete(old_name)
            messages.success(request, "Banner updated. It is now live on the home page.")
        return redirect("manage_banner")
    return render(request, "rooms/manage/banner.html", {"site": site, "tab": "banner"})


@site_admin_required
@require_POST
def banner_remove(request):
    site = SiteSetting.load()
    _drop_file(site.banner)
    site.banner = ""
    site.save()
    messages.success(request, "Banner removed. The home page is back to the plain look.")
    return redirect("manage_banner")


# ---------- Pictures on the home page sections (steps, "At the apartment") ----------
PAGE_IMAGE_SLOTS = [
    {"field": "step1_image", "title": "Step 1: Pick a room", "hint": "Photo behind the green \u201c1 Pick a room\u201d label. Empty = the cover photo of an open room.", "wide": True},
    {"field": "step2_image", "title": "Step 2: Book a viewing", "hint": "Picture on the right of the card. Empty = the built-in calendar drawing. A PNG with a see-through background looks best."},
    {"field": "step3_image", "title": "Step 3: Visit the room", "hint": "Picture on the right of the card. Empty = the built-in drawing of two people shaking hands."},
    {"field": "apartment_image", "title": "\u201cAt the apartment\u201d card", "hint": "Soft photo that fades into the bottom-right corner of the green card. Empty = a living-room photo from your rooms.", "wide": True},
    {"field": "rules_image", "title": "\u201cHouse rules\u201d card", "hint": "Soft photo that fades into the bottom-right corner of the blue card. Empty = a bedroom photo from your rooms.", "wide": True},
    {"field": "steps_decor_image", "title": "Top of \u201cHow a viewing works\u201d", "hint": "Optional small photo (a plant or a bright corner) that fades into the green strip, top right.", "wide": True},
]
PAGE_IMAGE_FIELDS = {s["field"] for s in PAGE_IMAGE_SLOTS}


@site_admin_required
def page_images(request):
    site = SiteSetting.load()
    if request.method == "POST":
        field = request.POST.get("slot", "")
        if field not in PAGE_IMAGE_FIELDS:
            messages.error(request, "Unknown picture slot.")
            return redirect("manage_images")
        good, errors = check_images(request.FILES.getlist("image")[:1])
        if errors or not good:
            messages.error(request, errors[0] if errors else "Choose a picture first.")
        else:
            old = getattr(site, field)
            old_name = old.name if old else ""
            setattr(site, field, prepare_site_image(good[0]))
            site.save()
            if old_name and old_name != getattr(site, field).name:
                old.storage.delete(old_name)
            messages.success(request, "Picture updated. It is now live on the home page.")
        return redirect("manage_images")
    slots = [{**s, "image": getattr(site, s["field"])} for s in PAGE_IMAGE_SLOTS]
    return render(request, "rooms/manage/images.html", {"slots": slots, "tab": "images"})


@site_admin_required
@require_POST
def page_image_remove(request):
    site = SiteSetting.load()
    field = request.POST.get("slot", "")
    if field in PAGE_IMAGE_FIELDS:
        _drop_file(getattr(site, field))
        setattr(site, field, "")
        site.save()
        messages.success(request, "Picture removed. The home page is back to the default.")
    return redirect("manage_images")


# ---------- Staff contact card (edited right on the room page) ----------
@site_admin_required
@require_POST
def contact_save(request):
    site = SiteSetting.load()
    form = ContactForm(request.POST, instance=site)
    if not form.is_valid():
        errors = {f: [e["message"] for e in errs] for f, errs in form.errors.get_json_data().items()}
        return JsonResponse({"ok": False, "errors": errors}, status=422)
    form.save()
    return JsonResponse({"ok": True, "contact": contact_details()})
