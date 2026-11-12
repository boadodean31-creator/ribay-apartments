import re

from datetime import timedelta

from django import forms
from django.utils import timezone

from .models import Floor, Room, SiteSetting, ViewingRequest

MAX_PHOTO_MB = 8


class RoomForm(forms.ModelForm):
    floor = forms.TypedChoiceField(coerce=int, label="Floor")
    rent = forms.DecimalField(min_value=0, max_digits=8, decimal_places=2, label="Rent per month (₱)")

    class Meta:
        model = Room
        fields = ["number", "floor", "room_type", "rent", "status", "video_url", "features"]
        labels = {"number": "Room number", "room_type": "Room type", "status": "Availability",
                  "video_url": "Video tour link", "features": "Room highlights"}
        help_texts = {"video_url": "Optional. Paste a YouTube link.",
                      "features": "Optional. Up to 6 short tags, separated by commas. They show as small tiles on the room page."}
        widgets = {"room_type": forms.TextInput(attrs={"placeholder": "e.g. Studio, Bedspace, 1-bedroom"}),
                   "video_url": forms.URLInput(attrs={"placeholder": "https://www.youtube.com/watch?v=..."}),
                   "features": forms.TextInput(attrs={"placeholder": "e.g. Aircon, Private bath, Submeter"})}

    def __init__(self, *args, **kwargs):
        initial_floor = kwargs.pop("initial_floor", None)
        super().__init__(*args, **kwargs)
        choices = [(f.number, f.name) for f in Floor.objects.all()]
        current = self.instance.floor if self.instance.pk else None
        if current is not None and current not in dict(choices):
            choices.append((current, f"Floor {current}"))
        self.fields["floor"].choices = choices
        if initial_floor is not None and not self.instance.pk:
            self.initial["floor"] = initial_floor

    def clean_number(self):
        number = self.cleaned_data["number"].strip()
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,9}", number):
            raise forms.ValidationError("Use letters, numbers or dashes only (for example 101 or 2B).")
        return number


class FloorForm(forms.ModelForm):
    class Meta:
        model = Floor
        fields = ["number", "name"]
        labels = {"number": "Floor number", "name": "Floor name"}

    def clean_name(self):
        return self.cleaned_data["name"].strip()


class FloorNameForm(forms.ModelForm):
    class Meta:
        model = Floor
        fields = ["name"]

    def clean_name(self):
        name = self.cleaned_data["name"].strip()
        if not name:
            raise forms.ValidationError("The floor needs a name.")
        return name


def check_images(files):
    """Return (good_files, error_messages). Accepts real images only, up to MAX_PHOTO_MB each."""
    good, errors = [], []
    checker = forms.ImageField()
    for f in files:
        if f.size > MAX_PHOTO_MB * 1024 * 1024:
            errors.append(f"{f.name}: too big (max {MAX_PHOTO_MB} MB).")
            continue
        try:
            checker.clean(f)
        except forms.ValidationError:
            errors.append(f"{f.name}: this is not a valid image.")
            continue
        f.seek(0)
        good.append(f)
    return good, errors


class ViewingRequestForm(forms.ModelForm):
    message = forms.CharField(required=False, max_length=500, widget=forms.Textarea)
    email = forms.EmailField(required=False)

    class Meta:
        model = ViewingRequest
        fields = ["name", "phone", "preferred_date", "preferred_slot", "message"]
        error_messages = {
            "name": {"required": "Please enter your name."},
            "phone": {"required": "Please enter a contact number."},
            "preferred_date": {"required": "Choose the day you want to visit.", "invalid": "Choose a valid date."},
            "preferred_slot": {"required": "Choose a time that works for you.",
                               "invalid_choice": "Choose a time that works for you."},
        }

    def clean_name(self):
        name = " ".join(self.cleaned_data["name"].split())
        if len(name) < 2:
            raise forms.ValidationError("Please enter your name.")
        return name

    def clean_phone(self):
        phone = self.cleaned_data["phone"].strip()
        digits = re.sub(r"\D", "", phone)
        if not (10 <= len(digits) <= 13) or re.search(r"[^0-9+\-\s()]", phone):
            raise forms.ValidationError("Enter a valid mobile number, like 0995-056-4761.")
        return phone

    def clean_preferred_date(self):
        d = self.cleaned_data["preferred_date"]
        today = timezone.localdate()
        if d < today + timedelta(days=1):
            raise forms.ValidationError("Please pick tomorrow or later, so our staff can prepare.")
        if d > today + timedelta(days=60):
            raise forms.ValidationError("Please pick a date within the next 60 days.")
        return d


def prepare_banner(upload):
    """Shrink a banner photo to a web-friendly size (max 2200 px wide, JPEG) so the home page stays fast."""
    from io import BytesIO

    from django.core.files.base import ContentFile
    from PIL import Image, ImageOps

    img = ImageOps.exif_transpose(Image.open(upload)).convert("RGB")
    img.thumbnail((2200, 1500))
    buf = BytesIO()
    img.save(buf, "JPEG", quality=82, optimize=True, progressive=True)
    return ContentFile(buf.getvalue(), name="banner.jpg")


def prepare_site_image(upload, max_px=1600):
    """Shrink a page picture for the web. Pictures with a see-through background stay PNG, the rest become JPEG."""
    from io import BytesIO

    from django.core.files.base import ContentFile
    from PIL import Image, ImageOps

    img = ImageOps.exif_transpose(Image.open(upload))
    img.thumbnail((max_px, max_px))
    buf = BytesIO()
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img.convert("RGBA").save(buf, "PNG", optimize=True)
        return ContentFile(buf.getvalue(), name="page-image.png")
    img.convert("RGB").save(buf, "JPEG", quality=84, optimize=True, progressive=True)
    return ContentFile(buf.getvalue(), name="page-image.jpg")


class ContactForm(forms.ModelForm):
    """Staff contact card on the room page (edited by admins right on the page)."""
    class Meta:
        model = SiteSetting
        fields = ["contact_name", "contact_role", "contact_phone", "contact_hours", "contact_reply", "contact_languages"]
        labels = {"contact_name": "Staff name", "contact_role": "Role", "contact_phone": "Contact number",
                  "contact_hours": "Viewing hours", "contact_reply": "Reply time", "contact_languages": "Languages"}

    def clean_contact_phone(self):
        phone = self.cleaned_data["contact_phone"].strip()
        if phone and (not re.fullmatch(r"[0-9+()\-\s]{7,30}", phone) or len(re.sub(r"\D", "", phone)) < 7):
            raise forms.ValidationError("Enter a valid phone number (digits, spaces, + or -).")
        return phone
