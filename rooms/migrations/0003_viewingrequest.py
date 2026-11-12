import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("rooms", "0002_floor_roomphoto_position"),
    ]

    operations = [
        migrations.CreateModel(
            name="ViewingRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("room_number", models.CharField(max_length=10)),
                ("name", models.CharField(max_length=80)),
                ("phone", models.CharField(max_length=30)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("preferred_date", models.DateField()),
                ("preferred_slot", models.CharField(choices=[("morning", "Morning · 9:00 AM – 12:00 PM"), ("afternoon", "Afternoon · 1:00 – 4:00 PM"), ("late", "Late afternoon · 4:00 – 6:00 PM")], max_length=10)),
                ("message", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("new", "New"), ("contacted", "Contacted"), ("confirmed", "Confirmed"), ("done", "Done"), ("cancelled", "Cancelled")], default="new", max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("room", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="viewing_requests", to="rooms.room")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="viewing_requests", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
