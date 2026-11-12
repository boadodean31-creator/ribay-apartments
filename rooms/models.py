from django.db import models
from django.contrib.auth.models import User

class Floor(models.Model):
    """A floor of the building. The admin can rename floors or add new ones from the website."""
    number = models.IntegerField(unique=True)
    name = models.CharField(max_length=40)

    class Meta:
        ordering = ["number"]

    def __str__(self):
        return self.name


class Room(models.Model):
    STATUS = [("available", "Available"), ("occupied", "Occupied")]

    number = models.CharField(max_length=10, unique=True)
    floor = models.IntegerField()
    room_type = models.CharField(max_length=50)
    rent = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS, default="available")
    video_url = models.URLField(blank=True)
    features = models.CharField(max_length=120, blank=True)  # comma-separated highlights, e.g. "Aircon, Private bath, Submeter"

    def __str__(self):
        return f"Room {self.number}"

    def get_floor_display(self):
        """The floor's name (e.g. '1st floor'). Templates already call this, so they keep working."""
        name = Floor.objects.filter(number=self.floor).values_list("name", flat=True).first()
        return name or f"Floor {self.floor}"

class RoomPhoto(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="rooms/")
    position = models.IntegerField(default=0)  # lowest number = cover photo

    class Meta:
        ordering = ["position", "id"]

class RoomSpace(models.Model):
    """A bedroom or bathroom picture with a short description, shown at the bottom of the room page."""
    KINDS = [("sleep", "Where you'll sleep"), ("bath", "Restroom")]

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="spaces")
    kind = models.CharField(max_length=5, choices=KINDS)
    title = models.CharField(max_length=60)
    detail = models.CharField(max_length=120, blank=True)
    image = models.ImageField(upload_to="spaces/", blank=True)
    position = models.IntegerField(default=0)

    class Meta:
        ordering = ["kind", "position", "id"]


class Tenancy(models.Model):
    tenant = models.ForeignKey(User, on_delete=models.CASCADE)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="tenancies")
    date_in = models.DateField()
    date_out = models.DateField(null=True, blank=True)

class Payment(models.Model):
    tenancy = models.ForeignKey(Tenancy, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    month_covered = models.DateField()
    method = models.CharField(max_length=30, blank=True)
    reference = models.CharField(max_length=50, blank=True)
    paid_on = models.DateField(auto_now_add=True)


class ViewingRequest(models.Model):
    """Someone (signed in with Google/Facebook/etc.) asked to see a room. Shown to admins as 'Viewing requests'."""
    STATUS = [("new", "New"), ("contacted", "Contacted"), ("confirmed", "Confirmed"),
              ("done", "Done"), ("cancelled", "Cancelled")]
    SLOTS = [("morning", "Morning · 9:00 AM – 12:00 PM"),
             ("afternoon", "Afternoon · 1:00 – 4:00 PM"),
             ("late", "Late afternoon · 4:00 – 6:00 PM")]
    ACTIVE = ("new", "contacted", "confirmed")

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="viewing_requests")
    room = models.ForeignKey(Room, null=True, blank=True, on_delete=models.SET_NULL, related_name="viewing_requests")
    room_number = models.CharField(max_length=10)  # kept even if the room is deleted later
    name = models.CharField(max_length=80)
    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)
    preferred_date = models.DateField()
    preferred_slot = models.CharField(max_length=10, choices=SLOTS)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default="new")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.name} · Room {self.room_number} · {self.preferred_date}"



class SiteSetting(models.Model):
    """One row only: things the admin can change on the home page (currently the banner photo)."""
    banner = models.ImageField(upload_to="site/", blank=True)

    # Pictures in "How a viewing works" and "What to know before you move in" (admins can replace each one)
    step1_image = models.ImageField(upload_to="site/", blank=True)
    step2_image = models.ImageField(upload_to="site/", blank=True)
    step3_image = models.ImageField(upload_to="site/", blank=True)
    apartment_image = models.ImageField(upload_to="site/", blank=True)
    rules_image = models.ImageField(upload_to="site/", blank=True)
    steps_decor_image = models.ImageField(upload_to="site/", blank=True)

    # Staff contact card on the room page. Admins edit these right on the page; blank = use settings.py
    contact_name = models.CharField(max_length=60, blank=True)
    contact_role = models.CharField(max_length=60, blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    contact_hours = models.CharField(max_length=80, blank=True)
    contact_reply = models.CharField(max_length=80, blank=True)
    contact_languages = models.CharField(max_length=80, blank=True)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
