from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0005_sitesetting_contact"),
    ]

    operations = [
        migrations.AddField(model_name="room", name="features", field=models.CharField(blank=True, max_length=120)),
    ]
