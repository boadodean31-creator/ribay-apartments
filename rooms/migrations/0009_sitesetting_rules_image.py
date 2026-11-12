from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0008_roomspace"),
    ]

    operations = [
        migrations.AddField(model_name="sitesetting", name="rules_image", field=models.ImageField(blank=True, upload_to="site/")),
    ]
