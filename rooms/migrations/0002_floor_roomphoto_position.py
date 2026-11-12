from django.db import migrations, models


def seed_floors(apps, schema_editor):
    """Create a Floor row for every floor already used (plus the 1st and 2nd floor)."""
    Floor = apps.get_model("rooms", "Floor")
    Room = apps.get_model("rooms", "Room")
    names = {1: "1st floor", 2: "2nd floor"}
    numbers = set(names) | set(Room.objects.values_list("floor", flat=True))
    for n in numbers:
        Floor.objects.get_or_create(number=n, defaults={"name": names.get(n, f"Floor {n}")})


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Floor",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("number", models.IntegerField(unique=True)),
                ("name", models.CharField(max_length=40)),
            ],
            options={"ordering": ["number"]},
        ),
        migrations.AlterField(
            model_name="room",
            name="floor",
            field=models.IntegerField(),
        ),
        migrations.AddField(
            model_name="roomphoto",
            name="position",
            field=models.IntegerField(default=0),
        ),
        migrations.AlterModelOptions(
            name="roomphoto",
            options={"ordering": ["position", "id"]},
        ),
        migrations.RunPython(seed_floors, migrations.RunPython.noop),
    ]
