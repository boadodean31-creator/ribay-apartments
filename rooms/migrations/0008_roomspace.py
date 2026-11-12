import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0007_sitesetting_page_images"),
    ]

    operations = [
        migrations.CreateModel(
            name="RoomSpace",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("sleep", "Where you'll sleep"), ("bath", "Restroom")], max_length=5)),
                ("title", models.CharField(max_length=60)),
                ("detail", models.CharField(blank=True, max_length=120)),
                ("image", models.ImageField(blank=True, upload_to="spaces/")),
                ("position", models.IntegerField(default=0)),
                ("room", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="spaces", to="rooms.room")),
            ],
            options={"ordering": ["kind", "position", "id"]},
        ),
    ]
